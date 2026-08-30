import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalDatabase } from "../server/database.local.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import { AuthBrowser, alice } from "./wallet-auth-helpers.mjs";
import { product } from "../lib/product.ts";
import { clientNetwork, trustedClientAddress } from "../server/auth-client.ts";
import {
  createCspNonce,
  contentSecurityPolicy,
  documentSecurityHeaders,
} from "../server/document-security.ts";
import { requireSecurityRelease } from "../server/release.ts";
import {
  validateEvidenceUrl,
  validateEvidenceText,
  MAX_EVIDENCE_BYTES,
} from "../lib/evidence.ts";

async function database(t) {
  const db = createLocalDatabase(":memory:");
  t.after(() => db.close());
  t.mock.method(Date, "now", () => 1787918400000);
  for (const file of [
    "0000_product_base.sql",
    "0001_transaction_args.sql",
    "0002_wallet_auth.sql",
  ]) {
    await db.batch(
      schemaStatements(
        readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"),
      ).map((sql) => db.prepare(sql)),
    );
  }
  return db;
}

test("300 malformed unsigned requests cannot consume the shared login budget", async (t) => {
  const db = await database(t);
  const attacker = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.1",
  );
  for (let i = 0; i < 300; i++)
    assert.equal((await attacker.auth("challenge", {})).status, 400);
  const legitimate = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.2",
  );
  await legitimate.login(alice);
  const rows = (await db.prepare("SELECT key FROM rate_buckets").all()).results;
  assert.ok(
    rows.every(
      (row) =>
        !row.key.startsWith("wallet-auth:") &&
        !row.key.startsWith("wallet-login:"),
    ),
  );
});

test("unsigned requests naming a victim wallet cannot lock that wallet out from another client", async (t) => {
  const db = await database(t);
  const attacker = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.1",
  );
  for (let i = 0; i < 20; i++) await attacker.challenge(alice);
  assert.equal(
    (
      await attacker.auth("challenge", {
        wallet: alice.address,
        chainId: 61999,
      })
    ).status,
    429,
  );
  const victim = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.2",
  );
  await victim.login(alice);
});

test("rotating wallet claims, browser cookies and spoofed headers cannot evade a trusted client's quota", async (t) => {
  const db = await database(t);
  const attacker = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.1",
  );
  for (let i = 0; i < 20; i++) {
    attacker.cookies.clear();
    const response = await attacker.auth(
      "challenge",
      {
        wallet: "0x" + (i + 1).toString(16).padStart(40, "0"),
        chainId: 61999,
        clientAddress: "198.51.100." + (i + 1),
      },
      {
        "x-forwarded-for": "198.51.100." + (i + 1),
        "x-real-ip": "192.0.2." + (i + 1),
      },
    );
    assert.equal(response.status, 200);
  }
  assert.equal(
    (
      await attacker.auth("challenge", {
        wallet: alice.address,
        chainId: 61999,
      })
    ).status,
    429,
  );
  const rows = (await db.prepare("SELECT key FROM rate_buckets").all()).results;
  assert.ok(
    rows.every((row) => !row.key.includes("203.0.113.1")),
    "Raw IPs must not be stored in rate keys",
  );
});

test("the global challenge circuit breaker does not block verification of an existing challenge", async (t) => {
  const db = await database(t);
  const browser = new AuthBrowser(db);
  const challenge = await browser.challenge();
  const key =
    "wallet-challenge-global:" +
    product.id +
    ":" +
    Math.floor(Date.now() / 60000);
  await db
    .prepare("UPDATE rate_buckets SET count=300 WHERE key=?")
    .bind(key)
    .run();
  const other = new AuthBrowser(
    db,
    "https://wallet.example",
    product,
    "203.0.113.2",
  );
  assert.equal(
    (await other.auth("challenge", { wallet: alice.address, chainId: 61999 }))
      .status,
    429,
  );
  const signature = await alice.signMessage({ message: challenge.message });
  assert.equal(
    (await browser.auth("verify", { id: challenge.id, signature })).status,
    200,
  );
});

