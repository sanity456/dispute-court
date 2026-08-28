import assert from "node:assert/strict";
import {
  accounts,
  read,
  write,
  log,
  evidence,
  payoutDelivery,
} from "./studionet-harness.mjs";
const id = "lifecycle-" + Date.now().toString(36);
log("court_lifecycle_started", { id });
await write(0, "create_agreement", [
  id,
  accounts[1].address,
  "Studionet bounded-fallback lifecycle check",
  "Automated sandbox test of a bilateral disagreement. No real delivery is promised.",
  "Only verifiable public evidence can support a ruling. If evidence remains absent, use the already accepted bounded fallback.",
  1000n,
  86400,
  86400,
  86400,
  86400,
  86400,
]);
await write(1, "accept_agreement", [id]);
await write(0, "fund_agreement", [id], 1000n);
assert.equal((await read("get_agreement", [id])).status, "funded");
await write(0, "open_dispute", [
  id,
  "Sandbox fixture: the agreed delivery has not been evidenced.",
]);
await write(1, "respond_to_dispute", [
  id,
  "Sandbox fixture: I respond on time but provide no public exhibit.",
]);
for (let attempt = 1; attempt <= 3; attempt++) {
  await write(0, "mark_ready", [id]);
  await write(1, "mark_ready", [id]);
  await write(0, "resolve", [id]);
  const agreement = await read("get_agreement", [id]);
  assert.equal(agreement.resolution_attempt_count, attempt);
  assert.equal(
    agreement.status,
    attempt < 3 ? "evidence" : "resolution_stalled",
  );
}
await write(1, "resolve_fallback_split", [id]);
const result = await read("get_agreement", [id]);
assert.equal(result.status, "resolved");
assert.equal(result.verdict.resolution_type, "bounded_fallback_split");
assert.equal(result.paid.conservation_wei, "1000");
assert.equal(
  BigInt(result.paid.party_a_wei) +
    BigInt(result.paid.party_b_wei) +
    BigInt(result.paid.fee_wei),
  1000n,
);
for (let index = 0; index < 2; index++) {
  assert.equal(
    (await read("get_credit", [accounts[index].address])).credit_wei,
    index ? result.paid.party_b_wei : result.paid.party_a_wei,
  );
  const hash = await write(index, "withdraw");
  assert.equal(
    (await read("get_credit", [accounts[index].address])).credit_wei,
    "0",
  );
  await payoutDelivery(
    hash,
    accounts[index].address,
    index ? result.paid.party_b_wei : result.paid.party_a_wei,
  );
}
log("court_lifecycle_passed", { id, transactions: evidence });
