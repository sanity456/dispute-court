export type Agreement = {
  protocol_version: number;
  id: string;
  title: string;
  party_a: string;
  party_b: string;
  amount_wei: string;
  status: string;
  fee_bps: number;
  acceptance_deadline: number;
  funding_deadline: number;
  performance_due_at: number;
  response_deadline: number;
  evidence_deadline: number;
  resolution_deadline: number;
  resolution_window_seconds: number;
  max_source_bytes: number;
  terms_hash: string;
  summary: string;
  criteria: string;
  party_a_ready: boolean;
  party_b_ready: boolean;
  dispute_opener: string;
  dispute_responder: string;
  opening_claim: string;
  response: string;
  accepted_at: string;
  funded_at: string;
  resolved_at: string;
  created_at: string;
  reopen_count: number;
  resolution_attempt_count: number;
  evidence: Record<string, unknown>[];
  last_source_observations: Record<string, unknown>[];
  verdict: Record<string, unknown>;
  paid: Record<string, unknown>;
  response_window_seconds: number;
  evidence_window_seconds: number;
  funding_window_seconds: number;
  performance_window_seconds: number;
};
export function record(value: unknown): Record<string, unknown> {
  if (value instanceof Map) return Object.fromEntries(value);
  return (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
}
export function normalizeAgreement(value: unknown): Agreement {
  const a = record(value);
  const strings = [
    "id",
    "title",
    "party_a",
    "party_b",
    "amount_wei",
    "status",
    "terms_hash",
    "summary",
    "criteria",
    "dispute_opener",
    "dispute_responder",
    "opening_claim",
    "response",
    "accepted_at",
    "funded_at",
    "resolved_at",
    "created_at",
  ];
  const numbers = [
    "protocol_version",
    "resolution_deadline",
    "resolution_window_seconds",
    "max_source_bytes",
    "fee_bps",
    "acceptance_deadline",
    "funding_deadline",
    "performance_due_at",
    "response_deadline",
    "evidence_deadline",
    "reopen_count",
    "resolution_attempt_count",
    "response_window_seconds",
    "evidence_window_seconds",
    "funding_window_seconds",
    "performance_window_seconds",
  ];
  const result: Record<string, unknown> = {};
  for (const key of strings)
    result[key] = String(a[key] ?? (key === "amount_wei" ? "0" : ""));
  for (const key of numbers) result[key] = Number(a[key] ?? 0);
  result.party_a_ready = Boolean(a.party_a_ready);
  result.party_b_ready = Boolean(a.party_b_ready);
  result.evidence = Array.isArray(a.evidence) ? a.evidence.map(record) : [];
  result.last_source_observations = Array.isArray(a.last_source_observations)
    ? a.last_source_observations.map(record)
    : [];
  result.verdict = record(a.verdict);
  result.paid = record(a.paid);
  return result as Agreement;
}
export function agreementRole(agreement: Agreement, wallet: string) {
  if (!wallet) return "visitor";
  if (wallet.toLowerCase() === agreement.party_a.toLowerCase())
    return "party_a";
  if (wallet.toLowerCase() === agreement.party_b.toLowerCase())
    return "party_b";
  return "visitor";
}
export function agreementActions(a: Agreement, wallet: string, now: number) {
  const role = agreementRole(a, wallet);
  const isA = role === "party_a";
  const isB = role === "party_b";
  const party = isA || isB;
  const connected = Boolean(wallet);
  const timedOut =
    a.protocol_version >= 3 &&
    a.resolution_deadline > 0 &&
    now >= a.resolution_deadline;
  const evidenceOpen =
    a.status === "evidence" && now < a.evidence_deadline && !timedOut;
  const cooperative =
    a.status === "funded" ||
    (a.protocol_version >= 3 &&
      [
        "awaiting_response",
        "evidence",
        "ready_for_resolution",
        "resolution_stalled",
      ].includes(a.status));
  return {
    accept:
      isB && a.status === "awaiting_acceptance" && now < a.acceptance_deadline,
    fund: isA && a.status === "awaiting_funding" && now < a.funding_deadline,
    cancel:
      connected &&
      ((a.status === "awaiting_acceptance" &&
        (isA || now >= a.acceptance_deadline)) ||
        (a.status === "awaiting_funding" &&
          party &&
          now >= a.funding_deadline)),
    release: isA && cooperative,
    refund: isB && cooperative,
    dispute: party && a.status === "funded",
    respond:
      party &&
      a.status === "awaiting_response" &&
      wallet.toLowerCase() === a.dispute_responder.toLowerCase() &&
      now < a.response_deadline,
    noShow:
      connected &&
      a.status === "awaiting_response" &&
      now >= a.response_deadline,
    evidence:
      party &&
      evidenceOpen &&
      a.evidence.filter((e) => e.party === role).length < 10,
    ready: party && evidenceOpen && !(isA ? a.party_a_ready : a.party_b_ready),
    closeEvidence:
      connected &&
      a.status === "evidence" &&
      now >= a.evidence_deadline &&
      !timedOut,
    resolve: connected && a.status === "ready_for_resolution" && !timedOut,
    fallback: party && a.status === "resolution_stalled" && !timedOut,
    timeout:
      party &&
      timedOut &&
      ["evidence", "ready_for_resolution", "resolution_stalled"].includes(
        a.status,
      ),
  };
}
export function agreementDeadline(a: Agreement) {
  if (a.status === "awaiting_acceptance") return a.acceptance_deadline;
  if (a.status === "awaiting_funding") return a.funding_deadline;
  if (a.status === "awaiting_response") return a.response_deadline;
  if (a.status === "evidence") return a.evidence_deadline;
  if (a.status === "funded") return a.performance_due_at;
  if (["ready_for_resolution", "resolution_stalled"].includes(a.status))
    return a.resolution_deadline;
  return 0;
}
