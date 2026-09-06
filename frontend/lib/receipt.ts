export type ExecutionState = "success" | "error" | "unknown";
export type TransactionProgress = { hash: string; status: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function leaderReceipt(value: unknown): Record<string, unknown> {
  const consensus = record(record(value).consensus_data);
  const leaders = consensus.leader_receipt;
  return record(Array.isArray(leaders) ? leaders[0] : leaders);
}

function decodedLeaderError(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 16384 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return "";
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const message = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^[\u0000-\u001f]+/, "")
      .trim();
    return /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message)
      ? ""
      : message;
  } catch {
    return "";
  }
}

export function transactionStatus(value: unknown): string {
  const receipt = record(value);
  const status =
    receipt.statusName ?? receipt.status_name ?? receipt.status ?? "";
  const names = [
    "UNINITIALIZED",
    "PENDING",
    "PROPOSING",
    "COMMITTING",
    "REVEALING",
    "ACCEPTED",
    "UNDETERMINED",
    "FINALIZED",
    "CANCELED",
    "APPEAL_REVEALING",
    "APPEAL_COMMITTING",
    "READY_TO_FINALIZE",
    "VALIDATORS_TIMEOUT",
    "LEADER_TIMEOUT",
  ];
  if (/^\d+$/.test(String(status))) return names[Number(status)] ?? "UNKNOWN";
  return String(status).toUpperCase();
}

export function executionState(value: unknown): ExecutionState {
  const receipt = record(value);
  const named =
    receipt.txExecutionResultName ?? receipt.tx_execution_result_name;
  if (named === "FINISHED_WITH_RETURN") return "success";
  if (named === "FINISHED_WITH_ERROR") return "error";
  const numeric = receipt.txExecutionResult ?? receipt.tx_execution_result;
  if (numeric !== undefined && numeric !== null) {
    if (Number(numeric) === 1) return "success";
    if (Number(numeric) === 2) return "error";
    return "unknown";
  }
  const outcome = leaderReceipt(value).execution_result;
  if (outcome === "SUCCESS") return "success";
  if (outcome === "ERROR" || outcome === "FAILURE") return "error";
  return "unknown";
}

export function executionError(value: unknown): string {
  const leader = leaderReceipt(value);
  const vm = record(leader.genvm_result);
  const result = record(leader.result);
  const payload = record(result.payload);
  return String(
    vm.stderr ||
      leader.error ||
      decodedLeaderError(leader.result) ||
      (result.status === "error" && payload.readable) ||
      "The contract rejected this action. No contract state change was applied.",
  ).slice(0, 700);
}

export class TransactionError extends Error {
  readonly hash: string;
  constructor(message: string, hash: string) {
    super(
      message +
        " Transaction: " +
        hash +
        ". Do not submit it again until its outcome is checked.",
    );
    this.name = "TransactionError";
    this.hash = hash;
  }
}

export async function waitForFinalizedTransaction(
  hash: string,
  fetchReceipt: () => Promise<unknown>,
  options: {
    onProgress?: (progress: TransactionProgress) => void;
    maxAttempts?: number;
    pause?: () => Promise<void>;
  } = {},
): Promise<unknown> {
  const pause =
    options.pause ??
    (() => new Promise<void>((resolve) => setTimeout(resolve, 6000)));
  let previousStatus = "";
  let rpcFailures = 0;
  for (let attempt = 0; attempt < (options.maxAttempts ?? 150); attempt++) {
    let receipt: unknown;
    try {
      receipt = await fetchReceipt();
      rpcFailures = 0;
    } catch {
      rpcFailures++;
      if (rpcFailures >= 5) {
        throw new TransactionError(
          "The transaction was submitted, but Studionet is not returning its status. Refresh the record later.",
          hash,
        );
      }
      await pause();
      continue;
    }
    const status = transactionStatus(receipt);
    if (status && status !== previousStatus) {
      options.onProgress?.({ hash, status });
      previousStatus = status;
    }
    if (
      ["CANCELED", "CANCELLED", "UNDETERMINED", "LEADER_TIMEOUT"].includes(
        status,
      )
    ) {
      throw new TransactionError(
        "Studionet reported transaction status " +
          status +
          ". Check the recorded outcome before taking another action.",
        hash,
      );
    }
    if (status === "FINALIZED") {
      const outcome = executionState(receipt);
      if (outcome === "error")
        throw new TransactionError(executionError(receipt), hash);
      if (outcome !== "success") {
        throw new TransactionError(
          "The transaction finalized, but successful contract execution could not be verified.",
          hash,
        );
      }
      return receipt;
    }
    await pause();
  }
  throw new TransactionError(
    "The transaction is still pending on Studionet. Its hash is preserved; check it before retrying.",
    hash,
  );
}
