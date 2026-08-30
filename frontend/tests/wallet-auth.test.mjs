import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalDatabase } from "../server/database.local.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import {
  handleWalletAuth,
  getWalletSession,
  authenticateWallet,
  walletCookieName,
} from "../server/wallet-auth.ts";
import {
  ownerChallenge,
  completeOwnerChallenge,
  ownerSession,
} from "../server/owner-auth.ts";
import { cleanExpiredTransientRows } from "../server/maintenance.ts";
import { sha256 } from "../server/security.ts";
import {
  walletLoginMessage,
  walletUserId,
  CHALLENGE_TTL_MS,
} from "../lib/wallet-auth-policy.ts";
import { product } from "../lib/product.ts";
import { AuthBrowser, alice, bob, net } from "./wallet-auth-helpers.mjs";
async function database(t) {
  const db = createLocalDatabase(":memory:");
  t.after(() => db.close());
  for (const file of [
    "0000_product_base.sql",
    "0001_transaction_args.sql",
    "0002_wallet_auth.sql",
  ]) {
    await db.batch(
      schemaStatements(
        readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"),
      ).map((s) => db.prepare(s)),
    );
  }
  return db;
}
test("Wallet login verifies an origin-bound SIWE message and stores only a hashed session token", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  const challenge = await browser.challenge();
  assert.equal(
    challenge.message,
    walletLoginMessage({
      wallet: alice.address,
      origin: browser.origin,
      nonce: challenge.id,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
    }),
  );
  assert.equal(challenge.expiresAt - challenge.issuedAt, CHALLENGE_TTL_MS);
  const bindingName = walletCookieName(
    browser.request("auth/session"),
    "login",
  );
  assert.match(bindingName, /^__Host-wallet_login_/);
  const signature = await alice.signMessage({ message: challenge.message });
  const response = await browser.auth("verify", {
    id: challenge.id,
    signature,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const cookies = response.headers.getSetCookie();
  assert.ok(
    cookies.every(
      (v) =>
        v.includes("HttpOnly") &&
        v.includes("Secure") &&
        v.includes("Path=/") &&
        v.includes("SameSite=Strict") &&
        !v.includes("Domain="),
    ),
  );
  assert.equal(browser.cookies.has(bindingName), false);
  const session = await getWalletSession(db, browser.request("auth/session"));
  assert.equal(session.user_id, walletUserId(alice.address));
  const stored = (await db.prepare("SELECT * FROM wallet_sessions").all())
    .results;
  assert.equal(stored.length, 1);
  const token = browser.cookies.get(
    walletCookieName(browser.request("auth/session"), "session"),
  );
  assert.equal(stored[0].token_hash, await sha256(token));
  assert.ok(!JSON.stringify(stored).includes(token));
  const body = await (await browser.api("session")).json();
  assert.equal(body.wallet, alice.address.toLowerCase());
  assert.equal(body.authMethod, "wallet");
  assert.equal(body.ownerVerified, false);
});
test("Addresses, old provider cookies and spoofed identity headers cannot authenticate", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  const request = browser.request("auth/session", undefined, {
    "oai-authenticated-user-id": "owner",
    "x-product-wallet": alice.address,
    cookie:
      "neon-auth.session_token=fake; better-auth.session_token=fake; __Host-wallet_session_" +
      product.id.replaceAll("-", "_") +
      "=" +
      "ab".repeat(32),
  });
  assert.equal(await getWalletSession(db, request), null);
  await assert.rejects(
    authenticateWallet(db, request),
    (e) => e.status === 401,
  );
  assert.deepEqual(await (await handleWalletAuth(request, db)).json(), {
    authenticated: false,
  });
  assert.equal((await browser.api("operator")).status, 401);
});
test("Challenge creation validates origin, Fetch Metadata, secure transport, wallet, chain and body size", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db),
    input = { wallet: alice.address, chainId: 61999 };
  for (const headers of [
    { origin: "https://evil.example" },
    { "sec-fetch-site": "cross-site" },
    { origin: "" },
  ])
    assert.equal((await browser.auth("challenge", input, headers)).status, 403);
  assert.equal(
    (await browser.auth("challenge", { ...input, chainId: 1 })).status,
    400,
  );
  assert.equal(
    (
      await browser.auth("challenge", {
        ...input,
        wallet: "0x" + "00".repeat(20),
      })
    ).status,
    400,
  );
  assert.equal(
    (await browser.auth("challenge", { ...input, padding: "x".repeat(33000) }))
      .status,
    413,
  );
  const insecure = new AuthBrowser(db, "http://wallet.example");
  assert.equal((await insecure.auth("challenge", input)).status, 403);
  const local = new AuthBrowser(db, "http://localhost:4185");
  assert.equal((await local.auth("challenge", input)).status, 200);
  assert.ok(
    [...local.cookies.keys()].every((key) => !key.startsWith("__Host-")),
  );
});
test("A signature from the wrong wallet or over a changed message is rejected", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db),
    challenge = await browser.challenge();
  for (const signature of [
    await bob.signMessage({ message: challenge.message }),
    await alice.signMessage({
      message: challenge.message + "\ntransfer all funds",
    }),
    "0x" + "00".repeat(65),
  ]) {
    const response = await browser.auth("verify", {
      id: challenge.id,
      signature,
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "signature_invalid");
  }
  assert.equal(
    (await db.prepare("SELECT * FROM wallet_sessions").all()).results.length,
    0,
  );
});
test("A challenge cannot be redeemed from another browser, origin or product", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db),
    challenge = await browser.challenge();
  const input = {
    id: challenge.id,
    signature: await alice.signMessage({ message: challenge.message }),
  };
  assert.equal((await new AuthBrowser(db).auth("verify", input)).status, 401);
  const foreignOrigin = new AuthBrowser(db, "https://other.example");
  foreignOrigin.cookies = new Map(browser.cookies);
  assert.equal((await foreignOrigin.auth("verify", input)).status, 401);
  const app =
    product.id === "commitment-pools"
      ? { id: "dispute-court", name: "Dispute Court" }
      : { id: "commitment-pools", name: "Commitment Pools" };
  const foreignProduct = new AuthBrowser(db, browser.origin, app);
  const binding = [...browser.cookies.values()][0];
  foreignProduct.cookies.set(
    walletCookieName(foreignProduct.request("auth/session"), "login", app),
    binding,
  );
  assert.equal((await foreignProduct.auth("verify", input)).status, 401);
  assert.equal((await browser.auth("verify", input)).status, 200);
});
test("Concurrent verification has one winner and nonce replay never creates another session", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db),
    challenge = await browser.challenge();
  const input = {
    id: challenge.id,
    signature: await alice.signMessage({ message: challenge.message }),
  };
  const requests = [
    browser.request("auth/verify", input),
    browser.request("auth/verify", input),
  ];
  const results = await Promise.all(
    requests.map((r) =>
      handleWalletAuth(r, db, product, browser.clientAddress),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.some((r) => [401, 409].includes(r.status)));
  assert.equal(
    (
      await handleWalletAuth(
        browser.request("auth/verify", input),
        db,
        product,
        browser.clientAddress,
      )
    ).status,
    401,
  );
  assert.equal(
    (await db.prepare("SELECT * FROM wallet_sessions").all()).results.length,
    1,
  );
});
test("Expired challenges and sessions fail closed; failed signature attempts are bounded", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  let challenge = await browser.challenge();
  await db
    .prepare("UPDATE wallet_challenges SET expires_at=0 WHERE id=?")
    .bind(challenge.id)
    .run();
  assert.equal(
    (
      await browser.auth("verify", {
        id: challenge.id,
        signature: await alice.signMessage({ message: challenge.message }),
      })
    ).status,
    401,
  );
  challenge = await browser.challenge();
  const wrong = await bob.signMessage({ message: challenge.message });
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await browser.auth("verify", { id: challenge.id, signature: wrong }))
        .status,
      401,
    );
  assert.equal(
    (
      await browser.auth("verify", {
        id: challenge.id,
        signature: await alice.signMessage({ message: challenge.message }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT attempts FROM wallet_challenges WHERE id=?")
        .bind(challenge.id)
        .first()
    ).attempts,
    5,
  );
  await browser.login();
  await db.prepare("UPDATE wallet_sessions SET expires_at=0").run();
  assert.equal(
    await getWalletSession(db, browser.request("auth/session")),
    null,
  );
});
test("Wallet switches rotate sessions without merging or deleting private or legacy records", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  await db
    .prepare("INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)")
    .bind("neon:legacy-account", '{"timezone":"Asia/Tokyo"}', Date.now())
    .run();
  await browser.login(alice);
  const oldRequest = browser.request("auth/session");
  assert.equal(
    (await browser.api("preferences", { timezone: "Europe/London" })).status,
    200,
  );
  assert.equal(
    (
      await browser.api("support", {
        category: "feedback",
        body: "Alice's private test support.",
      })
    ).status,
    201,
  );
  await browser.login(bob);
  assert.equal(await getWalletSession(db, oldRequest), null);
  assert.equal(
    (await (await browser.api("preferences")).json()).timezone,
    "UTC",
  );
  assert.equal((await (await browser.api("support")).json()).items.length, 0);
  assert.equal(
    (
      await browser.api("session", undefined, {
        "x-product-wallet": alice.address,
      })
    ).status,
    409,
  );
  assert.equal(
    (await browser.api("intents", { wallet: alice.address })).status,
    403,
  );
  assert.equal(
    (await browser.api("owner/challenge", { wallet: alice.address })).status,
    403,
  );
  await browser.login(alice);
  assert.equal(
    (await (await browser.api("preferences")).json()).timezone,
    "Europe/London",
  );
  assert.equal((await (await browser.api("support")).json()).items.length, 1);
  assert.ok(
    await db
      .prepare("SELECT user_id FROM preferences WHERE user_id=?")
      .bind("neon:legacy-account")
      .first(),
  );
});
test("Logout revokes the current primary and owner sessions without deleting history", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  await browser.login();
  const userId = walletUserId(alice.address),
    owner = alice.address.toLowerCase();
  const challenge = await ownerChallenge(
    db,
    userId,
    owner,
    browser.origin,
    owner,
  );
  const cookie = await completeOwnerChallenge(
    db,
    userId,
    challenge.id,
    await alice.signMessage({ message: challenge.message }),
    owner,
    true,
  );
  const response = new Response();
  response.headers.append("set-cookie", cookie);
  browser.accept(response);
  const oldRequest = browser.request("auth/session");
  assert.equal(await ownerSession(db, oldRequest, userId, owner), true);
  await browser.api("preferences", { timezone: "Europe/London" });
  assert.equal(
    (await browser.auth("logout", {}, { origin: "https://evil.example" }))
      .status,
    403,
  );
  assert.equal((await browser.auth("logout")).status, 405);
  assert.ok(await getWalletSession(db, oldRequest));
  const logout = await browser.auth("logout", {});
  assert.equal(logout.status, 200);
  assert.equal(browser.cookies.size, 0);
  assert.equal(await getWalletSession(db, oldRequest), null);
  assert.equal(await ownerSession(db, oldRequest, userId, owner), false);
  assert.ok(
    await db
      .prepare("SELECT * FROM preferences WHERE user_id=?")
      .bind(userId)
      .first(),
  );
});
test("A wallet login session can never be replayed as owner proof", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  await browser.login();
  const token = [...browser.cookies.values()][0];
  browser.cookies.set(
    "owner_session_" + product.id.replaceAll("-", "_"),
    token,
  );
  assert.equal(
    await ownerSession(
      db,
      browser.request("auth/session"),
      walletUserId(alice.address),
      net.ownerAddress,
    ),
    false,
  );
  assert.equal((await browser.api("owner/overview")).status, 403);
});
test("Session cookies are origin/product bound and ambiguous duplicate cookies are rejected", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  await browser.login();
  assert.equal(
    await getWalletSession(
      db,
      browser.request("auth/session", undefined, {
        cookie: browser.cookie() + "; " + browser.cookie(),
      }),
    ),
    null,
  );
  const foreign = new AuthBrowser(db, "https://other.example");
  foreign.cookies = new Map(browser.cookies);
  assert.equal(
    await getWalletSession(db, foreign.request("auth/session")),
    null,
  );
  const app = {
    id:
      product.id === "commitment-pools" ? "dispute-court" : "commitment-pools",
    name: "Other product",
  };
  const other = new AuthBrowser(db, browser.origin, app);
  other.cookies.set(
    walletCookieName(other.request("auth/session"), "session", app),
    [...browser.cookies.values()][0],
  );
  assert.equal(
    await getWalletSession(db, other.request("auth/session"), app),
    null,
  );
});
test("Old email, registration and password endpoints are permanently inactive", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  for (const path of [
    "sign-in/email",
    "sign-up/email",
    "request-password-reset",
    "reset-password",
    "get-session",
    "callback/google",
  ]) {
    for (const input of [undefined, {}]) {
      const response = await browser.auth(path, input);
      assert.equal(response.status, 410);
      assert.equal((await response.json()).code, "wallet_login_only");
    }
  }
});
test("Challenge rate limits are enforced and expiry cleanup never removes durable account records", async (t) => {
  const db = await database(t),
    browser = new AuthBrowser(db);
  for (let i = 0; i < 20; i++) await browser.challenge();
  assert.equal(
    (await browser.auth("challenge", { wallet: alice.address, chainId: 61999 }))
      .status,
    429,
  );
  browser.clientAddress = "203.0.113.11";
  await browser.login(bob);
  await browser.api("preferences", { timezone: "Europe/London" });
  await db.prepare("UPDATE wallet_challenges SET expires_at=0").run();
  await db.prepare("UPDATE wallet_sessions SET expires_at=0").run();
  await cleanExpiredTransientRows(db, Date.now() + 301000);
  assert.equal(
    (await db.prepare("SELECT * FROM wallet_challenges").all()).results.length,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT * FROM wallet_sessions").all()).results.length,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT * FROM preferences").all()).results.length,
    1,
  );
});
