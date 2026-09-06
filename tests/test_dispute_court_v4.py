"""Direct-mode lifecycle, evidence, and conservation tests for DisputeCourtV4."""

import hashlib
import json
from pathlib import Path

import pytest


CONTRACT_PATH = str(
    Path(__file__).resolve().parents[1] / "contracts" / "dispute_court_v4.py"
)
DIRECT_TEST_SDK_VERSION = "v0.2.16"

FEE_BPS = 200
ESCROW = 1_000
DAY = 24 * 3600
TITLE = "Brand identity delivery"
SUMMARY = "Party B will deliver the approved brand identity package to Party A."
CRITERIA = "Award Party B for conforming delivery; award Party A for material non-delivery."
SOURCE_URL = "https://evidence.example.com/delivery-42"
SOURCE_BODY = "Package 42 delivered on 2025-12-30 and acknowledged by Party A."
SOURCE_DIGEST = hashlib.sha256(SOURCE_BODY.encode("utf-8")).hexdigest()

T0 = "2026-01-01T00:00:00+00:00"
T_AFTER_DAY = "2026-01-02T00:00:01+00:00"


def addr(account) -> str:
    if isinstance(account, str):
        return account.lower()
    raw = account.as_bytes if hasattr(account, "as_bytes") else bytes(account)
    return "0x" + bytes(raw).hex()


@pytest.fixture()
def court_v4(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp(T0)
    return direct_deploy(CONTRACT_PATH, FEE_BPS, sdk_version=DIRECT_TEST_SDK_VERSION)


def create_agreement(
    court_v4, direct_vm, party_a, party_b, agreement_id="agreement-1", **overrides
):
    values = {
        "agreement_id": agreement_id,
        "party_b": addr(party_b),
        "title": TITLE,
        "summary": SUMMARY,
        "criteria": CRITERIA,
        "amount_wei": ESCROW,
        "acceptance_window_seconds": DAY,
        "funding_window_seconds": DAY,
        "performance_window_seconds": 7 * DAY,
        "response_window_seconds": DAY,
        "evidence_window_seconds": DAY,
    }
    values.update(overrides)
    direct_vm.sender = party_a
    return court_v4.create_agreement(**values)


def accept_and_fund(court_v4, direct_vm, party_a, party_b, agreement_id="agreement-1"):
    direct_vm.sender = party_b
    court_v4.accept_agreement(agreement_id)
    direct_vm.sender = party_a
    direct_vm.value = ESCROW
    try:
        return court_v4.fund_agreement(agreement_id)
    finally:
        direct_vm.value = 0


def open_answered_dispute(
    court_v4, direct_vm, party_a, party_b, opener=None, agreement_id="agreement-1"
):
    create_agreement(court_v4, direct_vm, party_a, party_b, agreement_id)
    accept_and_fund(court_v4, direct_vm, party_a, party_b, agreement_id)
    opener = opener or party_a
    responder = party_b if addr(opener) == addr(party_a) else party_a
    direct_vm.sender = opener
    court_v4.open_dispute(agreement_id, "The accepted delivery terms were not satisfied.")
    direct_vm.sender = responder
    return court_v4.respond_to_dispute(
        agreement_id, "The delivery was completed and the receipt proves it."
    )


def submit_source(court_v4, direct_vm, party, agreement_id="agreement-1", digest=SOURCE_DIGEST):
    direct_vm.sender = party
    return court_v4.submit_evidence(
        agreement_id,
        "Delivery receipt and acknowledgement.",
        SOURCE_URL,
        digest,
    )


def ready_both(court_v4, direct_vm, party_a, party_b, agreement_id="agreement-1"):
    direct_vm.sender = party_a
    court_v4.mark_ready(agreement_id)
    direct_vm.sender = party_b
    return court_v4.mark_ready(agreement_id)


def mock_decision(direct_vm, performance_level="substantial", outcome="decision", refs=None):
    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r"https://evidence\.example\.com/delivery-42",
        {"status": 200, "body": SOURCE_BODY},
    )
    direct_vm.mock_llm(
        r"(?s).*impartial bilateral escrow adjudicator.*",
        json.dumps(
            {
                "outcome": outcome,
                "performance_level": performance_level,
                "evidence_refs": refs if refs is not None else ["evidence-001"],
                "reasoning": "The delivery receipt supports a mostly Party B award.",
            }
        ),
    )


