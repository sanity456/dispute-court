import { agreementRole, type Agreement } from "./lifecycle.ts";

export const APPEAL_POLICY = "one_challenge_before_credit_v1";

export function appealSupported(
  agreement: Agreement,
  config: Record<string, unknown> | null,
) {
  return (
    agreement.protocol_version === 6 &&
    config?.protocol_version === 6 &&
    agreement.appeal_policy === APPEAL_POLICY &&
    config.appeal_policy === APPEAL_POLICY
  );
}

export function appealActions(
  agreement: Agreement,
  wallet: string,
  now: number,
) {
  const role = agreementRole(agreement, wallet);
  const party = role !== "visitor";
  const connected = Boolean(wallet);
  const appeal = agreement.appeal;
  const evidenceDeadline = Number(appeal.evidence_deadline ?? 0);
  const resolutionDeadline = Number(appeal.resolution_deadline ?? 0);
  const evidenceCount = Number(appeal[role + "_evidence_count"] ?? 0);
  const ready = Boolean(appeal[role + "_ready"]);
  const current = Number.isFinite(now) && now > 0;
  return {
    file:
      party &&
      current &&
      agreement.status === "appeal_window" &&
      now < agreement.appeal_deadline,
    finalizeUnappealed:
      connected &&
      current &&
      agreement.status === "appeal_window" &&
      now >= agreement.appeal_deadline,
    submitEvidence:
      party &&
      current &&
      agreement.status === "appeal_evidence" &&
      now < evidenceDeadline &&
      evidenceCount < 3,
    markReady:
      party &&
      current &&
      agreement.status === "appeal_evidence" &&
      now < evidenceDeadline &&
      !ready,
    closeEvidence:
      connected &&
      current &&
      agreement.status === "appeal_evidence" &&
      now >= evidenceDeadline,
    resolve:
      party &&
      current &&
      ["appeal_ready", "appeal_stalled"].includes(agreement.status) &&
      now < resolutionDeadline,
    finalizeTimeout:
      connected &&
      current &&
      ["appeal_evidence", "appeal_ready", "appeal_stalled"].includes(
        agreement.status,
      ) &&
      now >= resolutionDeadline,
  };
}
