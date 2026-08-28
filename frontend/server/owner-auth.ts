import { verifyMessage } from "viem";
import type { Database } from "./database-types";
import { ApiError, address, sha256, textField } from "./security.ts";
import { product } from "../lib/product.ts";
const COOKIE = "owner_session_" + product.id.replaceAll("-", "_");
export async function ownerChallenge(
  db: Database,
  userId: string,
  wallet: string,
  origin: string,
  owner: string,
) {
  if (address(wallet) !== owner)
    throw new ApiError(
      403,
      "Use the deployed contract owner wallet for owner access.",
    );
  const id = crypto.randomUUID(),
    expires = Date.now() + 300000;
  const message = [
    product.name + " owner access",
    "Origin: " + origin,
    "Network: GenLayer Studionet (61999)",
    "Wallet: " + owner,
    "Nonce: " + id,
    "Expires: " + new Date(expires).toISOString(),
    "This signs in to support and service controls only. It does not authorize transfers or change contract terms.",
  ].join("\n");
  await db
    .prepare(
      "INSERT INTO challenges(id,user_id,address,message,expires_at,used) VALUES(?,?,?,?,?,0)",
    )
    .bind(id, userId, owner, message, expires)
    .run();
  return { id, message, expiresAt: expires };
}
export async function completeOwnerChallenge(
  db: Database,
  userId: string,
  id: string,
  signature: string,
  owner: string,
  secure: boolean,
) {
  const challenge = await db
    .prepare(
      "SELECT * FROM challenges WHERE id=? AND user_id=? AND used=0 AND expires_at>?",
    )
    .bind(id, userId, Date.now())
    .first<{ address: string; message: string }>();
  if (!challenge || challenge.address !== owner)
    throw new ApiError(403, "Owner challenge expired or was already used.");
  if (
    !/^0x[0-9a-fA-F]{130}$/.test(signature) ||
    !(await verifyMessage({
      address: owner as `0x${string}`,
      message: challenge.message,
      signature: signature as `0x${string}`,
    }))
  )
    throw new ApiError(403, "The signature did not match the owner wallet.");
  const consumed = await db
    .prepare(
      "UPDATE challenges SET used=1 WHERE id=? AND user_id=? AND used=0 AND expires_at>? RETURNING id",
    )
    .bind(id, userId, Date.now())
    .first();
  if (!consumed) throw new ApiError(409, "This challenge was already used.");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  await db
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,address,expires_at) VALUES(?,?,?,?)",
    )
    .bind(await sha256(token), userId, owner, Date.now() + 28800000)
    .run();
  return (
    COOKIE +
    "=" +
    token +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800" +
    (secure ? "; Secure" : "")
  );
}
export async function ownerSession(
  db: Database,
  request: Request,
  userId: string,
  owner: string,
) {
  const token = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await db
    .prepare(
      "SELECT address FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?",
    )
    .bind(await sha256(token), userId, Date.now())
    .first<{ address: string }>();
  return row?.address === owner;
}
export async function requireOwner(
  db: Database,
  request: Request,
  userId: string,
  owner: string,
) {
  if (!(await ownerSession(db, request, userId, owner)))
    throw new ApiError(
      403,
      "Verify your owner wallet before using private owner controls.",
      "owner_required",
    );
}
export async function logoutOwner(
  db: Database,
  request: Request,
  userId: string,
) {
  const token = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (token)
    await db
      .prepare("DELETE FROM sessions WHERE token_hash=? AND user_id=?")
      .bind(await sha256(token), userId)
      .run();
  return (
    COOKIE +
    "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
    (new URL(request.url).protocol === "https:" ? "; Secure" : "")
  );
}
export function ownerSignatureInput(input: Record<string, unknown>) {
  return {
    id: textField(input.id, "Challenge", 80),
    signature: textField(input.signature, "Signature", 132),
  };
}
