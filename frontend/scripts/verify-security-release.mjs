// Read-only activation check. No wallets, keys, signing, deployment, or writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, chains } from "../vendor/genlayer-js/index.js";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import { executionState, transactionStatus } from "../lib/receipt.ts";
import { product } from "../lib/product.ts";

export async function verifyRelease({
  core,
  helper,
  sources,
  chainId,
  transaction,
  readConfig,
  expectedFeeBps,
}) {
  assert.equal(
    core.rpcUrl,
    "https://studio.genlayer.com/api",
    "Use the approved Studionet RPC",
  );
  for (const manifest of [core, helper]) {
    assert.equal(manifest.network, "studionet");
    assert.equal(manifest.chainId, 61999);
    assert.equal(manifest.protocolVersion, 4);
    assert.match(manifest.contractAddress, /^0x[0-9a-fA-F]{40}$/);
    assert.match(manifest.deploymentTransaction, /^0x[0-9a-fA-F]{64}$/);
    assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
  }
  assert.match(core.ownerAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.ok(
    Number.isSafeInteger(expectedFeeBps) && expectedFeeBps >= 0,
    "Specify the intended fee explicitly",
  );
  assert.equal(Number(await chainId()), 61999, "Wrong chain");
  const verified = [];
  for (const [kind, manifest] of [
    ["core", core],
    ["helper", helper],
  ]) {
    const receipt = await transaction(manifest.deploymentTransaction);
    assert.equal(
      transactionStatus(receipt),
      "FINALIZED",
      kind + " deployment is not finalized",
    );
    assert.equal(
      executionState(receipt),
      "success",
      kind + " deployment execution was not successful",
    );
    assert.equal(
      String(receipt?.data?.contract_address).toLowerCase(),
      manifest.contractAddress.toLowerCase(),
      kind + " address mismatch",
    );
    assert.equal(
      typeof receipt?.data?.contract_code,
      "string",
      kind + " source is unavailable",
    );
    const source = Buffer.from(sources[kind]);
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    assert.equal(
      manifest.sourceSha256,
      sourceSha256,
      kind + " manifest source hash mismatch",
    );
    assert.equal(
      Buffer.compare(Buffer.from(receipt.data.contract_code, "base64"), source),
      0,
      kind +
        " does not match the local v4 source: the security release is NOT activated",
    );
    verified.push({
      kind,
      address: manifest.contractAddress,
      sourceSha256,
    });
  }
  const config = await readConfig(core.contractAddress);
  const capture = await readConfig(helper.contractAddress);
  for (const [kind, value] of [
    ["core", config],
    ["helper", capture],
  ]) {
    assert.equal(value?.protocol_version, 4, kind + " is not v4");
    assert.equal(
      value?.max_source_bytes,
      6000,
      kind + " source policy mismatch",
    );
  }
  assert.equal(
    String(config.owner).toLowerCase(),
    core.ownerAddress.toLowerCase(),
    "Owner mismatch",
  );
  assert.equal(config.fee_bps, expectedFeeBps, "Unexpected fee");
  assert.equal(
    config.decision_policy,
    "party_b_performance_level_v1",
    "Directional-safe decision policy is not active",
  );
  assert.equal(config.party_a_role, "funder_refund_side");
  assert.equal(config.party_b_role, "performer_payment_side");
  assert.equal(
    String(capture.product_contract).toLowerCase(),
    core.contractAddress.toLowerCase(),
    "Helper belongs to a different core",
  );
  assert.equal(
    capture.funds_accepted,
    false,
    "Evidence helper must not accept funds",
  );
  return {
    protocolVersion: 4,
    chainId: 61999,
    owner: core.ownerAddress,
    feeBps: expectedFeeBps,
    verified,
  };
}

async function main() {
  assert.equal(
    process.argv.length,
    4,
    "Usage: node scripts/verify-security-release.mjs --expected-fee-bps <integer>",
  );
  assert.equal(process.argv[2], "--expected-fee-bps");
  assert.match(process.argv[3], /^(0|[1-9][0-9]*)$/);
  const expectedFeeBps = Number(process.argv[3]);
  const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const core = JSON.parse(
    readFileSync(resolve(frontend, "lib/deployment.json"), "utf8"),
  );
  const helper = JSON.parse(
    readFileSync(resolve(frontend, "lib/evidence-deployment.json"), "utf8"),
  );
  // Validate the endpoint before making any network request.
  assert.equal(
    core.rpcUrl,
    "https://studio.genlayer.com/api",
    "Use the approved Studionet RPC",
  );
  const client = createClient({
    chain: chains.studionet,
    endpoint: core.rpcUrl,
  });
  const source =
    product.id === "commitment-pools"
      ? "commitment_pool_v3.py"
      : "dispute_court_v4.py";
  const report = await verifyRelease({
    core,
    helper,
    expectedFeeBps,
    sources: {
      core: readFileSync(resolve(frontend, "../contracts", source)),
      helper: readFileSync(
        resolve(frontend, "../contracts/evidence_capture_v4.py"),
      ),
    },
    chainId: () => client.getChainId(),
    async transaction(hash) {
      const response = await fetch(core.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionByHash",
          params: [hash],
        }),
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(response.status, 200, "Studionet did not return a receipt");
      const data = await response.json();
      assert.ok(!data.error && data.result, "Receipt unavailable");
      return data.result;
    },
    readConfig: (address) =>
      client.readContract({
        address,
        functionName: "get_config",
        args: [],
        jsonSafeReturn: true,
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      }),
  });
  console.log(JSON.stringify({ product: product.id, ...report }, null, 2));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error("Security release verification failed: " + error.message);
    process.exitCode = 1;
  });
}
