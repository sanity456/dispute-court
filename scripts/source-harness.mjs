import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import { waitForFinalizedTransaction } from "../lib/receipt.ts";
import {
  accounts,
  clients,
  reader,
  log,
  evidence,
  deployment,
} from "./studionet-harness.mjs";
const helper = JSON.parse(
  readFileSync(
    new URL("../lib/evidence-deployment.json", import.meta.url),
    "utf8",
  ),
);
export async function captureSource(index = 0) {
  const nonce = "verified-" + Date.now().toString(36);
  const hash = await clients[index].writeContract({
    address: helper.contractAddress,
    functionName: "capture",
    args: ["https://example.com", nonce],
    leaderOnly: false,
    consensusMaxRotations: 5,
  });
  log("source_capture_submitted", { hash, helper: helper.contractAddress });
  await waitForFinalizedTransaction(
    String(hash),
    () => reader.getTransaction({ hash }),
    {
      onProgress: ({ status }) =>
        log("source_capture_progress", { hash, status }),
    },
  );
  const value = await reader.readContract({
    address: helper.contractAddress,
    functionName: "get_capture",
    args: [accounts[index].address, nonce],
    jsonSafeReturn: true,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  assert.equal(
    value.product_contract.toLowerCase(),
    deployment.contractAddress.toLowerCase(),
  );
  assert.match(value.digest, /^[a-f0-9]{64}$/);
  assert.match(value.text, /Example Domain/);
  evidence.push({
    method: "capture",
    hash,
    helper: helper.contractAddress,
    digest: value.digest,
  });
  log("source_capture_verified", {
    hash,
    digest: value.digest,
    byte_length: value.byte_length,
  });
  return value;
}
