import deployment from "./deployment.json" with { type: "json" };

export const SECURITY_PROTOCOL_VERSION = deployment.protocolVersion;
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
export function isSecurityRelease(
  value: unknown,
  expectedVersion = SECURITY_PROTOCOL_VERSION,
): boolean {
  const config =
    value instanceof Map
      ? Object.fromEntries(value)
      : (value as Record<string, unknown> | null);
  return Boolean(
    config &&
    [4, 5].includes(expectedVersion) &&
    Number(config.protocol_version) === expectedVersion &&
    Number(config.max_source_bytes) === SECURITY_EVIDENCE_BYTES,
  );
}