def test_agreement_is_immutable_and_requires_bilateral_acceptance(
    court_v4, direct_vm, direct_alice, direct_bob, direct_charlie
):
    created = create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    record = court_v4.get_agreement("agreement-1")
    assert created["status"] == "awaiting_acceptance"
    assert record["party_a"].lower() == addr(direct_alice)
    assert record["party_b"].lower() == addr(direct_bob)
    assert record["fee_bps"] == FEE_BPS
    assert record["fee_policy"] == "adjudicated_resolutions_only"
    assert record["decision_buckets"] == [0, 25, 50, 75, 100]
    assert record["decision_policy"] == "party_b_performance_level_v1"
    assert record["party_a_role"] == "funder_refund_side"
    assert record["party_b_role"] == "performer_payment_side"
    assert record["performance_levels"] == [
        "none", "limited", "partial", "substantial", "full"
    ]
    assert len(record["terms_hash"]) == 64

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only Party B"):
        court_v4.accept_agreement("agreement-1")
    direct_vm.sender = direct_bob
    accepted = court_v4.accept_agreement("agreement-1")
    assert accepted["status"] == "awaiting_funding"


def test_creation_rejects_invalid_parties_amounts_and_windows(
    court_v4, direct_vm, direct_alice, direct_bob
):
    with direct_vm.expect_revert("must differ"):
        create_agreement(court_v4, direct_vm, direct_alice, direct_alice)
    with direct_vm.expect_revert("greater than zero"):
        create_agreement(court_v4, direct_vm, direct_alice, direct_bob, amount_wei=0)
    with direct_vm.expect_revert("Acceptance window must be between"):
        create_agreement(
            court_v4,
            direct_vm,
            direct_alice,
            direct_bob,
            acceptance_window_seconds=60,
        )


