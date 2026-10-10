"""Bounded appeal lifecycle and escrow conservation against the v6 core."""

import hashlib
from datetime import datetime, timezone
from pathlib import Path

import pytest

from test_dispute_court_v4 import (
    DIRECT_TEST_SDK_VERSION,
    T0,
    accept_and_fund,
    addr,
    create_agreement,
    mock_decision,
    open_answered_dispute,
    ready_both,
    submit_source,
)


ID = "agreement-1"
APPEAL_URL = "https://evidence.example.com/correction-42"
APPEAL_BODY = "The corrected public record confirms the complete accepted delivery."
APPEAL_DIGEST = hashlib.sha256(APPEAL_BODY.encode("utf-8")).hexdigest()


def warp(vm, timestamp):
    vm.warp(datetime.fromtimestamp(timestamp, timezone.utc).isoformat())


@pytest.fixture
def court(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp(T0)
    path = Path(__file__).resolve().parents[1] / "contracts/dispute_court_v6.py"
    return direct_deploy(str(path), 200, sdk_version=DIRECT_TEST_SDK_VERSION)


@pytest.fixture
def provisional(court, direct_vm, direct_alice, direct_bob):
    open_answered_dispute(court, direct_vm, direct_alice, direct_bob)
    submit_source(court, direct_vm, direct_bob)
    ready_both(court, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, "none")
    direct_vm.sender = direct_alice
    result = court.resolve(ID)
    assert result["status"] == "appeal_window"
    return court


def test_provisional_decision_holds_all_escrow(provisional, direct_vm, direct_alice, direct_bob):
    record = provisional.get_agreement(ID)
    assert record["protocol_version"] == 6
    assert record["provisional_verdict"]["reason_code"] == "PARTY_B_NO_PERFORMANCE"
    assert record["paid"]["conservation_wei"] == "0"
    assert provisional.get_credit(addr(direct_alice))["credit_wei"] == "0"
    assert provisional.get_credit(addr(direct_bob))["credit_wei"] == "0"
    assert provisional.get_stats()["agreements_resolved"] == 0
    with direct_vm.expect_revert("No credits available"):
        provisional.withdraw()
    with direct_vm.expect_revert("NEGOTIATION_CLOSED"):
        provisional.propose_settlement(ID, 50, 3600, 0)


def test_unappealed_finalization_uses_stored_boundary(provisional, direct_vm, direct_alice, direct_bob):
    deadline = provisional.get_agreement(ID)["appeal_deadline"]
    warp(direct_vm, deadline - 1)
    with direct_vm.expect_revert("Appeal window remains open"):
        provisional.finalize_unappealed(ID)
    warp(direct_vm, deadline)
    result = provisional.finalize_unappealed(ID)
    assert result["status"] == "resolved"
    assert result["paid"] == {"fee_wei": "20", "party_a_wei": "980", "party_b_wei": "0", "conservation_wei": "1000"}
    assert provisional.get_credit(addr(direct_alice))["credit_wei"] == "1000"
    assert provisional.get_credit(addr(direct_bob))["credit_wei"] == "0"
    with direct_vm.expect_revert("No unappealed decision is pending"):
        provisional.finalize_unappealed(ID)
    with direct_vm.expect_revert("No provisional decision is appealable"):
        provisional.file_appeal(ID, "This is too late")


def test_appeal_is_party_only_once_and_before_deadline(provisional, direct_vm, direct_alice, direct_bob, direct_charlie):
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only agreement parties"):
        provisional.file_appeal(ID, "The verdict is wrong")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("must not be empty"):
        provisional.file_appeal(ID, "  ")
    with direct_vm.expect_revert("exceeds 2000"):
        provisional.file_appeal(ID, "x" * 2001)
    result = provisional.file_appeal(ID, "A receipt was overlooked")
    assert result["status"] == "appeal_evidence"
    assert result["resolution_deadline"] - result["evidence_deadline"] == 48 * 3600
    assert provisional.get_credit(addr(direct_alice))["credit_wei"] == "0"
    with direct_vm.expect_revert("No provisional decision is appealable"):
        provisional.file_appeal(ID, "File twice")
    with direct_vm.expect_revert("No unappealed decision is pending"):
        provisional.finalize_unappealed(ID)


def test_appeal_evidence_limits_roles_and_deadline(provisional, direct_vm, direct_alice, direct_bob, direct_charlie):
    provisional.file_appeal(ID, "Corrected receipt")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only agreement parties"):
        provisional.submit_appeal_evidence(ID, "Correction", APPEAL_URL, APPEAL_DIGEST)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("public HTTPS URL"):
        provisional.submit_appeal_evidence(ID, "Correction", "http://example.com", APPEAL_DIGEST)
    for n in range(3):
        item = provisional.submit_appeal_evidence(ID, f"Correction {n}", APPEAL_URL, APPEAL_DIGEST)
        assert item["stage"] == "appeal"
        assert item["id"] == f"evidence-{n + 2:03d}"
    with direct_vm.expect_revert("Appeal evidence limit reached"):
        provisional.submit_appeal_evidence(ID, "Fourth", APPEAL_URL, APPEAL_DIGEST)
    deadline = provisional.get_agreement(ID)["appeal"]["evidence_deadline"]
    warp(direct_vm, deadline)
    with direct_vm.expect_revert("Appeal evidence window has closed"):
        provisional.submit_appeal_evidence(ID, "Late", APPEAL_URL, APPEAL_DIGEST)
    assert provisional.close_appeal_evidence(ID)["status"] == "appeal_ready"


def test_consensus_appeal_can_change_allocation_once(provisional, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_bob
    provisional.file_appeal(ID, "New delivery receipt establishes full performance")
    provisional.submit_appeal_evidence(ID, "Corrected public receipt", APPEAL_URL, APPEAL_DIGEST)
    direct_vm.sender = direct_alice
    provisional.mark_appeal_ready(ID)
    direct_vm.sender = direct_bob
    assert provisional.mark_appeal_ready(ID)["status"] == "appeal_ready"
    mock_decision(direct_vm, "full", refs=["evidence-002"])
    direct_vm.mock_web(r"https://evidence\.example\.com/correction-42", {"status": 200, "body": APPEAL_BODY})
    result = provisional.resolve_appeal(ID)
    assert result["verdict"]["reason_code"] == "PARTY_B_FULL_PERFORMANCE"
    assert result["verdict"]["resolution_type"] == "appeal_adjudication"
    assert result["paid"] == {"fee_wei": "20", "party_a_wei": "0", "party_b_wei": "980", "conservation_wei": "1000"}
    assert provisional.get_credit(addr(direct_alice))["credit_wei"] == "20"
    assert provisional.get_credit(addr(direct_bob))["credit_wei"] == "980"
    assert provisional.get_agreement(ID)["provisional_verdict"]["reason_code"] == "PARTY_B_NO_PERFORMANCE"
    assert provisional.get_resolution_attempt(ID, 2)["stage"] == "appeal"
    assert provisional.get_stats()["appeals_changed"] == 1
    assert provisional.get_stats()["agreements_resolved"] == 1
    with direct_vm.expect_revert("Appeal is not ready"):
        provisional.resolve_appeal(ID)


def test_inconclusive_early_review_reopens_only_remaining_evidence_window(provisional, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_bob
    provisional.file_appeal(ID, "A public correction is expected shortly")
    original_deadline = provisional.get_agreement(ID)["appeal"]["evidence_deadline"]
    direct_vm.sender = direct_alice
    provisional.mark_appeal_ready(ID)
    direct_vm.sender = direct_bob
    provisional.mark_appeal_ready(ID)
    direct_vm.clear_mocks()
    result = provisional.resolve_appeal(ID)
    assert result["status"] == "appeal_evidence"
    record = provisional.get_agreement(ID)
    assert record["appeal"]["evidence_deadline"] == original_deadline
    assert record["appeal"]["party_a_ready"] is False
    assert record["appeal"]["party_b_ready"] is False
    assert provisional.get_credit(addr(direct_bob))["credit_wei"] == "0"
    provisional.submit_appeal_evidence(ID, "Correction", APPEAL_URL, APPEAL_DIGEST)
    warp(direct_vm, original_deadline)
    with direct_vm.expect_revert("Appeal evidence window has closed"):
        provisional.submit_appeal_evidence(ID, "Late correction", APPEAL_URL, APPEAL_DIGEST)


def test_unresolved_appeal_is_bounded_and_original_stands(provisional, direct_vm, direct_alice, direct_bob, direct_charlie):
    direct_vm.sender = direct_bob
    provisional.file_appeal(ID, "Source availability should be reconsidered")
    appeal = provisional.get_agreement(ID)["appeal"]
    warp(direct_vm, appeal["evidence_deadline"])
    provisional.close_appeal_evidence(ID)
    direct_vm.clear_mocks()
    result = provisional.resolve_appeal(ID)
    assert result["status"] == "appeal_stalled"
    assert result["credit_issued"] is False
    assert provisional.get_credit(addr(direct_alice))["credit_wei"] == "0"
    with direct_vm.expect_revert("has not been reached"):
        provisional.finalize_appeal_timeout(ID)
    warp(direct_vm, appeal["resolution_deadline"])
    direct_vm.sender = direct_charlie
    result = provisional.finalize_appeal_timeout(ID)
    assert result["verdict"]["resolution_type"] == "appeal_timeout_original"
    assert result["paid"]["conservation_wei"] == "1000"
    assert provisional.get_stats()["appeals_timed_out"] == 1


def test_non_ai_cooperative_path_stays_final(court, direct_vm, direct_alice, direct_bob):
    create_agreement(court, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court, direct_vm, direct_alice, direct_bob)
    result = court.release_to_party_b(ID)
    assert result["status"] == "resolved"
    with direct_vm.expect_revert("No provisional decision is appealable"):
        court.file_appeal(ID, "Cooperative release")
    assert court.get_stats()["provisional_decisions"] == 0
