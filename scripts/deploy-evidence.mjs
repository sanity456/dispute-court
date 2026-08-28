import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createAccount,
  createClient,
  chains,
} from "../vendor/genlayer-js/index.js";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import { waitForFinalizedTransaction } from "../lib/receipt.ts";
if (process.env.RUN_STUDIONET_EVIDENCE !== "1")
  throw new Error("Explicit RUN_STUDIONET_EVIDENCE=1 is required.");
const product = JSON.parse(
  readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"),
);
assert.equal(product.chainId, 61999);
assert.equal(product.network, "studionet");
const account = createAccount();
const client = createClient({
  chain: chains.studionet,
  endpoint: product.rpcUrl,
  account,
});
assert.equal(await client.getChainId(), 61999);
const log = (event, value) =>
  console.log(
    JSON.stringify({ event, ...value }, (_, v) =>
      typeof v === "bigint" ? String(v) : v,
    ),
  );
const hash = await client.deployContract({
  code: new Uint8Array(
    readFileSync(
      new URL("../../contracts/evidence_capture.py", import.meta.url),
    ),
  ),
  args: [product.contractAddress],
  leaderOnly: false,
  consensusMaxRotations: 5,
});
log("evidence_deploy_submitted", { hash });
const receipt = await waitForFinalizedTransaction(
  hash,
  () => client.getTransaction({ hash }),
  { onProgress: (p) => log("deploy_progress", p) },
);
const address = receipt.data?.contract_address ?? receipt.to_address;
assert.match(address, /^0x[0-9a-fA-F]{40}$/);
assert.notEqual(address.toLowerCase(), "0x" + "0".repeat(40));
const config = await client.readContract({
  address,
  functionName: "get_config",
  args: [],
  jsonSafeReturn: true,
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
});
assert.equal(config.product_contract, product.contractAddress.toLowerCase());
log("evidence_deployed", {
  contractAddress: address,
  deploymentTransaction: hash,
  config,
});
const requestId = "smoke-" + Date.now().toString(36);
const captureHash = await client.writeContract({
  address,
  functionName: "capture",
  args: ["https://example.com/", requestId],
  leaderOnly: false,
  consensusMaxRotations: 5,
});
log("capture_submitted", { hash: captureHash, address });
await waitForFinalizedTransaction(
  captureHash,
  () => client.getTransaction({ hash: captureHash }),
  { onProgress: (p) => log("capture_progress", p) },
);
const capture = await client.readContract({
  address,
  functionName: "get_capture",
  args: [account.address, requestId],
  jsonSafeReturn: true,
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
});
assert.match(capture.digest, /^[0-9a-f]{64}$/);
assert.ok(capture.text.includes("Example Domain"));
log("evidence_verified", {
  contractAddress: address,
  deploymentTransaction: hash,
  captureTransaction: captureHash,
  account: account.address,
  capture,
});
