import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAgreement } from "../lib/lifecycle.ts";
import {
  agreementReviewKey,
  detailIsFresh,
  workspaceIdentity,
} from "../lib/workspace-review.ts";
const session = {
  wallet: "0xaa",
  coreAddress: "0xcc",
  captureAddress: "0xee",
  chainId: 61999,
};
const agreement = normalizeAgreement({
  id: "review-1",
  terms_hash: "hash-1",
  status: "evidence",
  evidence_deadline: 500,
  party_a: "0xaa",
  party_b: "0xbb",
  amount_wei: "1000",
});
test("unchanged chain data preserves consent across refreshes, object instances and field ordering", () => {
  const reviewed = agreementReviewKey(agreement);
  assert.equal(agreementReviewKey(structuredClone(agreement)), reviewed);
  assert.equal(
    agreementReviewKey(Object.fromEntries(Object.entries(agreement).reverse())),
    reviewed,
  );
  assert.equal(
    workspaceIdentity({ ...session, wallet: "0xAA" }),
    workspaceIdentity(session),
  );
});
test("wallet, chain, core and capture changes each reset the workspace identity", () => {
  for (const [key, value] of Object.entries({
    wallet: "0xbb",
    coreAddress: "0xdd",
    captureAddress: "0xff",
    chainId: 1,
  }))
    assert.notEqual(
      workspaceIdentity({ ...session, [key]: value }),
      workspaceIdentity(session),
    );
  assert.equal(workspaceIdentity(null), "signed-out");
});
test("every meaningful agreement change invalidates the review without relying on the local clock", () => {
  const reviewed = agreementReviewKey(agreement);
  for (const change of [
    { id: "review-2" },
    { terms_hash: "hash-2" },
    { status: "ready_for_resolution" },
    { party_b: "0xcc" },
    { amount_wei: "2000" },
    { fee_bps: 300 },
    { evidence_deadline: 600 },
    { resolution_deadline: 900 },
    { party_b_ready: true },
    { reopen_count: 1 },
    { resolution_attempt_count: 1 },
    { evidence: [{ id: "evidence-001", expected_digest: "new" }] },
  ])
    assert.notEqual(agreementReviewKey({ ...agreement, ...change }), reviewed);
});
test("retained detail is actionable only after the current revision loads successfully", () => {
  const detail = { key: agreement.id, revision: 1 };
  assert.equal(detailIsFresh(detail, agreement.id, 1, ""), true);
  assert.equal(detailIsFresh(detail, agreement.id, 2, ""), false);
  assert.equal(detailIsFresh(detail, "different", 1, ""), false);
  assert.equal(detailIsFresh(detail, agreement.id, 1, "RPC failed"), false);
  assert.equal(detailIsFresh(null, agreement.id, 1, ""), false);
});
test("workspace retains detail during refresh and binds all review checkboxes to recorded state", () => {
  const source = readFileSync(
    new URL("../components/ProductHome.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /detail\?\.key === agreementId \? detail : null/);
  assert.doesNotMatch(source, /\[agreementId, protocol\.revision\]\.join/);
  for (const key of ["reviewedKey", "settlementKey", "evidenceKey"])
    assert.match(source, new RegExp(key + " === reviewKey"));
  assert.match(source, /reviewContext=\{reviewKey\}/);
  assert.match(source, /!detailFresh/);
});
test("wallet refresh and rejected login fail closed without losing the specific sign-in reason", () => {
  const source = readFileSync(
    new URL("../lib/useProtocol.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /sessionRevision === revision/);
  assert.match(source, /dataRevision === revision/);
  const connect = source.slice(
    source.indexOf("async function connect"),
    source.indexOf("async function more"),
  );
  assert.match(connect, /sessionReasonRef\.current = reason/);
  assert.match(connect, /setSessionError\(reason\)/);
});
