import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";
import { privateKeyToAccount } from "viem/accounts";
import { createPostgresDatabase } from "../server/postgres-database.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import { rateLimit } from "../server/security.ts";
import { recordRpcHealth } from "../server/health.ts";
import { savePreferences, getPreferences } from "../server/preferences.ts";
import { addSupport, supportList, respondSupport } from "../server/support.ts";
import {
  syncDirectory,
  directory,
  coverage,
  recordHistory,
} from "../server/directory.ts";
import { ownerOverview } from "../server/operations.ts";
import {
  ownerChallenge,
  completeOwnerChallenge,
  ownerSession,
  logoutOwner,
} from "../server/owner-auth.ts";
import { cleanExpiredTransientRows } from "../server/maintenance.ts";
import { reserveIntent, ownIntent, updateIntent } from "../server/journal.ts";
import { handleProductRequest } from "../server/api.ts";
import { product } from "../lib/product.ts";
import {
  AuthBrowser,
  alice as loginAlice,
  bob as loginBob,
} from "../tests/wallet-auth-helpers.mjs";
import { getWalletSession, handleWalletAuth } from "../server/wallet-auth.ts";

loadEnvFile(".env.local");
const expectedProjects = {
  "commitment-pools": "round-pond-96628981",
  "dispute-court": "lively-boat-81694619",
};
assert.equal(
  process.env.NEON_PROJECT_ID,
  expectedProjects[product.id],
  "Refusing to test an unrelated database.",
);
const connection = process.env.DATABASE_URL;
assert.ok(connection);
const admin = neon(connection);
const schema = "verification_" + crypto.randomUUID().replaceAll("-", "");
assert.match(schema, /^verification_[a-f0-9]{32}$/);
const checks = [];
let created = false;
try {
  await admin.query('CREATE SCHEMA "' + schema + '"');
  created = true;
  const db = createPostgresDatabase(connection, schema);
  const migration = readFileSync(
    new URL("../server/postgres-schema.sql", import.meta.url),
    "utf8",
  );
  await db.batch(schemaStatements(migration).map((sql) => db.prepare(sql)));
  await db.batch(schemaStatements(migration).map((sql) => db.prepare(sql)));
  checks.push("idempotent schema");

  await assert.rejects(
    db.batch([
      db
        .prepare(
          "INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)",
        )
        .bind("rollback", "{}", Date.now()),
      db
        .prepare(
          "INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)",
        )
        .bind("rollback", "{}", Date.now()),
    ]),
  );
  assert.equal(
    await db
      .prepare("SELECT user_id FROM preferences WHERE user_id=?")
      .bind("rollback")
      .first(),
    null,
  );
  checks.push("atomic rollback");

  const limited = await Promise.allSettled(
    Array.from({ length: 5 }, () => rateLimit(db, "race", 3)),
  );
  assert.equal(limited.filter((item) => item.status === "fulfilled").length, 3);
  assert.equal(
    limited.filter(
      (item) => item.status === "rejected" && item.reason.status === 429,
    ).length,
    2,
  );
  checks.push("concurrent rate limit");

  await savePreferences(db, "alice", {
    timezone: "Europe/London",
    reminderMinutes: 15,
  });
  assert.equal((await getPreferences(db, "alice")).timezone, "Europe/London");
  assert.equal((await getPreferences(db, "bob")).timezone, "UTC");
  const ticket = await addSupport(db, "alice", {
    category: "feedback",
    body: "Temporary verification fixture only.",
  });
  assert.equal((await supportList(db, "alice")).length, 1);
  assert.equal((await supportList(db, "bob")).length, 0);
  await respondSupport(db, {
    id: ticket.id,
    response: "Verified.",
    status: "resolved",
  });
  assert.equal((await supportList(db, "alice"))[0].status, "resolved");
  checks.push("account isolation and support");

  await Promise.all([
    recordRpcHealth(db, true),
    recordRpcHealth(db, true),
    recordRpcHealth(db, false),
  ]);
  const health = JSON.parse(
    (
      await db
        .prepare("SELECT json FROM system_state WHERE key='rpc_health'")
        .first()
    ).json,
  );
  assert.equal(health.successes, 2);
  assert.equal(health.failures, 1);
  checks.push("atomic health counters");

  const wallet = privateKeyToAccount("0x" + "17".repeat(32));
  const owner = wallet.address.toLowerCase();
  const core = "0x" + "11".repeat(20),
    capture = "0x" + "22".repeat(20);
  const value = {
    id: "temporary-vercel-check",
    title: "Mixed Case Verification",
    status: "active",
    created_at: new Date().toISOString(),
    creator: owner,
    party_a: owner,
    party_b: "0x" + "33".repeat(20),
    participant_count: 1,
    activity_starts_at: 1,
    round_window_seconds: 60,
    activity_ends_at: 2,
  };
  const method = product.id === "commitment-pools" ? "join" : "fund_agreement";
  const net = {
    coreAddress: core,
    captureAddress: capture,
    ownerAddress: owner,
    methods: () => ({ [method]: { readonly: false, params: ["id"] } }),
    read: async (method) =>
      method === product.listMethod
        ? { items: [value], total: 1 }
        : method === "get_config"
          ? { protocol_version: 3, max_source_bytes: 6000 }
          : method === "list_participants"
            ? {
                items: [{ address: owner, status: "active", rounds_passed: 0 }],
                total: 1,
              }
            : value,
    transaction: async () => null,
    invalidate: async () => {},
  };
  await syncDirectory(db, net);
  const results = await directory(db, "mixed case", "", "", 0, true);
  assert.equal(results.total, 1);
  assert.equal((await recordHistory(db, value.id)).observations.length, 1);
  assert.equal((await coverage(db)).complete, true);
  const overview = await ownerOverview(db);
  assert.equal(overview.records.length, 1);
  if (product.id === "commitment-pools")
    assert.ok(
      overview.queue.some((item) =>
        item.action.startsWith("Record missed round"),
      ),
    );
  checks.push("directory, numeric JSON queries and owner overview");

  const intent = await reserveIntent(db, net, "alice", {
    wallet: owner,
    target: core,
    method,
    args: [value.id],
    value: "1000",
  });
  assert.equal(typeof intent.created_at, "number");
  await assert.rejects(
    ownIntent(db, "bob", intent.id),
    (error) => error.status === 404,
  );
  await assert.rejects(
    reserveIntent(db, net, "alice", {
      wallet: owner,
      target: core,
      method,
      args: [value.id],
      value: "1000",
    }),
    (error) => error.status === 409,
  );
  await updateIntent(db, net, "alice", intent.id, {
    status: "rejected",
    error: "Verification only; no wallet transaction was sent.",
  });
  checks.push("durable request journal and duplicate guard");

  const challenge = await ownerChallenge(
    db,
    "alice",
    owner,
    "https://verification.example",
    owner,
  );
  const signature = await wallet.signMessage({ message: challenge.message });
  const cookie = await completeOwnerChallenge(
    db,
    "alice",
    challenge.id,
    signature,
    owner,
    true,
  );
  const req = new Request("https://verification.example/api/product/session", {
    headers: { cookie },
  });
  assert.equal(await ownerSession(db, req, "alice", owner), true);
  assert.equal(await ownerSession(db, req, "bob", owner), false);
  await assert.rejects(
    completeOwnerChallenge(db, "alice", challenge.id, signature, owner, true),
  );
  await logoutOwner(db, req, "alice");
  assert.equal(await ownerSession(db, req, "alice", owner), false);
  checks.push("signed owner session, replay protection and logout");

  const response = await handleProductRequest(
    new Request("https://verification.example/api/product/session", {
      headers: { "oai-authenticated-user-id": "bob" },
    }),
    db,
    net,
    () => "alice",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).preferences.timezone, "Europe/London");
  await cleanExpiredTransientRows(db, Date.now() + 120000);
  checks.push("authenticated identity adapter and maintenance");

  const browser = new AuthBrowser(db, "https://verification.example");
  await browser.login(loginAlice);
  const firstSession = browser.request("auth/session");
  assert.ok(await getWalletSession(db, firstSession));
  assert.equal(
    (await browser.api("preferences", { timezone: "Asia/Tokyo" })).status,
    200,
  );
  checks.push("real Postgres wallet signature and durable wallet identity");

  const signInChallenge = await browser.challenge(loginAlice);
  const signInInput = {
    id: signInChallenge.id,
    signature: await loginAlice.signMessage({
      message: signInChallenge.message,
    }),
  };
  const concurrent = await Promise.all([
    handleWalletAuth(
      browser.request("auth/verify", signInInput),
      db,
      product,
      browser.clientAddress,
    ),
    handleWalletAuth(
      browser.request("auth/verify", signInInput),
      db,
      product,
      browser.clientAddress,
    ),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 200).length, 1);
  assert.ok(concurrent.some((r) => [401, 409].includes(r.status)));
  browser.accept(concurrent.find((r) => r.status === 200));
  assert.equal(await getWalletSession(db, firstSession), null);
  checks.push("atomic concurrent nonce consumption and session rotation");

  const privateSession = browser.request("auth/session");
  await browser.login(loginBob);
  assert.equal(await getWalletSession(db, privateSession), null);
  assert.equal(
    (await (await browser.api("preferences")).json()).timezone,
    "UTC",
  );
  assert.equal(
    (
      await browser.api("preferences", undefined, {
        "x-product-wallet": loginAlice.address,
      })
    ).status,
    409,
  );
  assert.equal((await getPreferences(db, "alice")).timezone, "Europe/London");
  checks.push(
    "wallet switching, stale-tab rejection and legacy data preservation",
  );

  assert.equal((await browser.auth("sign-in/email", {})).status, 410);
  assert.equal(
    (await browser.auth("logout", {}, { origin: "https://other.example" }))
      .status,
    403,
  );
  const beforeLogout = browser.request("auth/session");
  assert.equal((await browser.auth("logout", {})).status, 200);
  assert.equal(await getWalletSession(db, beforeLogout), null);
  assert.equal((await browser.api("session")).status, 401);
  checks.push("retired email endpoints, CSRF defense and wallet logout");
} finally {
  if (created) {
    // This schema was created by this invocation and contains verification fixtures only.
    assert.match(schema, /^verification_[a-f0-9]{32}$/);
    await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
  }
}
console.log(
  JSON.stringify({
    product: product.id,
    passed: true,
    checks,
    temporarySchemaRemoved: true,
  }),
);
