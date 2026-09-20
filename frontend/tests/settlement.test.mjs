import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgreement } from "../lib/lifecycle.ts";
import { agreementReviewKey } from "../lib/workspace-review.ts";
import { contractSurface } from "../lib/contract-surface.ts";
import { isSecurityRelease } from "../lib/release-policy.ts";
import {
  settlementAllocation,
  settlementActions,
  negotiationSupported,
  NEGOTIATION_POLICY,
} from "../lib/settlement.ts";

const a = "0x" + "aa".repeat(20),
  b = "0x" + "bb".repeat(20);

test("candidate writes stay unavailable on the active v4 release", () => {
  assert.equal(contractSurface(4).propose_settlement, undefined);
  assert.equal(contractSurface(5).propose_settlement.readonly, false);
  assert.equal(contractSurface(5).accept_settlement.params.length, 2);
  assert.throws(() => contractSurface(6));
  assert.equal(
    isSecurityRelease({ protocol_version: 5, max_source_bytes: 6000 }),
    false,
  );
  assert.equal(
    isSecurityRelease({ protocol_version: 4, max_source_bytes: 6000 }),
    true,
  );
});
function fixture() {
  return normalizeAgreement({
    id: "case-1",
    terms_hash: "terms",
    protocol_version: 5,
    negotiation_policy: NEGOTIATION_POLICY,
    amount_wei: "101",
    party_a: a,
    party_b: b,
    status: "evidence",
    resolution_deadline: 2000,
    settlement_offer_count: 1,
    party_a_offer_count: 1,
    party_b_offer_count: 0,
    settlement_offer: {
      agreement_id: "case-1",
      terms_hash: "terms",
      number: 1,
      proposer: a,
      recipient: b,
      party_a_pct: 67,
      party_b_pct: 33,
      ...settlementAllocation("101", 33),
      status: "pending",
      effective_expires_at: 1000,
    },
  });
}
test("exact preview agrees with contract rounding without floating point amounts", () => {
  for (const amount of [1n, 101n, 1000n, (1n << 256n) - 1n]) {
    for (let percentage = 0; percentage <= 100; percentage++) {
      const result = settlementAllocation(String(amount), percentage);
      assert.equal(
        BigInt(result.party_a_wei),
        (amount * BigInt(100 - percentage)) / 100n,
      );
      assert.equal(
        BigInt(result.party_a_wei) + BigInt(result.party_b_wei),
        amount,
      );
      assert.equal(result.fee_wei, "0");
    }
  }
  for (const amount of ["", "0", "-1", "1e3", "1.0", String(1n << 256n)])
    assert.throws(() => settlementAllocation(amount, 50));
  for (const pct of [-1, 101, NaN, 0.5, true, "50"])
    assert.throws(() => settlementAllocation("1000", pct));
});
test("negotiation requires an explicit v5 policy in both agreement and config", () => {
  const agreement = fixture(),
    config = { protocol_version: 5, negotiation_policy: NEGOTIATION_POLICY };
  assert.equal(negotiationSupported(agreement, config), true);
  for (const version of [3, 4, 6]) {
    assert.equal(
      negotiationSupported({ ...agreement, protocol_version: version }, config),
      false,
    );
    assert.equal(
      negotiationSupported(agreement, { ...config, protocol_version: version }),
      false,
    );
  }
  assert.equal(negotiationSupported(agreement, null), false);
});
test("only the recipient accepts/rejects and only the proposer cancels", () => {
  const agreement = fixture();
  assert.equal(settlementActions(agreement, b, 500).accept, true);
  assert.equal(settlementActions(agreement, b, 500).reject, true);
  assert.equal(settlementActions(agreement, b, 500).cancel, false);
  assert.equal(settlementActions(agreement, a, 500).accept, false);
  assert.equal(settlementActions(agreement, a, 500).cancel, true);
  const outsider = settlementActions(agreement, "0x" + "cc".repeat(20), 500);
  for (const action of ["propose", "accept", "reject", "cancel"])
    assert.equal(outsider[action], false);
});
test("expired, replaced, terminal, inconsistent and malformed offers fail closed", () => {
  const agreement = fixture();
  for (const changes of [
    { number: 2 },
    { status: "accepted" },
    { status: "cancelled" },
    { status: "rejected" },
    { status: "superseded" },
    { terms_hash: "changed" },
    { agreement_id: "other" },
    { recipient: a },
    { proposer: b },
    { effective_expires_at: NaN },
    { party_b_wei: "999" },
    { fee_wei: "1" },
    { party_b_pct: "33" },
  ]) {
    const state = settlementActions(
      {
        ...agreement,
        settlement_offer: { ...agreement.settlement_offer, ...changes },
      },
      b,
      500,
    );
    assert.equal(state.accept, false, JSON.stringify(changes));
  }
  for (const now of [0, NaN, 1000, 1001, 2000])
    assert.equal(settlementActions(agreement, b, now).accept, false);
  for (const status of [
    "awaiting_acceptance",
    "awaiting_funding",
    "resolved",
    "cancelled",
  ])
    assert.equal(
      settlementActions({ ...agreement, status }, b, 500).accept,
      false,
    );
  assert.equal(
    settlementActions(
      { ...agreement, status: "awaiting_response", response_deadline: 500 },
      b,
      500,
    ).accept,
    false,
  );
});
test("quota is per party and never disables responding", () => {
  const agreement = { ...fixture(), party_a_offer_count: 50 };
  assert.equal(settlementActions(agreement, a, 500).propose, false);
  assert.equal(settlementActions(agreement, b, 500).propose, true);
  assert.equal(
    settlementActions({ ...agreement, party_b_offer_count: 50 }, b, 500).accept,
    true,
  );
});
test("normalization preserves offer state and every offer change invalidates consent", () => {
  const agreement = fixture(),
    key = agreementReviewKey(agreement);
  assert.equal(agreementReviewKey(normalizeAgreement(agreement)), key);
  for (const change of [
    { party_b_pct: 40 },
    { number: 2 },
    { status: "cancelled" },
    { effective_expires_at: 1200 },
  ])
    assert.notEqual(
      agreementReviewKey(
        normalizeAgreement({
          ...agreement,
          settlement_offer: { ...agreement.settlement_offer, ...change },
        }),
      ),
      key,
    );
});
