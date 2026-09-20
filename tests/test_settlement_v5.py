"""Negotiation guards and conservation, using stored chain times, never the host clock."""
from datetime import datetime, timezone
from pathlib import Path

import pytest

from test_dispute_court_v4 import (
    create_agreement, accept_and_fund, addr, open_answered_dispute,
    ready_both, submit_source, mock_decision, DIRECT_TEST_SDK_VERSION, T0,
)

ID = "agreement-1"


@pytest.fixture
def court(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp(T0)
    return direct_deploy(str(Path(__file__).resolve().parents[1] / "contracts/dispute_court_v5.py"),
                         200, sdk_version=DIRECT_TEST_SDK_VERSION)


@pytest.fixture
def funded(court, direct_vm, direct_alice, direct_bob):
    create_agreement(court, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court, direct_vm, direct_alice, direct_bob)
    return court


def warp(vm, timestamp):
    vm.warp(datetime.fromtimestamp(timestamp, timezone.utc).isoformat())


@pytest.mark.parametrize("percentage", [0, 1, 33, 50, 67, 99, 100])
@pytest.mark.parametrize("amount", [1, 101, 1000, 2**255 + 1])
def test_exact_conservation_and_one_time_credits(court, direct_vm, direct_alice, direct_bob, percentage, amount):
    create_agreement(court, direct_vm, direct_alice, direct_bob, amount_wei=amount)
    direct_vm.sender = direct_bob
    court.accept_agreement(ID)
    direct_vm.sender = direct_alice
    direct_vm.value = amount
    court.fund_agreement(ID)
    direct_vm.value = 0
    offer = court.propose_settlement(ID, percentage, 3600, 0)
    a = amount * (100 - percentage) // 100
    assert offer["party_a_wei"] == str(a)
    assert offer["party_b_wei"] == str(amount - a)
    direct_vm.sender = direct_bob
    result = court.accept_settlement(ID, 1)
    assert result["paid"] == {"fee_wei": "0", "party_a_wei": str(a),
                              "party_b_wei": str(amount-a), "conservation_wei": str(amount)}
    assert result["verdict"]["reason_code"] == "MUTUAL_SETTLEMENT_ACCEPTED"
    assert result["verdict"]["performance_level"] == "not_evaluated"
    assert court.get_agreement(ID)["accepted_offer_number"] == 1
    with direct_vm.expect_revert("NEGOTIATION_CLOSED"):
        court.accept_settlement(ID, 1)
    assert court.get_credit(addr(direct_alice))["credit_wei"] == str(a)
    assert court.get_credit(addr(direct_bob))["credit_wei"] == str(amount-a)
    assert court.get_stats()["negotiated_resolutions"] == 1
    assert court.get_stats()["fees_accrued_wei"] == "0"


def test_roles_and_outsider_cannot_accept_cancel_or_propose(funded, direct_vm, direct_alice, direct_bob, direct_charlie):
    funded.propose_settlement(ID, 70, 3600, 0)
    for method in (funded.accept_settlement, funded.reject_settlement):
        with direct_vm.expect_revert("ONLY_OFFER_RECIPIENT"):
            method(ID, 1)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("ONLY_OFFER_PROPOSER"):
        funded.cancel_settlement(ID, 1)
    direct_vm.sender = direct_charlie
    for method, args in [(funded.propose_settlement, [ID, 10, 3600, 1]),
                         (funded.accept_settlement, [ID, 1]),
                         (funded.reject_settlement, [ID, 1]),
                         (funded.cancel_settlement, [ID, 1])]:
        with direct_vm.expect_revert("Only agreement parties"):
            method(*args)
    assert funded.get_agreement(ID)["status"] == "funded"


def test_counteroffer_and_stale_requests_cannot_switch_the_accepted_offer(funded, direct_vm, direct_alice, direct_bob):
    first = funded.propose_settlement(ID, 70, 86400, 0)
    direct_vm.sender = direct_bob
    second = funded.propose_settlement(ID, 80, 86400, 1)
    for method, args in [(funded.accept_settlement, [ID, 1]),
                         (funded.reject_settlement, [ID, 1]),
                         (funded.cancel_settlement, [ID, 1]),
                         (funded.propose_settlement, [ID, 90, 3600, 1])]:
        with direct_vm.expect_revert("STALE_OFFER"):
            method(*args)
    with direct_vm.expect_revert("ONLY_OFFER_RECIPIENT"):
        funded.accept_settlement(ID, 2)
    direct_vm.sender = direct_alice
    result = funded.accept_settlement(ID, 2)
    assert result["paid"]["party_b_wei"] == "800"
    history = funded.list_settlement_offers(ID, 0, 50)
    assert [o["status"] for o in history["items"]] == ["superseded", "accepted"]
    assert history["items"][0]["party_b_pct"] == first["party_b_pct"]
    assert history["items"][1]["proposer"] == second["proposer"]


@pytest.mark.parametrize("action", ["cancel", "reject"])
def test_terminal_offers_never_reactivate(funded, direct_vm, direct_alice, direct_bob, action):
    funded.propose_settlement(ID, 60, 3600, 0)
    if action == "reject":
        direct_vm.sender = direct_bob
        funded.reject_settlement(ID, 1)
    else:
        funded.cancel_settlement(ID, 1)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("OFFER_NOT_ACTIVE"):
        funded.accept_settlement(ID, 1)
    assert funded.propose_settlement(ID, 90, 3600, 1)["number"] == 2


@pytest.mark.parametrize("delta,accepted", [(-1, True), (0, False), (1, False)])
def test_stored_offer_expiry_exact_boundary(funded, direct_vm, direct_bob, delta, accepted):
    offer = funded.propose_settlement(ID, 67, 3600, 0)
    warp(direct_vm, offer["expires_at"] + delta)
    direct_vm.sender = direct_bob
    if accepted:
        assert funded.accept_settlement(ID, 1)["paid"]["party_b_wei"] == "670"
    else:
        assert funded.get_settlement_offer(ID, 1)["status"] == "expired"
        with direct_vm.expect_revert("OFFER_NOT_ACTIVE"):
            funded.accept_settlement(ID, 1)


def test_dispute_caps_existing_offer_and_cannot_delay_no_show(funded, direct_vm, direct_alice, direct_bob):
    funded.propose_settlement(ID, 70, 7 * 86400, 0)
    funded.open_dispute(ID, "Delivery missing")
    before = funded.get_agreement(ID)
    assert before["settlement_offer"]["effective_expires_at"] == before["response_deadline"]
    direct_vm.sender = direct_bob
    funded.propose_settlement(ID, 80, 7 * 86400, 1)
    assert funded.get_agreement(ID)["response_deadline"] == before["response_deadline"]
    warp(direct_vm, before["response_deadline"])
    with direct_vm.expect_revert("NEGOTIATION_DEADLINE_REACHED"):
        funded.accept_settlement(ID, 2)
    assert funded.resolve_no_show(ID)["verdict"]["resolution_type"] == "response_no_show"


def test_proposals_do_not_delay_timeout_or_change_evidence(court, direct_vm, direct_alice, direct_bob):
    open_answered_dispute(court, direct_vm, direct_alice, direct_bob)
    submit_source(court, direct_vm, direct_bob)
    before = court.get_agreement(ID)
    offer = court.propose_settlement(ID, 70, 7 * 86400, 0)
    assert offer["expires_at"] == before["resolution_deadline"]
    after = court.get_agreement(ID)
    for field in ("terms_hash", "status", "evidence", "evidence_deadline", "resolution_deadline", "party_a_ready", "party_b_ready"):
        assert after[field] == before[field]
    warp(direct_vm, before["resolution_deadline"])
    with direct_vm.expect_revert("NEGOTIATION_DEADLINE_REACHED"):
        court.propose_settlement(ID, 50, 3600, 1)
    result = court.resolve_timeout_split(ID)
    assert result["paid"]["fee_wei"] == "0"
    assert court.get_settlement_offer(ID, 1)["status"] == "closed"


@pytest.mark.parametrize("winner", ["ai", "offer"])
def test_resolution_race_can_credit_only_once(court, direct_vm, direct_alice, direct_bob, winner):
    open_answered_dispute(court, direct_vm, direct_alice, direct_bob)
    submit_source(court, direct_vm, direct_bob)
    ready_both(court, direct_vm, direct_alice, direct_bob)
    court.propose_settlement(ID, 67, 3600, 0)
    mock_decision(direct_vm, "full")
    direct_vm.sender = direct_alice
    if winner == "ai":
        court.resolve(ID)
        with direct_vm.expect_revert("NEGOTIATION_CLOSED"):
            court.accept_settlement(ID, 1)
    else:
        court.accept_settlement(ID, 1)
        with direct_vm.expect_revert():
            court.resolve(ID)
    assert court.get_stats()["agreements_resolved"] == 1
    assert int(court.get_credit(addr(direct_alice))["credit_wei"]) + int(court.get_credit(addr(direct_bob))["credit_wei"]) == 1000


@pytest.mark.parametrize("percentage,duration", [(101,3600), (-1,3600), (True,3600), (1.5,3600), (50,3599), (50,604801), (50,False)])
def test_invalid_offer_inputs_leave_no_history(funded, direct_vm, percentage, duration):
    with direct_vm.expect_revert():
        funded.propose_settlement(ID, percentage, duration, 0)
    assert funded.list_settlement_offers(ID, 0, 50)["total"] == 0


def test_independent_party_quotas_and_bounded_history(funded, direct_vm, direct_bob):
    for n in range(50):
        funded.propose_settlement(ID, 50, 3600, n)
    with direct_vm.expect_revert("OFFER_LIMIT_REACHED"):
        funded.propose_settlement(ID, 50, 3600, 50)
    direct_vm.sender = direct_bob
    assert funded.propose_settlement(ID, 60, 3600, 50)["number"] == 51
    assert len(funded.list_settlement_offers(ID, 0, 50)["items"]) == 50
    assert len(funded.list_settlement_offers(ID, 50, 50)["items"]) == 1
    assert funded.list_settlement_offers(ID, 1000, 50)["items"] == []
    for limit in (0, 51):
        with direct_vm.expect_revert():
            funded.list_settlement_offers(ID, 0, limit)


def test_negotiation_requires_funded_agreement_and_policy_is_accepted(court, direct_vm, direct_alice, direct_bob):
    create_agreement(court, direct_vm, direct_alice, direct_bob)
    assert court.get_config()["protocol_version"] == 5
    agreement = court.get_agreement(ID)
    assert agreement["negotiation_policy"] == "bilateral_percentage_offers_v1"
    assert agreement["negotiation_fee_bps"] == 0
    with direct_vm.expect_revert("NEGOTIATION_CLOSED"):
        court.propose_settlement(ID, 50, 3600, 0)
