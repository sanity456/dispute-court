import assert from "node:assert/strict";
import {
  accounts,
  read,
  write,
  log,
  evidence,
  payoutDelivery,
} from "./studionet-harness.mjs";
import { captureSource } from "./source-harness.mjs";
const id = "verified-source-" + Date.now().toString(36);
log("source_court_started", { id });
await write(0, "create_agreement", [
  id,
  accounts[1].address,
  "Verified-evidence sandbox ruling",
  "A sandbox verification exercise. Party B's only deliverable is identifying the public Example Domain documentation page; no outside work or delivery is claimed.",
  "Party B fulfills the whole task if https://example.com has the title Example Domain and says the domain is for use in documentation examples without needing permission. If verified, allocate 0% to Party A and 100% to Party B after the agreed fee. Only if the public evidence shows the criterion is false should Party A receive 100%. Statements by either party are not independent proof. Use only the actual page evidence.",
  1000n,
  86400,
  86400,
  86400,
  86400,
  86400,
]);
await write(1, "accept_agreement", [id]);
await write(0, "fund_agreement", [id], 1000n);
await write(0, "open_dispute", [
  id,
  "Sandbox fixture dispute: I ask validators to determine whether the agreed public page exists with the required text.",
]);
await write(1, "respond_to_dispute", [
  id,
  "The page contains Example Domain and the documentation-example sentence. I will provide its exact captured digest.",
]);
const source = await captureSource(1);
await write(1, "submit_evidence", [
  id,
  "This public page is the entire agreed deliverable: Example Domain with the documentation-example sentence.",
  source.url,
  source.digest,
]);
for (let attempt = 1; attempt <= 3; attempt++) {
  await write(0, "mark_ready", [id]);
  await write(1, "mark_ready", [id]);
  await write(0, "resolve", [id]);
  const current = await read("get_agreement", [id]);
  if (current.status === "resolved") break;
  assert.equal(
    current.status,
    "evidence",
    "Source-backed adjudication must not silently fall back",
  );
}
const result = await read("get_agreement", [id]);
assert.equal(result.status, "resolved");
assert.equal(
  result.paid.party_a_wei,
  "0",
  "Verified complete delivery belongs to Party B",
);
assert.equal(
  BigInt(result.paid.party_a_wei) +
    BigInt(result.paid.party_b_wei) +
    BigInt(result.paid.fee_wei),
  1000n,
);
assert.notEqual(result.verdict.resolution_type, "bounded_fallback_split");
const hash = await write(1, "withdraw");
const children = await payoutDelivery(
  hash,
  accounts[1].address,
  BigInt(result.paid.party_b_wei),
);
assert.equal(children.length, 1);
assert.equal(children[0].delivered, true);
log("source_court_passed", {
  id,
  verdict: result.verdict,
  paid: result.paid,
  transactions: evidence,
});
