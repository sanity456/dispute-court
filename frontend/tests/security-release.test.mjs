import test from "node:test";
import assert from "node:assert/strict";
import { verifyRelease } from "../scripts/verify-security-release.mjs";

function fixture() {
  const core = {
    network: "studionet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    contractAddress: "0x" + "11".repeat(20),
    ownerAddress: "0x" + "33".repeat(20),
    deploymentTransaction: "0x" + "aa".repeat(32),
  };
  const helper = {
    network: "studionet",
    chainId: 61999,
    contractAddress: "0x" + "22".repeat(20),
    deploymentTransaction: "0x" + "bb".repeat(32),
  };
  const sources = {
    core: Buffer.from("reviewed core v3"),
    helper: Buffer.from("reviewed helper v3"),
  };
  const receipts = Object.fromEntries(
    [
      ["core", core],
      ["helper", helper],
    ].map(([kind, manifest]) => [
      manifest.deploymentTransaction,
      {
        status: "FINALIZED",
        txExecutionResultName: "FINISHED_WITH_RETURN",
        data: {
          contract_address: manifest.contractAddress,
          contract_code: sources[kind].toString("base64"),
        },
      },
    ]),
  );
  const config = {
    protocol_version: 3,
    max_source_bytes: 6000,
    owner: core.ownerAddress,
    fee_bps: 200,
  };
  const capture = {
    protocol_version: 3,
    max_source_bytes: 6000,
    product_contract: core.contractAddress,
    funds_accepted: false,
  };
  return {
    core,
    helper,
    sources,
    expectedFeeBps: 200,
    config,
    capture,
    receipts,
    chainId: async () => 61999,
    transaction: async (hash) => receipts[hash],
    readConfig: async (address) =>
      address === core.contractAddress ? config : capture,
  };
}
test("read-only activation verifier requires successful finalized deployments and exact reviewed sources", async () => {
  const f = fixture();
  const report = await verifyRelease(f);
  assert.equal(report.protocolVersion, 3);
  assert.equal(report.verified.length, 2);
  f.receipts[f.core.deploymentTransaction].txExecutionResultName =
    "FINISHED_WITH_ERROR";
  await assert.rejects(verifyRelease(f), /execution was not successful/);
  f.receipts[f.core.deploymentTransaction].txExecutionResultName =
    "FINISHED_WITH_RETURN";
  f.sources.core = Buffer.from("different source");
  await assert.rejects(verifyRelease(f), /NOT activated/);
});
test("activation fails for old protocol, wrong helper, owner, fee, chain or receipt state", async () => {
  const changes = [
    (f) => {
      f.config.protocol_version = 2;
    },
    (f) => {
      f.capture.max_source_bytes = 32000;
    },
    (f) => {
      f.capture.product_contract = "0x" + "44".repeat(20);
    },
    (f) => {
      f.config.owner = "0x" + "44".repeat(20);
    },
    (f) => {
      f.config.fee_bps = 500;
    },
    (f) => {
      f.chainId = async () => 1;
    },
    (f) => {
      f.capture.funds_accepted = true;
    },
    (f) => {
      f.receipts[f.helper.deploymentTransaction].status = "ACCEPTED";
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    await assert.rejects(verifyRelease(f));
  }
});
