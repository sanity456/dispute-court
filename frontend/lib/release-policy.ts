export const SECURITY_PROTOCOL_VERSION = 3;
export const SECURITY_EVIDENCE_BYTES = 6000;
const recoveryMethods = new Set([
  "withdraw",
  "claim_formation_refund",
  "activate_pool",
  "mark_missed_round",
  "settle",
  "cancel_expired_agreement",
  "release_to_party_b",
  "refund_to_party_a",
  "resolve_no_show",
]);
export function isRecoveryMethod(method: string) {
  return recoveryMethods.has(method);
}
export function isSecurityRelease(value: unknown): boolean {
  const config =
    value instanceof Map
      ? Object.fromEntries(value)
      : (value as Record<string, unknown> | null);
  return Boolean(
    config &&
    Number(config.protocol_version) === SECURITY_PROTOCOL_VERSION &&
    Number(config.max_source_bytes) === SECURITY_EVIDENCE_BYTES,
  );
}
