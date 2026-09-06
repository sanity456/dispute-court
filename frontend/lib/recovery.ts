import { product } from "./product.ts";
import { productApi } from "./client.ts";
type Entry = { intentId: string; hash: string; at: number };
function storageKey(wallet: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet))
    throw new Error("Sign in with your wallet before recovering activity.");
  return product.id + ":emergency-hash-outbox:v2:" + wallet.toLowerCase();
}
function entries(wallet: string): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(wallet)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (v) =>
              typeof v.intentId === "string" &&
              /^0x[0-9a-f]{64}$/i.test(v.hash),
          )
          .slice(-30)
      : [];
  } catch {
    return [];
  }
}
export function rememberHash(intentId: string, hash: string, wallet: string) {
  // Only an emergency outbox. The authenticated server journal remains authoritative.
  // Legacy v1 entries are left untouched; their former account identity is not inferred.
  const list = entries(wallet).filter((e) => e.intentId !== intentId);
  list.push({ intentId, hash, at: Date.now() });
  try {
    localStorage.setItem(storageKey(wallet), JSON.stringify(list));
  } catch {
    /* The transaction hash is also returned by the wallet. */
  }
}
function forgetHash(intentId: string, wallet: string) {
  try {
    localStorage.setItem(
      storageKey(wallet),
      JSON.stringify(entries(wallet).filter((e) => e.intentId !== intentId)),
    );
  } catch {
    /* Retry is idempotent. */
  }
}
export async function saveSubmittedHash(
  intentId: string,
  hash: string,
  wallet: string,
) {
  rememberHash(intentId, hash, wallet);
  await productApi("intents/" + encodeURIComponent(intentId), { hash });
  forgetHash(intentId, wallet);
}
export async function recoverOutbox(wallet: string) {
  let recovered = 0;
  for (const entry of entries(wallet)) {
    try {
      await saveSubmittedHash(entry.intentId, entry.hash, wallet);
      recovered++;
    } catch {
      /* Never resend a transaction or attach a hash to a different wallet's journal. */
    }
  }
  return { recovered, pending: entries(wallet).length };
}
export function walletRejected(error: unknown): boolean {
  let value = error;
  for (
    let depth = 0;
    depth < 5 && value && typeof value === "object";
    depth++
  ) {
    if (Number((value as { code?: unknown }).code) === 4001) return true;
    value = (value as { cause?: unknown }).cause;
  }
  return false;
}

export function userFacingError(error: unknown): string {
  if (walletRejected(error))
    return "Wallet request cancelled. Nothing was sent.";
  return error instanceof Error ? error.message : String(error);
}
