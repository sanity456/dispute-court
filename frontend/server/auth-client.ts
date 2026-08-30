import { isIP } from "node:net";
import { ApiError, rateLimit, sha256 } from "./security.ts";
import type { Database } from "./database-types.ts";

// Only hosting infrastructure, never a caller's arbitrary forwarding header,
// supplies a client address. Unknown production hosts fail closed.
export function trustedClientAddress(request: Request): string {
  if (process.env.VERCEL === "1") {
    return request.headers.get("x-vercel-forwarded-for") ?? "";
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  ) {
    return request.headers.get("cf-connecting-ip") ?? "";
  }
  const url = new URL(request.url);
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    return "127.0.0.1";
  }
  return "";
}

export function clientNetwork(address: string): string {
  const kind = isIP(address);
  if (!kind || address !== address.trim()) {
    throw new ApiError(
      503,
      "Wallet sign-in is temporarily unavailable.",
      "client_identity_unavailable",
    );
  }
  if (kind === 4) return address;
  // Canonicalize IPv6 and rate-limit the /64, not a freely rotated interface ID.
  const host = new URL("http://[" + address + "]/").hostname
    .slice(1, -1)
    .toLowerCase();
  const [left, right] = host.split("::");
  const before = left ? left.split(":") : [];
  const after = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? before
      : [
          ...before,
          ...Array(8 - before.length - after.length).fill("0"),
          ...after,
        ];
  if (
    groups.slice(0, 5).every((group) => parseInt(group, 16) === 0) &&
    parseInt(groups[5], 16) === 65535
  ) {
    const high = parseInt(groups[6], 16),
      low = parseInt(groups[7], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return (
    groups
      .slice(0, 4)
      .map((group) => parseInt(group, 16).toString(16))
      .join(":") + "::/64"
  );
}

export async function limitWalletClient(
  db: Database,
  request: Request,
  appId: string,
  action: "challenge" | "verify",
  clientAddress = trustedClientAddress(request),
) {
  const network = clientNetwork(clientAddress);
  // Keep raw IPs out of persistent rate keys, and rotate their digest daily.
  const key = await sha256(
    appId + ":" + Math.floor(Date.now() / 86400000) + ":" + network,
  );
  const prefix = "wallet-client:" + appId + ":" + action + ":" + key;
  await rateLimit(db, prefix, action === "challenge" ? 20 : 100);
  await rateLimit(
    db,
    prefix + ":hour",
    action === "challenge" ? 120 : 600,
    3600000,
  );
}
