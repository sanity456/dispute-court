import { product } from "./product.ts";
export type OperatorAction = {
  method: string;
  args: unknown[];
  reason: string;
};
export function operatorActions(
  record: Record<string, unknown>,
  participants: Record<string, unknown>[],
  canSettle: boolean,
  now: number,
): OperatorAction[] {
  const id = String(record.id ?? ""),
    status = String(record.status ?? "");
  if (!id || !Number.isSafeInteger(now) || now <= 0) return [];
  if (product.id === "commitment-pools") {
    if (
      status === "forming" &&
      Number(record.join_deadline) > 0 &&
      now >= Number(record.join_deadline)
    )
      return [
        {
          method: "activate_pool",
          args: [id],
          reason:
            "Formation ended; the contract chooses activation or refunding.",
        },
      ];
    if (status === "active" && canSettle)
      return [
        {
          method: "settle",
          args: [id],
          reason: "Latest finalized contract view permits settlement.",
        },
      ];
    if (status === "active")
      return participants.flatMap((player) => {
        const closes =
          Number(record.activity_starts_at) +
          (Number(player.rounds_passed) + 1) *
            Number(record.round_window_seconds);
        return player.status === "active" && closes > 0 && now >= closes
          ? [
              {
                method: "mark_missed_round",
                args: [id, String(player.address)],
                reason: "The participant's next round has expired.",
              },
            ]
          : [];
      });
    return [];
  }
  if (
    Number(record.protocol_version) === 3 &&
    Number(record.resolution_deadline) > 0 &&
    now >= Number(record.resolution_deadline) &&
    ["evidence", "ready_for_resolution", "resolution_stalled"].includes(status)
  )
    return [];
  if (
    status === "awaiting_acceptance" &&
    Number(record.acceptance_deadline) > 0 &&
    now >= Number(record.acceptance_deadline)
  )
    return [
      {
        method: "cancel_expired_agreement",
        args: [id],
        reason: "The unfunded acceptance invitation expired.",
      },
    ];
  if (
    status === "awaiting_response" &&
    Number(record.response_deadline) > 0 &&
    now >= Number(record.response_deadline)
  )
    return [
      {
        method: "resolve_no_show",
        args: [id],
        reason: "The named responder missed the accepted deadline.",
      },
    ];
  if (
    status === "evidence" &&
    Number(record.evidence_deadline) > 0 &&
    now >= Number(record.evidence_deadline)
  )
    return [
      {
        method: "close_evidence",
        args: [id],
        reason: "The evidence window expired.",
      },
    ];
  if (status === "ready_for_resolution")
    return [
      {
        method: "resolve",
        args: [id],
        reason: "The contract is ready for validator resolution.",
      },
    ];
  // Never fund, withdraw, choose a cooperative allocation, or apply party-only fallback.
  return [];
}
