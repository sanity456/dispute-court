import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgreement, agreementActions, agreementRole } from "../lib/lifecycle.ts";
const agreement = normalizeAgreement({id:"a",party_a:"0xaa",party_b:"0xbb",status:"awaiting_acceptance",acceptance_deadline:100,funding_deadline:200});
test("only the correct party can accept, fund, release, or refund", () => {
  assert.equal(agreementActions(agreement,"0xaa",50).accept,false);
  assert.equal(agreementActions(agreement,"0xbb",50).accept,true);
  assert.equal(agreementActions(agreement,"0xbb",100).accept,false);
  assert.equal(agreementActions({...agreement,status:"awaiting_funding"},"0xaa",150).fund,true);
  assert.equal(agreementActions({...agreement,status:"awaiting_funding"},"0xbb",150).fund,false);
  assert.equal(agreementActions({...agreement,status:"funded"},"0xaa",150).release,true);
  assert.equal(agreementActions({...agreement,status:"funded"},"0xbb",150).refund,true);
  assert.equal(agreementRole(agreement,"0xAA"),"party_a");
});
test("responding and no-show are mutually exclusive at the signed deadline", () => {
  const a={...agreement,status:"awaiting_response",dispute_responder:"0xbb",response_deadline:200};
  assert.equal(agreementActions(a,"0xaa",199).respond,false);
  assert.equal(agreementActions(a,"0xbb",199).respond,true);
  assert.equal(agreementActions(a,"0xbb",200).respond,false);
  assert.equal(agreementActions(a,"0xaa",200).noShow,true);
});
test("evidence, ready, resolve, and fallback follow the state machine", () => {
  const a={...agreement,status:"evidence",evidence_deadline:300,party_a_ready:true};
  assert.equal(agreementActions(a,"0xaa",250).evidence,true);
  assert.equal(agreementActions(a,"0xaa",250).ready,false);
  assert.equal(agreementActions(a,"0xbb",250).ready,true);
  assert.equal(agreementActions(a,"0xbb",300).evidence,false);
  assert.equal(agreementActions(a,"0xbb",300).closeEvidence,true);
  assert.equal(agreementActions({...a,status:"ready_for_resolution"},"0xaa",300).resolve,true);
  assert.equal(agreementActions({...a,status:"resolution_stalled"},"0xaa",300).fallback,true);
  assert.equal(agreementActions({...a,status:"resolution_stalled"},"0xcc",300).fallback,false);
});
