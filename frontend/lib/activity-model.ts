export type IntentState =
  "reserved" | "submitted" | "review" | "success" | "failed" | "cancelled";
export type Intent = {
  id: string;
  wallet: string;
  target: string;
  method: string;
  title: string;
  record_id: string;
  args_json: string;
  value_wei: string;
  status: IntentState;
  tx_hash: string | null;
  error: string;
  created_at: number;
  updated_at: number;
  transaction?: TransactionObservation | null;
};
export type PayoutState =
  "none" | "awaiting_parent" | "pending" | "delivered" | "failed" | "unknown";
export type PayoutObservation = {
  id?: string;
  recipient?: string;
  amount_wei?: string;
  children?: {
    hash: string;
    status: string;
    delivered: boolean;
    value: string;
    recipient: string;
  }[];
  note?: string;
};
export type TransactionObservation = {
  hash: string;
  wallet: string;
  target: string;
  method: string;
  args_json: string;
  record_id: string;
  status: string;
  execution: string;
  value_wei: string;
  payout_state: PayoutState;
  payout_json: string;
  result_json: string;
  created_at: number;
  updated_at: number;
  error: string;
};
export function unresolvedIntent(intent: Pick<Intent, "status">) {
  return ["reserved", "submitted", "review"].includes(intent.status);
}
export function intentDescription(intent: Intent) {
  if (["CANCELED", "CANCELLED"].includes(intent.transaction?.status ?? ""))
    return "Cancelled by the network · check wallet history before retrying";
  if (intent.transaction?.payout_state === "delivered")
    return "Payout delivered";
  if (intent.transaction?.payout_state === "failed")
    return "Payout needs support — do not retry blindly";
  if (intent.transaction?.payout_state === "pending")
    return "Withdrawal finalized · transfer pending";
  if (intent.transaction?.payout_state === "unknown")
    return "Withdrawal finalized · delivery unconfirmed";
  if (intent.status === "success") return "Execution succeeded and finalized";
  if (intent.status === "failed") return "Execution failed";
  if (intent.status === "cancelled") return "Wallet request cancelled";
  if (intent.status === "review")
    return "Check wallet history before another submission";
  if (intent.status === "reserved")
    return "Awaiting wallet confirmation or transaction hash";
  return (
    "Submitted · " +
    (intent.transaction?.status.toLowerCase().replaceAll("_", " ") ??
      "waiting for network")
  );
}
export function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
export function jsonString(value: unknown) {
  return JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}
export function canonicalArgs(value: unknown): unknown {
  if (
    typeof value === "bigint" ||
    (typeof value === "number" && Number.isInteger(value))
  )
    return String(value);
  if (Array.isArray(value)) return value.map(canonicalArgs);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalArgs(v)]),
    );
  return value;
}
export function recordIdForAction(method: string, args: unknown[]) {
  if (
    ["withdraw", "schedule_fee_bps", "apply_scheduled_fee", "capture"].includes(
      method,
    )
  )
    return "";
  return typeof args[0] === "string" ? args[0] : "";
}
