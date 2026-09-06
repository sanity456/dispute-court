import { product } from "./product.ts";
import { productApi } from "./client.ts";
export type RecoveryEntry = { intentId: string; hash: string; at?: number };
function address(value: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value))
    throw new Error(
      "A verified wallet and contract are required for recovery.",
    );
  return value.toLowerCase();
}
function storageKey(wallet: string, core: string) {
  return (
    product.id +
    ":emergency-hash-outbox:v3:" +
    address(wallet) +
    ":" +
    address(core)
  );
}
function rawEntries(key: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function validEntry(value: unknown): value is RecoveryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RecoveryEntry>;
  return (
    typeof entry.intentId === "string" &&
    Boolean(entry.intentId) &&
    typeof entry.hash === "string" &&
    /^0x[0-9a-f]{64}$/i.test(entry.hash)
  );
}
export function deviceRecovery(wallet: string, core: string) {
  if (!wallet || !core) return { pending: [], legacy: [] };
  return {
    pending: (rawEntries(storageKey(wallet, core)) ?? []).filter(validEntry),
    // v1 has no wallet identity: never display or migrate it into a wallet account.
    // v2 has no contract identity: expose it separately, never automatically attach it.
    legacy: (
      rawEntries(product.id + ":emergency-hash-outbox:v2:" + address(wallet)) ??
      []
    ).filter(validEntry),
  };
}
export function rememberHash(
  intentId: string,
  hash: string,
  wallet: string,
  core: string,
) {
  // Only an emergency outbox. The authenticated server journal remains authoritative.
  // Never truncate older hashes or overwrite unreadable storage.
  const key = storageKey(wallet, core);
  const stored = rawEntries(key);
  if (!stored || !validEntry({ intentId, hash })) return;
  const list = stored.filter(
    (e) => !validEntry(e) || e.intentId !== intentId || e.hash !== hash,
  );
  list.push({ intentId, hash, at: Date.now() });
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* The transaction hash is also returned by the wallet. */
  }
}
function forgetHash(
  intentId: string,
  hash: string,
  wallet: string,
  core: string,
) {
  try {
    const key = storageKey(wallet, core);
    const stored = rawEntries(key);
    if (!stored) return;
    localStorage.setItem(
      key,
      JSON.stringify(
        stored.filter(
          (e) => !validEntry(e) || e.intentId !== intentId || e.hash !== hash,
        ),
      ),
    );
  } catch {
    /* Retry is idempotent. */
  }
}
export async function saveSubmittedHash(
  intentId: string,
  hash: string,
  wallet: string,
  core: string,
) {
  rememberHash(intentId, hash, wallet, core);
  await productApi("intents/" + encodeURIComponent(intentId), { hash });
  forgetHash(intentId, hash, wallet, core);
}
export async function recoverOutbox(wallet: string, core: string) {
  let recovered = 0;
  for (const entry of deviceRecovery(wallet, core).pending) {
    try {
      await saveSubmittedHash(entry.intentId, entry.hash, wallet, core);
      recovered++;
    } catch {
      /* Never resend a transaction or attach a hash to a different wallet's journal. */
    }
  }
  return { recovered, pending: deviceRecovery(wallet, core).pending.length };
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
