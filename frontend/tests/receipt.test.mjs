import test from "node:test";
import assert from "node:assert/strict";
import {
  executionState,
  transactionStatus,
  waitForFinalizedTransaction,
  TransactionError,
} from "../lib/receipt.ts";
import { transactionsStatusNumberToName } from "../vendor/genlayer-js/types/index.js";
import { parseGen, formatGen } from "../lib/amounts.ts";

test("Studio and node receipts require successful execution, not just finality", () => {
  assert.equal(executionState({ status: "FINALIZED" }), "unknown");
  assert.equal(
    executionState({ txExecutionResultName: "FINISHED_WITH_RETURN" }),
    "success",
  );
  assert.equal(executionState({ txExecutionResult: 2 }), "error");
  assert.equal(
    executionState({
      consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] },
    }),
    "success",
  );
  assert.equal(
    executionState({
      consensus_data: { leader_receipt: { execution_result: "ERROR" } },
    }),
    "error",
  );
});

test("numeric status codes agree with the deployed SDK mapping", () => {
  for (const [status, name] of Object.entries(transactionsStatusNumberToName)) {
    assert.equal(transactionStatus({ status: Number(status) }), name);
  }
  assert.equal(transactionStatus({ status: 14 }), "UNKNOWN");
});

test("a finalized revert never becomes a success", async () => {
  await assert.rejects(
    waitForFinalizedTransaction(
      "0xtest",
      async () => ({
        status: "FINALIZED",
        consensus_data: {
          leader_receipt: [
            { execution_result: "ERROR", error: "Only Party B" },
          ],
        },
      }),
      { pause: async () => {} },
    ),
    /Only Party B/,
  );
});

test("unknown finalized execution fails closed", async () => {
  await assert.rejects(
    waitForFinalizedTransaction(
      "0xtest",
      async () => ({ status_name: "FINALIZED" }),
      { pause: async () => {} },
    ),
    /could not be verified/,
  );
});

test("pending transaction is polled without resubmission", async () => {
  let calls = 0;
  const updates = [];
  const receipt = await waitForFinalizedTransaction(
    "0xtest",
    async () => {
      calls++;
      return calls === 1
        ? { statusName: "ACCEPTED" }
        : { statusName: "FINALIZED", txExecutionResult: 1 };
    },
    {
      pause: async () => {},
      onProgress: (update) => updates.push(update.status),
    },
  );
  assert.equal(receipt.txExecutionResult, 1);
  assert.deepEqual(updates, ["ACCEPTED", "FINALIZED"]);
  assert.equal(calls, 2);
});

test("timeout preserves the submitted hash", async () => {
  await assert.rejects(
    waitForFinalizedTransaction(
      "0xpending",
      async () => ({ statusName: "PENDING" }),
      { maxAttempts: 2, pause: async () => {} },
    ),
    (error) => error instanceof TransactionError && error.hash === "0xpending",
  );
});

test("amounts retain wei precision and reject rounding, negatives, and overflow", () => {
  assert.equal(parseGen("0.000000000000000001"), 1n);
  assert.equal(formatGen(1n), "0.000000000000000001");
  assert.equal(formatGen(parseGen("12.3456")), "12.3456");
  for (const invalid of ["-1", "1e3", "0.0000000000000000001", "abc", ""]) {
    assert.throws(() => parseGen(invalid));
  }
  assert.throws(() => parseGen("1" + "0".repeat(78)));
});
