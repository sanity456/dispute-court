import { verifyMessage } from "viem";
import type { Database } from "./database-types.ts";
import {
  ApiError,
  address,
  bodyJson,
  jsonResponse,
  rateLimit,
  sameOrigin,
  sha256,
  textField,
} from "./security.ts";
import { cleanExpiredTransientRows } from "./maintenance.ts";
import { limitWalletClient } from "./auth-client.ts";
import { logoutOwner } from "./owner-auth.ts";
import { product } from "../lib/product.ts";
import {
  CHALLENGE_TTL_MS,
  SESSION_TTL_MS,
  WALLET_CHAIN_ID,
  walletLoginMessage,
  walletUserId,
  type AuthProduct,
} from "../lib/wallet-auth-policy.ts";

type SessionRow = {
  user_id: string;
  address: string;
  origin: string;
  expires_at: number;
};
type ChallengeRow = {
  id: string;
  browser_hash: string;
  address: string;
  origin: string;
  message: string;
  issued_at: number;
  expires_at: number;
};
const TOKEN = /^[a-f0-9]{64}$/;
function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new ApiError(
      403,
      "Wallet sign-in requires a secure connection.",
      "secure_origin_required",
    );
  return url.origin;
}
export function walletCookieName(
  request: Request,
  kind: "session" | "login",
  app: AuthProduct = product,
) {
  return (
    (new URL(request.url).protocol === "https:" ? "__Host-" : "") +
    "wallet_" +
    kind +
    "_" +
    app.id.replaceAll("-", "_")
  );
}
function readCookie(request: Request, name: string) {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(name + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return TOKEN.test(value) ? value : null;
}
function cookie(
  request: Request,
  kind: "session" | "login",
  value: string,
  maxAge: number,
  app: AuthProduct,
) {
  return (
    walletCookieName(request, kind, app) +
    "=" +
    value +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
    maxAge +
    (new URL(request.url).protocol === "https:" ? "; Secure" : "")
  );
}
function withCookies(response: Response, cookies: string[]) {
  for (const value of cookies) response.headers.append("Set-Cookie", value);
  return response;
}
export async function getWalletSession(
  db: Database,
  request: Request,
  app: AuthProduct = product,
): Promise<SessionRow | null> {
  const origin = requestOrigin(request);
  const token = readCookie(request, walletCookieName(request, "session", app));
  if (!token) return null;
  const row = await db
    .prepare(
      "SELECT user_id,address,origin,expires_at FROM wallet_sessions WHERE token_hash=? AND origin=? AND expires_at>?",
    )
    .bind(await sha256(token), origin, Date.now())
    .first<SessionRow>();
  if (!row || row.user_id !== walletUserId(row.address, app)) return null;
  return row;
}
export async function authenticateWallet(
  db: Database,
  request: Request,
  app: AuthProduct = product,
) {
  const session = await getWalletSession(db, request, app);
  if (!session)
    throw new ApiError(
      401,
      "Sign in with your wallet to continue.",
      "sign_in_required",
    );
  return session.user_id;
}
export async function handleWalletAuth(
  request: Request,
  db: Database,
  app: AuthProduct = product,
  clientAddress?: string,
): Promise<Response> {
  try {
    const origin = requestOrigin(request);
    const path = new URL(request.url).pathname
      .replace(/^\/api\/auth\/?/, "")
      .replace(/\/$/, "");
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new ApiError(
        403,
        "This action must come from this product.",
        "origin_mismatch",
      );
    if (request.method !== "GET" && request.method !== "POST")
      throw new ApiError(405, "Method not allowed.");
    if (request.method === "POST") sameOrigin(request);
    if (!["session", "challenge", "verify", "logout"].includes(path))
      throw new ApiError(
        410,
        "This product now uses wallet-only sign-in.",
        "wallet_login_only",
      );
    if (path === "session" && request.method === "GET") {
      const session = await getWalletSession(db, request, app);
      return jsonResponse(
        session
          ? {
              authenticated: true,
              wallet: session.address,
              chainId: WALLET_CHAIN_ID,
              expiresAt: Number(session.expires_at),
            }
          : { authenticated: false },
      );
    }
    if (request.method !== "POST")
      throw new ApiError(405, "Use POST for this action.");
    const input = await bodyJson(request);
    if (path === "logout") {
      const token = readCookie(
        request,
        walletCookieName(request, "session", app),
      );
      if (token)
        await db
          .prepare(
            "DELETE FROM wallet_sessions WHERE token_hash=? AND origin=?",
          )
          .bind(await sha256(token), origin)
          .run();
      const binding = readCookie(
        request,
        walletCookieName(request, "login", app),
      );
      if (binding)
        await db
          .prepare(
            "DELETE FROM wallet_challenges WHERE browser_hash=? AND origin=?",
          )
          .bind(await sha256(binding), origin)
          .run();
      return withCookies(jsonResponse({ authenticated: false }), [
        cookie(request, "session", "", 0, app),
        cookie(request, "login", "", 0, app),
        await logoutOwner(db, request),
      ]);
    }
    if (path === "challenge") {
      const wallet = address(input.wallet);
      if (input.chainId !== WALLET_CHAIN_ID)
        throw new ApiError(
          400,
          "Use GenLayer Studionet for this product.",
          "wrong_chain",
        );
      await limitWalletClient(db, request, app.id, "challenge", clientAddress);
      // A single client cannot exhaust this circuit breaker. Invalid input
      // never reaches it, and it cannot block verification of an issued challenge.
      await rateLimit(db, "wallet-challenge-global:" + app.id, 300);
      await cleanExpiredTransientRows(db);
      const id = randomToken(),
        binding = randomToken(),
        issuedAt = Date.now(),
        expiresAt = issuedAt + CHALLENGE_TTL_MS;
      const message = walletLoginMessage(
        { wallet, origin, nonce: id, issuedAt, expiresAt },
        app,
      );
      await db
        .prepare(
          "INSERT INTO wallet_challenges(id,browser_hash,address,origin,message,issued_at,expires_at,used,attempts) VALUES(?,?,?,?,?,?,?,0,0)",
        )
        .bind(
          id,
          await sha256(binding),
          wallet,
          origin,
          message,
          issuedAt,
          expiresAt,
        )
        .run();
      return withCookies(
        jsonResponse({
          id,
          message,
          wallet,
          chainId: WALLET_CHAIN_ID,
          issuedAt,
          expiresAt,
        }),
        [cookie(request, "login", binding, CHALLENGE_TTL_MS / 1000, app)],
      );
    }
    if (path !== "verify") throw new ApiError(405, "Method not allowed.");
    const id = textField(input.id, "Challenge", 64),
      signature = textField(input.signature, "Signature", 132);
    const binding = readCookie(
      request,
      walletCookieName(request, "login", app),
    );
    if (!TOKEN.test(id) || !binding)
      throw new ApiError(
        401,
        "Start a new wallet sign-in in this browser.",
        "challenge_invalid",
      );
    await limitWalletClient(db, request, app.id, "verify", clientAddress);
    await cleanExpiredTransientRows(db);
    const browserHash = await sha256(binding);
    const challenge = await db
      .prepare(
        "UPDATE wallet_challenges SET attempts=attempts+1 WHERE id=? AND browser_hash=? AND origin=? AND used=0 AND expires_at>? AND attempts<5 RETURNING id,browser_hash,address,origin,message,issued_at,expires_at",
      )
      .bind(id, browserHash, origin, Date.now())
      .first<ChallengeRow>();
    if (!challenge)
      throw new ApiError(
        401,
        "This sign-in expired or was already used. Try again.",
        "challenge_invalid",
      );
    // Reconstruct the exact product-bound message. No caller-supplied message or identity is trusted.
    const expected = walletLoginMessage(
      {
        wallet: challenge.address,
        origin,
        nonce: id,
        issuedAt: Number(challenge.issued_at),
        expiresAt: Number(challenge.expires_at),
      },
      app,
    );
    let valid = false;
    if (
      challenge.message === expected &&
      /^0x[0-9a-fA-F]{130}$/.test(signature)
    ) {
      try {
        valid = await verifyMessage({
          address: challenge.address as `0x${string}`,
          message: expected,
          signature: signature as `0x${string}`,
        });
      } catch {
        valid = false;
      }
    }
    if (!valid)
      throw new ApiError(
        401,
        "The signature did not match this wallet sign-in.",
        "signature_invalid",
      );
    const consumed = await db
      .prepare(
        "UPDATE wallet_challenges SET used=1 WHERE id=? AND browser_hash=? AND origin=? AND used=0 AND expires_at>? RETURNING id",
      )
      .bind(id, browserHash, origin, Date.now())
      .first();
    if (!consumed)
      throw new ApiError(
        409,
        "This sign-in expired or was already used. Try again.",
        "challenge_invalid",
      );
    const token = randomToken(),
      userId = walletUserId(challenge.address, app),
      now = Date.now(),
      expiresAt = now + SESSION_TTL_MS;
    const oldToken = readCookie(
      request,
      walletCookieName(request, "session", app),
    );
    const statements = [
      db
        .prepare(
          "INSERT INTO wallet_sessions(token_hash,user_id,address,origin,created_at,expires_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          await sha256(token),
          userId,
          challenge.address,
          origin,
          now,
          expiresAt,
        ),
    ];
    if (oldToken)
      statements.push(
        db
          .prepare(
            "DELETE FROM wallet_sessions WHERE token_hash=? AND origin=?",
          )
          .bind(await sha256(oldToken), origin),
      );
    await db.batch(statements);
    return withCookies(
      jsonResponse({
        authenticated: true,
        wallet: challenge.address,
        chainId: WALLET_CHAIN_ID,
        expiresAt,
      }),
      [
        cookie(request, "session", token, SESSION_TTL_MS / 1000, app),
        cookie(request, "login", "", 0, app),
        await logoutOwner(db, request),
      ],
    );
  } catch (error) {
    if (!(error instanceof ApiError))
      console.error(
        "Wallet authentication unavailable:",
        error instanceof Error ? error.name : "UnknownError",
      );
    return jsonResponse(
      {
        error:
          error instanceof ApiError
            ? error.message
            : "Wallet sign-in is temporarily unavailable. Try again.",
        code: error instanceof ApiError ? error.code : "auth_unavailable",
      },
      error instanceof ApiError ? error.status : 503,
    );
  }
}
