import test from "node:test";
import assert from "node:assert/strict";
import { product } from "../lib/product.ts";
import {
  deviceRecovery,
  recoverOutbox,
  rememberHash,
  saveSubmittedHash,
} from "../lib/recovery.ts";
const wallet = "0x" + "ab".repeat(20);
const core = "0x" + "cd".repeat(20);
const hash = "0x" + "ef".repeat(32);
const key = `${product.id}:emergency-hash-outbox:v3:${wallet}:${core}`;
function storage(t) {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, "localStorage", previous)
      : delete globalThis.localStorage,
  );
  return values;
}
test("404, offline and wrong-wallet failures retain exact hashes without resending", async (t) => {
  const values = storage(t);
  rememberHash("missing-intent", hash, wallet, core);
  for (const status of [404, 503, 409]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      calls++;
      assert.match(url, /intents\/missing-intent$/);
      assert.deepEqual(JSON.parse(init.body), { hash });
      return Response.json({ error: "Recovery unavailable" }, { status });
    });
    assert.deepEqual(await recoverOutbox(wallet, core), {
      recovered: 0,
      pending: 1,
    });
    assert.equal(calls, 1);
    assert.equal(JSON.parse(values.get(key))[0].hash, hash);
    mock.mock.restore();
  }
});
test("old unscoped entries never trigger current-deployment API writes", async (t) => {
  const values = storage(t);
  const legacyKey = `${product.id}:emergency-hash-outbox:v2:${wallet}`;
  const legacy = JSON.stringify([{ intentId: "v3-request", hash }]);
  values.set(legacyKey, legacy);
  t.mock.method(globalThis, "fetch", () =>
    assert.fail("Must not auto-attach an earlier deployment's hash"),
  );
  assert.deepEqual(await recoverOutbox(wallet, core), {
    recovered: 0,
    pending: 0,
  });
  assert.deepEqual(deviceRecovery(wallet, core).legacy, [
    { intentId: "v3-request", hash },
  ]);
  assert.equal(values.get(legacyKey), legacy);
});
test("recovery preserves more than 30 hashes, malformed entries and different hashes for the same intent", async (t) => {
  const values = storage(t);
  values.set(key, JSON.stringify([null, { unknown: "preserve" }]));
  for (let index = 0; index < 45; index++)
    rememberHash("intent-" + index, hash, wallet, core);
  const otherHash = "0x" + "aa".repeat(32);
  rememberHash("intent-0", otherHash, wallet, core);
  assert.equal(deviceRecovery(wallet, core).pending.length, 46);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await saveSubmittedHash("intent-0", hash, wallet, core);
  assert.equal(deviceRecovery(wallet, core).pending.length, 45);
  assert.equal(
    deviceRecovery(wallet, core).pending.find((e) => e.intentId === "intent-0")
      .hash,
    otherHash,
  );
  assert.deepEqual(JSON.parse(values.get(key)).slice(0, 2), [
    null,
    { unknown: "preserve" },
  ]);
});
test("unreadable or blocked local storage is not overwritten and does not stop server hash persistence", async (t) => {
  const values = storage(t);
  values.set(key, "broken JSON recovery data");
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  await saveSubmittedHash("safe", hash, wallet, core);
  assert.equal(values.get(key), "broken JSON recovery data");
  t.mock.method(globalThis.localStorage, "getItem", () => {
    throw new Error("Storage blocked");
  });
  await saveSubmittedHash("safe", hash, wallet, core);
});