test("IPv6 rotation is grouped by /64, mapped IPv4 is canonical, and ambiguous identities fail closed", () => {
  assert.equal(
    clientNetwork("2001:db8:1:2::1"),
    clientNetwork("2001:db8:1:2:ffff:ffff:ffff:ffff"),
  );
  assert.notEqual(
    clientNetwork("2001:db8:1:2::1"),
    clientNetwork("2001:db8:1:3::1"),
  );
  assert.equal(
    clientNetwork("::ffff:203.0.113.1"),
    clientNetwork("203.0.113.1"),
  );
  for (const value of [
    "",
    "unknown",
    "127.1",
    "203.0.113.1, 203.0.113.2",
    " 203.0.113.1",
  ]) {
    assert.throws(
      () => clientNetwork(value),
      (error) => error.code === "client_identity_unavailable",
    );
  }
});

test("Vercel identity uses the protected platform header rather than user forwarding headers", (t) => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  });
  const request = new Request("https://wallet.example/api/auth/challenge", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.5",
      "x-real-ip": "198.51.100.8",
    },
  });
  assert.equal(trustedClientAddress(request), "203.0.113.7");
  assert.equal(
    trustedClientAddress(
      new Request(request.url, {
        headers: { "x-forwarded-for": "198.51.100.5" },
      }),
    ),
    "",
  );
});

test("production CSP uses unpredictable nonces without script unsafe-inline or unsafe-eval", () => {
  const a = createCspNonce(),
    b = createCspNonce();
  assert.notEqual(a, b);
  const csp = contentSecurityPolicy(a);
  const scripts = csp
    .split("; ")
    .find((value) => value.startsWith("script-src "));
  assert.match(scripts, /'strict-dynamic'/);
  assert.ok(scripts.includes("'nonce-" + a + "'"));
  assert.ok(
    !scripts.includes("unsafe-inline") && !scripts.includes("unsafe-eval"),
  );
  assert.ok(
    csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"),
  );
  assert.match(contentSecurityPolicy(a, true), /unsafe-eval/);
  assert.throws(() => contentSecurityPolicy("'; script-src *"));
  const headers = Object.fromEntries(
    documentSecurityHeaders.map(({ key, value }) => [key, value]),
  );
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.ok(headers["Permissions-Policy"]);
});

test("UI and authoritative contracts share the same public URL fixture", () => {
  const cases = JSON.parse(
    readFileSync(
      new URL("../../tests/fixtures/evidence-urls.json", import.meta.url),
      "utf8",
    ),
  );
  for (const url of cases.valid) assert.equal(validateEvidenceUrl(url), url);
  for (const url of cases.invalid)
    assert.throws(() => validateEvidenceUrl(url), undefined, url);
});

test("complete-source limit counts normalized UTF-8 bytes, never UTF-16 code units", () => {
  assert.equal(MAX_EVIDENCE_BYTES, 6000);
  assert.equal(validateEvidenceText("é".repeat(3000)), "é".repeat(3000));
  assert.equal(
    validateEvidenceText("  complete \n receipt "),
    "complete receipt",
  );
  for (const value of ["", " \n ", "x".repeat(6001), "é".repeat(3001)])
    assert.throws(() => validateEvidenceText(value));
});

test("new commitments fail closed on legacy contracts while existing-fund recovery stays available", async () => {
  const core = "0x" + "11".repeat(20),
    capture = "0x" + "22".repeat(20);
  let coreVersion = 2,
    helperVersion = 3,
    linkedCore = core;
  const net = {
    coreAddress: core,
    read: async (_method, _args, target = core) => ({
      protocol_version: target === core ? coreVersion : helperVersion,
      max_source_bytes: 6000,
      product_contract: linkedCore,
    }),
  };
  for (const method of [
    "create_pool",
    "join",
    "create_agreement",
    "fund_agreement",
    "submit_checkin",
    "resolve",
  ]) {
    await assert.rejects(
      requireSecurityRelease(net, core, method),
      (error) => error.code === "security_update_required",
    );
  }
  for (const method of [
    "withdraw",
    "claim_formation_refund",
    "release_to_party_b",
    "refund_to_party_a",
    "settle",
  ]) {
    await requireSecurityRelease(net, core, method);
  }
  await assert.rejects(requireSecurityRelease(net, capture, "capture"));
  coreVersion = 3;
  await requireSecurityRelease(net, core, "resolve_timeout_split");
  await requireSecurityRelease(net, capture, "capture");
  helperVersion = 2;
  await assert.rejects(requireSecurityRelease(net, capture, "capture"));
  helperVersion = 3;
  linkedCore = "0x" + "33".repeat(20);
  await assert.rejects(requireSecurityRelease(net, capture, "capture"));
});
