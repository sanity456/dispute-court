import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { walletLoginMessage } from "../lib/wallet-auth-policy.ts";
import { product } from "../lib/product.ts";

// Synthetic message signatures only: no transaction, seed import, or durable user-data writes.
export async function runHostedWalletChecks(origin, fetcher = fetch) {
  const results = [],
    cookies = new Map();
  const account = privateKeyToAccount(generatePrivateKey());
  const other = privateKeyToAccount(generatePrivateKey());
  const wallet = account.address.toLowerCase();
  const cookieHeader = () =>
    [...cookies].map(([key, value]) => key + "=" + value).join("; ");
  const accept = (response) => {
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(";")[0],
        at = pair.indexOf("=");
      if (pair.slice(at + 1))
        cookies.set(pair.slice(0, at), pair.slice(at + 1));
      else cookies.delete(pair.slice(0, at));
    }
  };
  async function request(path, input, extra = {}) {
    assert.ok(path.startsWith("/") && !path.startsWith("//"));
    const response = await fetcher(origin + path, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        cookie: cookieHeader(),
        ...(input === undefined
          ? {}
          : { origin, "content-type": "application/json" }),
        ...extra,
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
    });
    accept(response);
    return response;
  }
  async function jsonCheck(label, path, expectedStatus, input, extra) {
    const response = await request(path, input, extra);
    assert.equal(response.status, expectedStatus, label + " status");
    const body = await response.json();
    results.push(label);
    return { response, body };
  }
  try {
    const signin = await request("/auth/sign-in");
    assert.equal(signin.status, 200);
    const html = await signin.text();
    assert.ok(
      html.includes("Your wallet is your account.") &&
        html.includes("Sign in with wallet"),
    );
    assert.ok(
      !/type="(?:email|password)"|name="(?:email|password)"/i.test(html),
    );
    results.push("wallet-only sign-in page");
    for (const path of [
      "/auth/sign-up",
      "/auth/forgot-password",
      "/auth/reset-password",
    ]) {
      const response = await request(path);
      const body = await response.text();
      if ([307, 308].includes(response.status))
        assert.equal(
          new URL(response.headers.get("location"), origin).pathname,
          "/auth/sign-in",
        );
      else {
        assert.equal(response.status, 200);
        assert.ok(
          body.includes("/auth/sign-in") &&
            /NEXT_REDIRECT|http-equiv="refresh"/.test(body),
        );
      }
      assert.ok(!/type="(?:email|password)"/i.test(body));
    }
    results.push("retired account pages redirect to wallet sign-in");
    assert.equal(
      (await jsonCheck("anonymous wallet session", "/api/auth/session", 200))
        .body.authenticated,
      false,
    );
    await jsonCheck(
      "anonymous product data denied",
      "/api/product/session",
      401,
    );
    await jsonCheck(
      "spoofed identity denied",
      "/api/product/session",
      401,
      undefined,
      { "oai-authenticated-user-id": "forged", "x-product-wallet": wallet },
    );
    for (const path of [
      "sign-in/email",
      "sign-up/email",
      "request-password-reset",
      "reset-password",
    ])
      assert.equal(
        (await jsonCheck("retired API " + path, "/api/auth/" + path, 410, {}))
          .body.code,
        "wallet_login_only",
      );
    await jsonCheck(
      "cross-origin challenge denied",
      "/api/auth/challenge",
      403,
      { wallet, chainId: 61999 },
      { origin: "https://other.example" },
    );
    await jsonCheck("wrong chain denied", "/api/auth/challenge", 400, {
      wallet,
      chainId: 1,
    });
    const { response: challengeResponse, body: challenge } = await jsonCheck(
      "fresh wallet challenge",
      "/api/auth/challenge",
      200,
      { wallet, chainId: 61999 },
    );
    assert.equal(
      challenge.message,
      walletLoginMessage({
        wallet,
        origin,
        nonce: challenge.id,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
      }),
    );
    assert.ok(
      challengeResponse.headers
        .getSetCookie()
        .some(
          (v) =>
            /wallet_login_/.test(v) &&
            /HttpOnly/.test(v) &&
            /SameSite=Strict/.test(v),
        ),
    );
    const binding = cookieHeader();
    const signature = await account.signMessage({ message: challenge.message });
    await jsonCheck(
      "signature from another wallet denied",
      "/api/auth/verify",
      401,
      {
        id: challenge.id,
        signature: await other.signMessage({ message: challenge.message }),
      },
    );
    await jsonCheck(
      "redemption without browser binding denied",
      "/api/auth/verify",
      401,
      { id: challenge.id, signature },
      { cookie: "" },
    );
    const { response: verified, body: session } = await jsonCheck(
      "signed wallet login",
      "/api/auth/verify",
      200,
      { id: challenge.id, signature },
    );
    assert.equal(session.wallet, wallet);
    assert.equal(session.authenticated, true);
    assert.equal(session.chainId, 61999);
    const sessionCookie = verified.headers
      .getSetCookie()
      .find((v) => /wallet_session_/.test(v));
    assert.ok(
      sessionCookie &&
        /HttpOnly/.test(sessionCookie) &&
        /SameSite=Strict/.test(sessionCookie) &&
        !/Domain=/.test(sessionCookie),
    );
    if (origin.startsWith("https:"))
      assert.ok(
        sessionCookie.startsWith("__Host-") && /; Secure/.test(sessionCookie),
      );
    const token = sessionCookie.split(";")[0].split("=")[1];
    assert.ok(!JSON.stringify(session).includes(token));
    const { body: accountSession } = await jsonCheck(
      "authenticated wallet data",
      "/api/product/session",
      200,
      undefined,
      { "x-product-wallet": wallet },
    );
    assert.equal(accountSession.wallet, wallet);
    assert.equal(accountSession.authMethod, "wallet");
    assert.equal(accountSession.ownerVerified, false);
    assert.equal(
      (await jsonCheck("wallet session restores", "/api/auth/session", 200))
        .body.wallet,
      wallet,
    );
    assert.equal(
      (
        await jsonCheck(
          "new wallet has separate history",
          "/api/product/activity",
          200,
        )
      ).body.items.length,
      0,
    );
    await jsonCheck(
      "normal wallet cannot use owner tools",
      "/api/product/owner/overview",
      403,
    );
    await jsonCheck(
      "stale wallet tab denied",
      "/api/product/session",
      409,
      undefined,
      { "x-product-wallet": other.address },
    );
    await jsonCheck(
      "nonce replay denied",
      "/api/auth/verify",
      401,
      { id: challenge.id, signature },
      { cookie: binding },
    );
    // An error response must not remove the existing session cookie.
    assert.equal(
      (
        await jsonCheck(
          "session survives rejected replay",
          "/api/auth/session",
          200,
        )
      ).body.wallet,
      wallet,
    );
    await jsonCheck(
      "cross-origin logout denied",
      "/api/auth/logout",
      403,
      {},
      { origin: "https://other.example" },
    );
    const oldCookie = cookieHeader();
    await jsonCheck("wallet logout", "/api/auth/logout", 200, {});
    assert.equal(
      (await jsonCheck("session ends on logout", "/api/auth/session", 200)).body
        .authenticated,
      false,
    );
    await jsonCheck(
      "revoked token cannot read data",
      "/api/product/session",
      401,
      undefined,
      { cookie: oldCookie },
    );
    return {
      product: product.id,
      origin,
      checks: results,
      passed: true,
      transactionSent: false,
    };
  } finally {
    // Only this invocation's synthetic browser credentials are present in this jar.
    if (cookies.size) await request("/api/auth/logout", {}).catch(() => {});
  }
}
