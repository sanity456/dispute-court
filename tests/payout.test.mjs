import test from "node:test";
import assert from "node:assert/strict";
import { nativePayoutDelivered } from "../lib/payout.ts";
const expected = { contract: "0x1111", recipient: "0x2222", amount: 490n };
const receipt = {
  type: 0,
  status: "FINALIZED",
  value: 490,
  value_credited: true,
  from_address: "0x1111",
  to_address: "0x2222",
};
test("native transfers are verified by credited value and destination, not a nonexistent GenVM receipt", () => {
  assert.equal(nativePayoutDelivered(receipt, expected), true);
  for (const change of [
    { value_credited: false },
    { status: "PENDING" },
    { value: 491 },
    { to_address: "0x3333" },
    { from_address: "0x3333" },
    { type: 2 },
    { type: null },
    { type: undefined },
  ]) {
    assert.equal(
      nativePayoutDelivered({ ...receipt, ...change }, expected),
      false,
    );
  }
});
test("unsafe numeric amounts fail closed instead of silently rounding", () => {
  assert.equal(
    nativePayoutDelivered(
      { ...receipt, value: Number.MAX_SAFE_INTEGER + 1 },
      expected,
    ),
    false,
  );
  assert.equal(
    nativePayoutDelivered({ ...receipt, value: "490" }, expected),
    true,
  );
});
