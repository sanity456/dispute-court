import test from "node:test";
import assert from "node:assert/strict";
import { ensureStudionet, assertWalletAccount } from "../lib/wallet.ts";
import { operatorActions } from "../lib/operator-policy.ts";
import { recordIdForAction } from "../lib/activity-model.ts";
import { product } from "../lib/product.ts";
const wallet = "0x" + "11".repeat(20);
test("network failure stops before wallet switching or signing", async () => {
  const calls = [];
  await assert.rejects(
    ensureStudionet(
      {
        request: async (x) => {
          calls.push(x);
        },
      },
      "https://studio.genlayer.com/api",
      async () => {
        throw new Error("Wrong RPC");
      },
    ),
    /Wrong RPC/,
  );
  assert.equal(calls.length, 0);
});
test("unknown-chain flow adds only Studionet then rechecks the actual chain", async () => {
  const calls = [];
  let switches = 0;
  const provider = {
    request: async (x) => {
      calls.push(x);
      if (x.method === "wallet_switchEthereumChain" && switches++ === 0)
        throw { code: 4902 };
      if (x.method === "eth_chainId") return "0xf22f";
    },
  };
  await ensureStudionet(
    provider,
    "https://studio.genlayer.com/api",
    async () => {},
  );
  assert.deepEqual(
    calls.map((x) => x.method),
    [
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ],
  );
  assert.equal(calls[1].params[0].chainId, "0xf22f");
  assert.equal(
    calls.some((x) => x.method === "eth_sendTransaction"),
    false,
  );
});
test("a rejected switch is not treated as permission to add a chain", async () => {
  let calls = 0;
  await assert.rejects(
    ensureStudionet(
      {
        request: async () => {
          calls++;
          throw { code: 4001 };
        },
      },
      "https://studio.genlayer.com/api",
      async () => {},
    ),
    (e) => e.code === 4001,
  );
  assert.equal(calls, 1);
});
test("wrong active network and changed accounts fail closed", async () => {
  await assert.rejects(
    ensureStudionet(
      { request: async (x) => (x.method === "eth_chainId" ? "0x1" : null) },
      "https://studio.genlayer.com/api",
      async () => {},
    ),
    /Switch your wallet/,
  );
  await assert.rejects(
    assertWalletAccount(
      { request: async () => ["0x" + "22".repeat(20)] },
      wallet,
    ),
    /active wallet changed/,
  );
  await assertWalletAccount({ request: async () => [wallet] }, wallet);
});
test("permissionless operator policy never funds, withdraws or chooses a party's fallback", () => {
  for (const status of [
    "funded",
    "awaiting_funding",
    "resolution_stalled",
    "refunding",
    "settled",
    "resolved",
    "cancelled",
  ]) {
    const choices = operatorActions({ id: "x", status }, [], false, 1000);
    assert.equal(choices.length, 0);
  }
  const r =
    product.id === "commitment-pools"
      ? { id: "x", status: "forming", join_deadline: 100 }
      : { id: "x", status: "awaiting_response", response_deadline: 100 };
  assert.equal(operatorActions(r, [], false, 99).length, 0);
  assert.equal(operatorActions(r, [], false, 100).length, 1);
  assert.equal(operatorActions(r, [], false, 100)[0].args[0], "x");
});
test("global and evidence helper actions never invent a pool or case id", () => {
  for (const method of [
    "schedule_fee_bps",
    "apply_scheduled_fee",
    "withdraw",
    "capture",
  ])
    assert.equal(recordIdForAction(method, ["500"]), "");
  assert.equal(recordIdForAction("create_pool", ["pool-id"]), "pool-id");
});