def test_funding_is_party_a_only_and_exact(
    court_v4, direct_vm, direct_alice, direct_bob, direct_charlie
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    court_v4.accept_agreement("agreement-1")

    direct_vm.sender = direct_charlie
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Only Party A"):
        court_v4.fund_agreement("agreement-1")
    direct_vm.value = 0

    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW - 1
    with direct_vm.expect_revert("Exact escrow amount required"):
        court_v4.fund_agreement("agreement-1")
    direct_vm.value = ESCROW
    funded = court_v4.fund_agreement("agreement-1")
    direct_vm.value = 0
    assert funded["status"] == "funded"
    assert funded["performance_due_at"] > 0


def test_fee_change_is_delayed_and_only_affects_future_agreements(
    court_v4, direct_vm, direct_alice, direct_bob
):
    create_agreement(
        court_v4, direct_vm, direct_alice, direct_bob, agreement_id="old-terms"
    )
    direct_vm.sender = direct_alice
    court_v4.schedule_fee_bps(300)
    with direct_vm.expect_revert("timelocked"):
        court_v4.apply_scheduled_fee()
    direct_vm.warp(T_AFTER_DAY)
    court_v4.apply_scheduled_fee()
    create_agreement(
        court_v4, direct_vm, direct_alice, direct_bob, agreement_id="new-terms"
    )
    assert court_v4.get_agreement("old-terms")["fee_bps"] == FEE_BPS
    assert court_v4.get_agreement("new-terms")["fee_bps"] == 300


def test_cooperative_release_is_full_and_fee_free(
    court_v4, direct_vm, direct_alice, direct_bob
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    result = court_v4.release_to_party_b("agreement-1")
    assert result["paid"] == {
        "fee_wei": "0",
        "party_a_wei": "0",
        "party_b_wei": str(ESCROW),
        "conservation_wei": str(ESCROW),
    }
    assert court_v4.get_credit(addr(direct_bob))["credit_wei"] == str(ESCROW)
    assert court_v4.get_credit(addr(direct_alice))["credit_wei"] == "0"


def test_cooperative_refund_requires_party_b_authorization(
    court_v4, direct_vm, direct_alice, direct_bob
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only Party B"):
        court_v4.refund_to_party_a("agreement-1")
    direct_vm.sender = direct_bob
    result = court_v4.refund_to_party_a("agreement-1")
    assert result["paid"]["party_a_wei"] == str(ESCROW)
    assert result["paid"]["fee_wei"] == "0"


def test_response_no_show_uses_preaccepted_rule_and_conserves_value(
    court_v4, direct_vm, direct_alice, direct_bob
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    court_v4.open_dispute("agreement-1", "No conforming delivery was made.")
    with direct_vm.expect_revert("remains open"):
        court_v4.resolve_no_show("agreement-1")
    direct_vm.warp(T_AFTER_DAY)
    result = court_v4.resolve_no_show("agreement-1")
    assert result["verdict"]["party_a_pct"] == 100
    assert result["paid"]["fee_wei"] == "20"
    assert result["paid"]["party_a_wei"] == "980"
    assert result["paid"]["conservation_wei"] == str(ESCROW)


def test_evidence_requires_integrity_commitment_and_both_can_close_early(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("64-character"):
        court_v4.submit_evidence(
            "agreement-1", "Receipt", SOURCE_URL, "not-a-digest"
        )
    evidence = submit_source(court_v4, direct_vm, direct_alice)
    assert evidence["id"] == "evidence-001"
    ready = ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    assert ready["status"] == "ready_for_resolution"


def test_ai_resolution_derives_exact_allocation_from_performance_level(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_bob)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, performance_level="substantial")
    result = court_v4.resolve("agreement-1")

    assert result["verdict"]["party_a_pct"] == 25
    assert result["verdict"]["party_b_pct"] == 75
    assert result["verdict"]["performance_level"] == "substantial"
    assert result["verdict"]["party_b_performance_pct"] == 75
    assert result["verdict"]["reason_code"] == "PARTY_B_SUBSTANTIAL_PERFORMANCE"
    assert result["verdict"]["evidence_refs"] == ["evidence-001"]
    assert result["paid"] == {
        "fee_wei": "20",
        "party_a_wei": "245",
        "party_b_wei": "735",
        "conservation_wei": str(ESCROW),
    }
    attempt = court_v4.get_resolution_attempt("agreement-1", 1)
    assert attempt["source_digest_bundle"]
    assert court_v4.get_credit(addr(direct_alice))["credit_wei"] == "265"
    assert court_v4.get_credit(addr(direct_bob))["credit_wei"] == "735"


def test_invalid_performance_level_is_rejected(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_alice)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, performance_level="mostly")
    with direct_vm.expect_revert("must be one of"):
        court_v4.resolve("agreement-1")


def test_model_cannot_choose_directional_payout_percentage(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_bob)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r"https://evidence\.example\.com/delivery-42",
        {"status": 200, "body": SOURCE_BODY},
    )
    direct_vm.mock_llm(
        r"(?s).*impartial bilateral escrow adjudicator.*",
        json.dumps(
            {
                "outcome": "decision",
                "performance_level": "full",
                "party_a_pct": 100,
                "evidence_refs": ["evidence-001"],
                "reasoning": "Party B fully performed.",
            }
        ),
    )
    with direct_vm.expect_revert("not payout percentages"):
        court_v4.resolve("agreement-1")
    assert court_v4.get_credit(addr(direct_alice))["credit_wei"] == "0"
    assert court_v4.get_credit(addr(direct_bob))["credit_wei"] == "0"


def test_full_party_b_performance_can_only_pay_party_b(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_bob)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, performance_level="full")
    result = court_v4.resolve("agreement-1")
    assert result["verdict"]["performance_level"] == "full"
    assert result["verdict"]["reason_code"] == "PARTY_B_FULL_PERFORMANCE"
    assert result["verdict"]["party_a_pct"] == 0
    assert result["verdict"]["party_b_pct"] == 100
    assert result["paid"]["party_a_wei"] == "0"
    assert result["paid"]["party_b_wei"] == "980"


def test_digest_mismatch_reopens_then_reaches_transparent_fallback(
    court_v4, direct_vm, direct_alice, direct_bob
):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_alice, digest="0" * 64)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm)

    first = court_v4.resolve("agreement-1")
    assert first["outcome"] == "needs_evidence"
    assert first["status"] == "evidence"
    assert first["reopen_count"] == 1

    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    second = court_v4.resolve("agreement-1")
    assert second["reopen_count"] == 2
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    third = court_v4.resolve("agreement-1")
    assert third["status"] == "resolution_stalled"

    direct_vm.sender = direct_bob
    fallback = court_v4.resolve_fallback_split("agreement-1")
    assert fallback["verdict"]["party_a_pct"] == 50
    assert fallback["paid"] == {
        "fee_wei": "20",
        "party_a_wei": "490",
        "party_b_wei": "490",
        "conservation_wei": str(ESCROW),
    }


