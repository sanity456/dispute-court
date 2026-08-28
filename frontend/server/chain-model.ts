import { abi } from "../vendor/genlayer-js/index.js";
import {
  executionState,
  executionError,
  transactionStatus,
} from "../lib/receipt.ts";
import { nativePayoutDelivered } from "../lib/payout.ts";
import { jsonString, recordIdForAction } from "../lib/activity-model.ts";
import type {
  PayoutObservation,
  TransactionObservation,
} from "../lib/activity-model.ts";
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
export function plain(value: unknown): unknown {
  if (value instanceof Map)
    return Object.fromEntries(
      [...value].map(([key, item]) => [String(key), plain(item)]),
    );
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return String(value);
  return value;
}
function bytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (typeof value === "string")
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return new Uint8Array();
}
export function transactionCall(raw: unknown) {
  const data = object(object(raw).data),
    encoded = data.calldata,
    formatted = object(encoded);
  const decoded = abi.calldata.decode(
    bytes(formatted.raw ?? formatted.base64 ?? encoded),
  );
  return object(plain(decoded));
}
export function transactionReturn(raw: unknown): Record<string, unknown> {
  const leaders = object(object(raw).consensus_data).leader_receipt;
  const leader = object(Array.isArray(leaders) ? leaders[0] : leaders),
    result = leader.result,
    formatted = object(result);
  try {
    if (formatted.status === "return")
      return object(
        plain(abi.calldata.decode(bytes(object(formatted.payload).raw))),
      );
    const data = bytes(result);
    if (data[0] !== 0) return {};
    return object(plain(abi.calldata.decode(data.slice(1))));
  } catch {
    return {};
  }
}
export function exactValue(value: unknown): string {
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error("Unsafe numeric amount in receipt.");
  const text = String(value ?? "0");
  if (!/^(0|[1-9]\d*)$/.test(text))
    throw new Error("Invalid monetary value in receipt.");
  return text;
}
export function observeTransaction(
  raw: unknown,
  children: unknown[],
  now = Date.now(),
): TransactionObservation {
  const tx = object(raw),
    call = transactionCall(tx),
    result = transactionReturn(tx);
  const method = String(call.method ?? ""),
    status = transactionStatus(tx),
    execution = executionState(tx);
  const args = Array.isArray(call.args) ? call.args : [];
  const wallet = String(tx.from_address ?? tx.from ?? "").toLowerCase(),
    target = String(tx.to_address ?? tx.to ?? "").toLowerCase();
  let payoutState: TransactionObservation["payout_state"] = "none";
  let payout: PayoutObservation = {};
  if (method === "withdraw") {
    if (status !== "FINALIZED") payoutState = "awaiting_parent";
    else if (execution === "success") {
      payoutState = "unknown";
      if (
        result.recipient === wallet &&
        /^[1-9]\d*$/.test(String(result.amount_wei ?? ""))
      ) {
        const expected = {
          contract: target,
          recipient: wallet,
          amount: BigInt(String(result.amount_wei)),
        };
        const ids = Array.isArray(tx.triggered_transactions)
          ? tx.triggered_transactions.map(String)
          : [];
        payout = {
          id: String(result.id ?? ""),
          recipient: wallet,
          amount_wei: String(result.amount_wei),
          children: children.map((value) => {
            const child = object(value);
            return {
              hash: String(child.hash ?? ""),
              status: transactionStatus(child),
              delivered: nativePayoutDelivered(child, expected),
              value: exactValue(child.value),
              recipient: String(child.to_address ?? ""),
            };
          }),
        };
        if (
          ids.length === 1 &&
          payout.children?.length === 1 &&
          ids[0].toLowerCase() === payout.children[0].hash.toLowerCase()
        ) {
          const child = payout.children[0];
          if (child.delivered) payoutState = "delivered";
          else if (["CANCELED", "CANCELLED"].includes(child.status))
            payoutState = "failed";
          else if (child.status !== "FINALIZED") payoutState = "pending";
        } else if (ids.length === 0 || children.length === 0)
          payoutState = "pending";
        payout.note =
          payoutState === "delivered"
            ? "Exact recipient and amount credited in the finalized native transfer."
            : "Do not resubmit or assume credit was restored. Use the transaction record when contacting support.";
      }
    }
  }
  return {
    hash: String(tx.hash ?? ""),
    wallet,
    target,
    method,
    args_json: jsonString(args),
    record_id: recordIdForAction(method, args),
    status,
    execution,
    value_wei: exactValue(tx.value),
    payout_state: payoutState,
    payout_json: jsonString(payout),
    result_json: jsonString(result),
    created_at: Date.parse(String(tx.created_at ?? "")) || now,
    updated_at: now,
    error: execution === "error" ? executionError(tx) : "",
  };
}
