import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAgreement,
  agreementActions,
  agreementRole,
  agreementDeadline,
} from "../lib/lifecycle.ts";
import { operatorActions } from "../lib/operator-policy.ts";
import { nextStep } from "../lib/reminders.ts";
const agreement = normalizeAgreement({
  id: "a",
  party_a: "0xaa",
  party_b: "0xbb",
  status: "awaiting_acceptance",
  acceptance_deadline: 100,
  funding_deadline: 200,
});
test("only the correct party can accept, fund, release, or refund", () => {
  assert.equal(agreementActions(agreement, "0xaa", 50).accept, false);
  assert.equal(agreementActions(agreement, "0xbb", 50).accept, true);
  assert.equal(agreementActions(agreement, "0xbb", 100).accept, false);
  assert.equal(
    agreementActions({ ...agreement, status: "awaiting_funding" }, "0xaa", 150)
      .fund,
    true,
  );
  assert.equal(
    agreementActions({ ...agreement, status: "awaiting_funding" }, "0xbb", 150)
      .fund,
    false,
  );
  assert.equal(
    agreementActions({ ...agreement, status: "funded" }, "0xaa", 150).release,
    true,
  );
  assert.equal(
    agreementActions({ ...agreement, status: "funded" }, "0xbb", 150).refund,
    true,
  );
  assert.equal(agreementRole(agreement, "0xAA"), "party_a");
});
test("responding and no-show are mutually exclusive at the signed deadline", () => {
  const a = {
    ...agreement,
    status: "awaiting_response",
    dispute_responder: "0xbb",
    response_deadline: 200,
  };
  assert.equal(agreementActions(a, "0xaa", 199).respond, false);
  assert.equal(agreementActions(a, "0xbb", 199).respond, true);
  assert.equal(agreementActions(a, "0xbb", 200).respond, false);
  assert.equal(agreementActions(a, "0xaa", 200).noShow, true);
});
test("evidence, ready, resolve, and fallback follow the state machine", () => {
  const a = {
    ...agreement,
    status: "evidence",
    evidence_deadline: 300,
    party_a_ready: true,
  };
  assert.equal(agreementActions(a, "0xaa", 250).evidence, true);
  assert.equal(agreementActions(a, "0xaa", 250).ready, false);
  assert.equal(agreementActions(a, "0xbb", 250).ready, true);
  assert.equal(agreementActions(a, "0xbb", 300).evidence, false);
  assert.equal(agreementActions(a, "0xbb", 300).closeEvidence, true);
  assert.equal(
    agreementActions({ ...a, status: "ready_for_resolution" }, "0xaa", 300)
      .resolve,
    true,
  );
  assert.equal(
    agreementActions({ ...a, status: "resolution_stalled" }, "0xaa", 300)
      .fallback,
    true,
  );
  assert.equal(
    agreementActions({ ...a, status: "resolution_stalled" }, "0xcc", 300)
      .fallback,
    false,
  );
});

test("v3+ timeout is party-only at the fixed deadline and displaces all adjudication actions", () => {
  for (const status of [
    "evidence",
    "ready_for_resolution",
    "resolution_stalled",
  ]) {
    const a = {
      ...agreement,
      protocol_version: 4,
      status,
      evidence_deadline: 300,
      resolution_deadline: 500,
    };
    assert.equal(agreementActions(a, "0xaa", 499).timeout, false);
    for (const party of ["0xaa", "0xbb"]) {
      const actions = agreementActions(a, party, 500);
      assert.equal(actions.timeout, true);
      for (const action of [
        "evidence",
        "ready",
        "closeEvidence",
        "resolve",
        "fallback",
      ])
        assert.equal(actions[action], false, status + ":" + action);
    }
    assert.equal(agreementActions(a, "0xcc", 500).timeout, false);
    assert.equal(agreementActions(a, "", 500).timeout, false);
    assert.deepEqual(operatorActions(a, [], false, 500), []);
    assert.equal(
      nextStep(a, "0xaa", 500).title,
      "Apply the fee-free timeout split",
    );
  }
});

test("v3+ expands voluntary full-counterparty settlement beyond funding", () => {
  for (const status of [
    "awaiting_response",
    "evidence",
    "ready_for_resolution",
    "resolution_stalled",
  ]) {
    const a = { ...agreement, protocol_version: 4, status };
    assert.equal(agreementActions(a, "0xaa", 500).release, true);
    assert.equal(agreementActions(a, "0xaa", 500).refund, false);
    assert.equal(agreementActions(a, "0xbb", 500).refund, true);
    assert.equal(agreementActions(a, "0xbb", 500).release, false);
    assert.equal(agreementActions(a, "0xcc", 500).release, false);
    assert.equal(
      agreementActions({ ...a, protocol_version: 2 }, "0xaa", 500).release,
      false,
    );
  }
});

test("timeout never replaces no-show or a terminal settlement", () => {
  for (const status of [
    "awaiting_response",
    "resolved",
    "cancelled",
    "funded",
  ]) {
    const a = {
      ...agreement,
      protocol_version: 4,
      status,
      response_deadline: 200,
      resolution_deadline: 500,
    };
    assert.equal(agreementActions(a, "0xaa", 500).timeout, false);
  }
  const noShow = {
    ...agreement,
    protocol_version: 4,
    status: "awaiting_response",
    response_deadline: 200,
    resolution_deadline: 500,
  };
  assert.equal(agreementActions(noShow, "0xaa", 500).noShow, true);
  assert.equal(
    operatorActions(noShow, [], false, 500)[0].method,
    "resolve_no_show",
  );
  for (const status of ["ready_for_resolution", "resolution_stalled"]) {
    const a = {
      ...agreement,
      protocol_version: 4,
      status,
      resolution_deadline: 500,
    };
    assert.equal(agreementDeadline(a), 500);
    assert.equal(nextStep(a, "0xaa", 499).deadline, 500);
  }
});
