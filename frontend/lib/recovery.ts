import { product } from "./product.ts";
import { productApi } from "./client.ts";
const key = product.id + ":emergency-hash-outbox:v1";
type Entry = { intentId: string; hash: string; at: number };
function entries(): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
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
export function rememberHash(intentId: string, hash: string) {
  // Device-local emergency outbox only. D1 is the authoritative journal.
  const list = entries().filter((e) => e.intentId !== intentId);
  list.push({ intentId, hash, at: Date.now() });
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* Hash remains visible in the pending notice. */
  }
}
function forgetHash(intentId: string) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(entries().filter((e) => e.intentId !== intentId)),
    );
  } catch {
    /* Retry is idempotent. */
  }
}
export async function saveSubmittedHash(intentId: string, hash: string) {
  rememberHash(intentId, hash);
  await productApi("intents/" + encodeURIComponent(intentId), { hash });
  forgetHash(intentId);
}
export async function recoverOutbox() {
  let recovered = 0;
  for (const entry of entries()) {
    try {
      await saveSubmittedHash(entry.intentId, entry.hash);
      recovered++;
    } catch {
      /* Never resend a transaction or attach a hash to another account's journal. */
    }
  }
  return { recovered, pending: entries().length };
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
