import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgreement, agreementDeadline } from "../lib/lifecycle.ts";
import {
  APPEAL_POLICY,
  appealActions,
  appealSupported,
} from "../lib/appeal.ts";
import { nextStep } from "../lib/reminders.ts";
import { operatorActions } from "../lib/operator-policy.ts";

const alice = "0x" + "aa".repeat(20);
const bob = "0x" + "bb".repeat(20);
const visitor = "0x" + "cc".repeat(20);
const config = { protocol_version: 6, appeal_policy: APPEAL_POLICY };

function fixture(status = "appeal_window") {
  return normalizeAgreement({
    id: "case-6",
    protocol_version: 6,
    appeal_policy: APPEAL_POLICY,
    party_a: alice,
    party_b: bob,
    status,
    appeal_deadline: 200,
    provisional_verdict: { reason_code: "PARTY_B_NO_PERFORMANCE" },
    appeal: {
      evidence_deadline: 300,
      resolution_deadline: 400,
      party_a_evidence_count: 3,
      party_b_evidence_count: 0,
      party_a_ready: false,
      party_b_ready: false,
    },
  });
}

test("appeal controls require both on-chain policy markers and protocol six", () => {
  const a = fixture();
  assert.equal(appealSupported(a, config), true);
  assert.equal(appealSupported({ ...a, protocol_version: 5 }, config), false);
  assert.equal(appealSupported(a, { ...config, protocol_version: 5 }), false);
  assert.equal(appealSupported(a, { ...config, appeal_policy: "" }), false);
});

test("only agreement parties file before the exact deadline; anyone can finalize afterward", () => {
  const a = fixture();
  assert.equal(appealActions(a, alice, 199).file, true);
  assert.equal(appealActions(a, visitor, 199).file, false);
  assert.equal(appealActions(a, alice, 200).file, false);
  assert.equal(appealActions(a, visitor, 200).finalizeUnappealed, true);
  assert.equal(appealActions(a, "", 200).finalizeUnappealed, false);
  assert.equal(agreementDeadline(a), 200);
  assert.match(nextStep(a, alice, 199).title, /provisional/i);
});

test("appeal evidence and consensus respect roles, quotas and deadlines", () => {
  const evidence = fixture("appeal_evidence");
  assert.equal(appealActions(evidence, alice, 299).submitEvidence, false);
  assert.equal(appealActions(evidence, bob, 299).submitEvidence, true);
  assert.equal(appealActions(evidence, bob, 300).submitEvidence, false);
  assert.equal(appealActions(evidence, visitor, 300).closeEvidence, true);
  assert.equal(agreementDeadline(evidence), 300);
  const ready = fixture("appeal_ready");
  assert.equal(appealActions(ready, visitor, 350).resolve, false);
  assert.equal(appealActions(ready, bob, 350).resolve, true);
  assert.equal(appealActions(ready, bob, 400).resolve, false);
  assert.equal(appealActions(ready, visitor, 400).finalizeTimeout, true);
  assert.equal(agreementDeadline(ready), 400);
});

test("original ruling remains actionable after a stalled appeal deadline", () => {
  const stalled = fixture("appeal_stalled");
  assert.equal(appealActions(stalled, bob, 399).resolve, true);
  assert.equal(appealActions(stalled, visitor, 399).finalizeTimeout, false);
  assert.equal(appealActions(stalled, visitor, 400).finalizeTimeout, true);
  assert.match(nextStep(stalled, bob, 399).detail, /original ruling/i);
});

test("operator exposes only permissionless appeal expiry actions", () => {
  const record = { id: "case-6", protocol_version: 6, appeal_deadline: 200 };
  assert.deepEqual(
    operatorActions({ ...record, status: "appeal_window" }, [], false, 199),
    [],
  );
  assert.equal(
    operatorActions({ ...record, status: "appeal_window" }, [], false, 200)[0]
      .method,
    "finalize_unappealed",
  );
  const appeal = { evidence_deadline: 300, resolution_deadline: 400 };
  assert.equal(
    operatorActions(
      { ...record, appeal, status: "appeal_evidence" },
      [],
      false,
      300,
    )[0].method,
    "close_appeal_evidence",
  );
  assert.equal(
    operatorActions(
      { ...record, appeal, status: "appeal_evidence" },
      [],
      false,
      400,
    )[0].method,
    "finalize_appeal_timeout",
  );
  assert.deepEqual(
    operatorActions(
      { ...record, appeal, status: "appeal_ready" },
      [],
      false,
      350,
    ),
    [],
  );
});