def test_withdraw_labels_emission_not_delivery(
    court_v4, direct_vm, direct_alice, direct_bob
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    court_v4.release_to_party_b("agreement-1")
    direct_vm.sender = direct_bob
    payout = court_v4.withdraw()
    assert payout["amount_wei"] == str(ESCROW)
    assert payout["status"] == "emitted_for_finalization"
    assert "not confirmation" in payout["delivery_note"]
    assert court_v4.get_payout(payout["id"])["recipient"] == addr(direct_bob)


def test_lists_and_owner_stats_are_bounded_and_role_aware(
    court_v4, direct_vm, direct_alice, direct_bob, direct_charlie
):
    create_agreement(
        court_v4, direct_vm, direct_alice, direct_bob, agreement_id="a"
    )
    create_agreement(
        court_v4, direct_vm, direct_alice, direct_charlie, agreement_id="b"
    )
    page = court_v4.list_agreements(1, 1)
    assert [item["id"] for item in page["items"]] == ["b"]
    mine = court_v4.list_my_agreements(addr(direct_bob), 0, 10)
    assert [item["id"] for item in mine["items"]] == ["a"]
    stats = court_v4.get_stats()
    assert stats["agreements_created"] == 2
    assert stats["agreements_resolved"] == 0


@pytest.mark.parametrize("amount", [1, 3, 19, 21, 999, 10**18 + 1])
@pytest.mark.parametrize(
    "performance_level,party_a_pct",
    [("none", 100), ("limited", 75), ("partial", 50), ("substantial", 25), ("full", 0)],
)
def test_all_performance_levels_conserve_dust(
    court_v4, direct_vm, direct_alice, direct_bob, amount, performance_level, party_a_pct
):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob, amount_wei=amount)
    direct_vm.sender = direct_bob
    court_v4.accept_agreement("agreement-1")
    direct_vm.sender = direct_alice
    direct_vm.value = amount
    court_v4.fund_agreement("agreement-1")
    direct_vm.value = 0
    court_v4.open_dispute("agreement-1", "Boundary allocation test")
    direct_vm.sender = direct_bob
    court_v4.respond_to_dispute("agreement-1", "Public evidence is submitted for review.")
    submit_source(court_v4, direct_vm, direct_bob)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, performance_level=performance_level)
    result = court_v4.resolve("agreement-1")
    paid = result["paid"]
    fee = amount * FEE_BPS // 10_000
    net = amount - fee
    expected_a = net * party_a_pct // 100
    expected_b = net - expected_a
    assert paid["party_a_wei"] == str(expected_a)
    assert paid["party_b_wei"] == str(expected_b)
    assert paid["fee_wei"] == str(fee)
    assert sum(int(paid[key]) for key in ["party_a_wei", "party_b_wei", "fee_wei"]) == amount
    assert court_v4.get_credit(addr(direct_alice))["credit_wei"] == str(expected_a + fee)
    assert court_v4.get_credit(addr(direct_bob))["credit_wei"] == str(expected_b)


def test_unknown_model_citations_cannot_settle(court_v4, direct_vm, direct_alice, direct_bob):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    submit_source(court_v4, direct_vm, direct_bob)
    ready_both(court_v4, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, performance_level="none", refs=["evidence-999"])
    with direct_vm.expect_revert("Unknown evidence"):
        court_v4.resolve("agreement-1")
    assert court_v4.get_agreement("agreement-1")["status"] == "ready_for_resolution"
    assert court_v4.get_credit(addr(direct_bob))["credit_wei"] == "0"


def test_evidence_budget_is_per_party_and_hard_bounded(court_v4, direct_vm, direct_alice, direct_bob, direct_charlie):
    open_answered_dispute(court_v4, direct_vm, direct_alice, direct_bob)
    for party in [direct_alice, direct_bob]:
        direct_vm.sender = party
        for index in range(10):
            court_v4.submit_evidence("agreement-1", f"Exhibit {index}", f"https://example.com/exhibit-{index}", SOURCE_DIGEST)
        with direct_vm.expect_revert("Evidence limit"):
            court_v4.submit_evidence("agreement-1", "Eleventh", SOURCE_URL, SOURCE_DIGEST)
    assert len(court_v4.get_agreement("agreement-1")["evidence"]) == 20
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only agreement parties"):
        court_v4.submit_evidence("agreement-1", "Outsider", SOURCE_URL, SOURCE_DIGEST)


def test_response_deadline_no_show_and_early_dispute_policy(court_v4, direct_vm, direct_alice, direct_bob, direct_charlie):
    create_agreement(court_v4, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v4, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    opened = court_v4.open_dispute("agreement-1", "The v2 early-dispute policy is explicit.")
    assert opened["status"] == "awaiting_response"
    direct_vm.warp("2026-01-02T00:00:00+00:00")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert():
        court_v4.respond_to_dispute("agreement-1", "At the exact deadline is too late.")
    direct_vm.sender = direct_charlie
    result = court_v4.resolve_no_show("agreement-1")
    assert result["status"] == "resolved"
    assert result["paid"]["conservation_wei"] == str(ESCROW)
