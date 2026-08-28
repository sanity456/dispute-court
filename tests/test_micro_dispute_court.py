"""Fast direct-mode tests for MicroDisputeCourt.

Run from ``dispute-court/`` with the workspace venv: ``pytest -q``.
Web and LLM calls are mocked; no network is used. Payout emissions are
no-ops in direct mode, so settlement assertions cover recorded state.
"""

import json
from pathlib import Path

import pytest


CONTRACT_PATH = str(
    Path(__file__).resolve().parents[1] / "contracts" / "micro_dispute_court.py"
)
DIRECT_TEST_SDK_VERSION = "v0.2.16"

ESCROW = 10**18
TITLE = "Logo design deliverable never received"
CRITERIA = (
    "Rule for the claimant if evidence shows the work was delivered as agreed; "
    "rule for the respondent if evidence shows it was not; split if mixed."
)
RECEIPT_URL = "https://receipts.example.com/delivery-42"
DAY = 24 * 3600

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def addr(account) -> str:
    if isinstance(account, str):
        return account.lower()
    raw = account.as_bytes if hasattr(account, "as_bytes") else bytes(account)
    return "0x" + bytes(raw).hex()


@pytest.fixture()
def court(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp("2026-01-01T00:00:00+00:00")
    return direct_deploy(CONTRACT_PATH, 200, sdk_version=DIRECT_TEST_SDK_VERSION)


def open_case(court, direct_vm, claimant, respondent, escrow=ESCROW, **overrides):
    values = {
        "respondent": addr(respondent),
        "title": TITLE,
        "criteria": CRITERIA,
        "respond_window_secs": 7 * DAY,
        "evidence_window_secs": 3 * DAY,
    }
    values.update(overrides)
    direct_vm.sender = claimant
    direct_vm.value = escrow
    try:
        result = court.open_dispute(**values)
    finally:
        direct_vm.value = 0
    return result


def mock_verdict(direct_vm, winner="claimant", split_pct=100, confidence="high"):
    direct_vm.mock_llm(
        r"(?s).*impartial arbitrator.*",
        json.dumps(
            {
                "winner": winner,
                "split_pct": split_pct,
                "confidence": confidence,
                "reasoning": "Delivery receipt and chat log support the ruling.",
            }
        ),
    )
    direct_vm.mock_web(
        r"https://receipts\.example\.com/.*",
        {"status": 200, "body": "Order 42 delivered 2025-12-30, signed for by buyer."},
    )


def run_to_resolved(court, direct_vm, claimant, respondent, verdict_kwargs=None):
    open_case(court, direct_vm, claimant, respondent)
    direct_vm.sender = respondent
    court.join_dispute("case-000001")
    direct_vm.sender = claimant
    court.submit_evidence(
        "case-000001", "Delivered on time, receipt attached.", json.dumps([RECEIPT_URL])
    )
    direct_vm.sender = respondent
    court.submit_evidence("case-000001", "Never received anything.", json.dumps([]))
    direct_vm.sender = claimant
    court.close_evidence("case-000001")
    mock_verdict(direct_vm, **(verdict_kwargs or {}))
    return court.resolve("case-000001")


def test_initial_config_and_stats(court, direct_alice):
    config = court.get_config()
    assert config["owner"].lower() == addr(direct_alice)
    assert config["fee_bps"] == 200
    assert config["min_escrow_atto"] == 10**15
    assert court.get_stats() == {
        "opened": 0,
        "joined": 0,
        "resolved": 0,
        "cancelled": 0,
        "fees_collected_atto": 0,
        "value_resolved_atto": 0,
    }
    assert court.list_cases(0, 10)["items"] == []


def test_open_dispute_validation(court, direct_vm, direct_alice, direct_bob):
    with direct_vm.expect_revert("Escrow below minimum"):
        open_case(court, direct_vm, direct_alice, direct_bob, escrow=10**14)

    with direct_vm.expect_revert("Respond window must be between"):
        open_case(court, direct_vm, direct_alice, direct_bob, respond_window_secs=60)

    with direct_vm.expect_revert("Evidence window must be between"):
        open_case(
            court, direct_vm, direct_alice, direct_bob, evidence_window_secs=400 * DAY
        )

    with direct_vm.expect_revert("Respondent must differ from claimant"):
        open_case(court, direct_vm, direct_alice, direct_alice)

    with direct_vm.expect_revert("cannot be the zero address"):
        open_case(court, direct_vm, direct_alice, ZERO_ADDRESS)

    with direct_vm.expect_revert("Title must not be empty"):
        open_case(court, direct_vm, direct_alice, direct_bob, title="   ")

    result = open_case(court, direct_vm, direct_alice, direct_bob)
    assert result["case_id"] == "case-000001"
    assert result["status"] == "awaiting_response"
    assert result["amount"] == ESCROW


def test_open_dispute_records_terms_and_deadlines(
    court, direct_vm, direct_alice, direct_bob
):
    open_case(court, direct_vm, direct_alice, direct_bob)
    case = court.get_case("case-000001")
    assert case["claimant"].lower() == addr(direct_alice)
    assert case["respondent"].lower() == addr(direct_bob)
    assert case["amount"] == ESCROW
    assert case["status"] == "awaiting_response"
    assert case["respondent_joined"] is False
    assert case["evidences"] == []
    assert case["respond_deadline"] == 1767225600 + 7 * DAY
    assert case["evidence_deadline"] == 0
    assert case["verdict"] == {}
    assert case["paid"] == {"fee": 0, "claimant": 0, "respondent": 0}


def test_join_flow_and_evidence_submission(
    court, direct_vm, direct_alice, direct_bob, direct_charlie
):
    open_case(court, direct_vm, direct_alice, direct_bob)

    with direct_vm.expect_revert("Only the named respondent can join"):
        direct_vm.sender = direct_charlie
        court.join_dispute("case-000001")

    direct_vm.sender = direct_bob
    result = court.join_dispute("case-000001")
    assert result["status"] == "in_review"
    assert result["evidence_deadline"] == 1767225600 + 3 * DAY

    with direct_vm.expect_revert("Only dispute parties can submit evidence"):
        direct_vm.sender = direct_charlie
        court.submit_evidence("case-000001", "I am not involved.", json.dumps([]))

    direct_vm.sender = direct_alice
    out = court.submit_evidence(
        "case-000001",
        "Delivered on time; signed delivery receipt attached.",
        json.dumps([RECEIPT_URL]),
    )
    assert out["party"] == "claimant"
    assert out["entry_index"] == 1

    direct_vm.sender = direct_bob
    court.submit_evidence("case-000001", "Package never arrived.", json.dumps([]))
    case = court.get_case("case-000001")
    assert len(case["evidences"]) == 2
    assert case["evidences"][0]["urls"] == [RECEIPT_URL]


def test_join_only_within_response_window(court, direct_vm, direct_alice, direct_bob):
    open_case(court, direct_vm, direct_alice, direct_bob)
    direct_vm.warp("2026-01-09T00:00:01+00:00")
    with direct_vm.expect_revert("Response window has expired"):
        direct_vm.sender = direct_bob
        court.join_dispute("case-000001")


def test_evidence_limits_and_url_rules(court, direct_vm, direct_alice, direct_bob):
    open_case(court, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    court.join_dispute("case-000001")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Statement must not be empty"):
        court.submit_evidence("case-000001", "", json.dumps([]))

    with direct_vm.expect_revert("exceeds 4000 characters"):
        court.submit_evidence("case-000001", "x" * 4001, json.dumps([]))

    with direct_vm.expect_revert("must use HTTPS"):
        court.submit_evidence(
            "case-000001",
            "see this link",
            json.dumps(["http://evil.example.com/x"]),
        )

    with direct_vm.expect_revert("public hostname"):
        court.submit_evidence(
            "case-000001", "internal doc", json.dumps(["https://intranet.local/proof"])
        )

    with direct_vm.expect_revert("not valid JSON"):
        court.submit_evidence("case-000001", "bad json", "{not-json")

    with direct_vm.expect_revert("At most 3 URLs per evidence entry"):
        court.submit_evidence(
            "case-000001",
            "too many links",
            json.dumps(
                [
                    "https://a.example.com/1",
                    "https://b.example.com/2",
                    "https://c.example.com/3",
                    "https://d.example.com/4",
                ]
            ),
        )

    for i in range(3):
        court.submit_evidence("case-000001", f"statement {i}", json.dumps([]))
    with direct_vm.expect_revert("already submitted 3 evidence entries"):
        court.submit_evidence("case-000001", "one too many", json.dumps([]))


def test_close_evidence_rules(court, direct_vm, direct_alice, direct_bob):
    open_case(court, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    court.join_dispute("case-000001")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence window still open"):
        court.close_evidence("case-000001")

    court.submit_evidence("case-000001", "claimant proof", json.dumps([]))

    with direct_vm.expect_revert("Evidence window still open"):
        court.close_evidence("case-000001")

    direct_vm.sender = direct_bob
    court.submit_evidence("case-000001", "respondent proof", json.dumps([]))
    result = court.close_evidence("case-000001")
    assert result["status"] == "evidence_closed"

    with direct_vm.expect_revert("Evidence phase already closed"):
        court.close_evidence("case-000001")

    with direct_vm.expect_revert("Case is not awaiting a response"):
        court.join_dispute("case-000001")


def test_cancel_refunds_before_response_only(court, direct_vm, direct_alice, direct_bob):
    open_case(court, direct_vm, direct_alice, direct_bob)

    with direct_vm.expect_revert("Only the claimant can cancel"):
        direct_vm.sender = direct_bob
        court.cancel_dispute("case-000001")

    direct_vm.sender = direct_alice
    cancelled = court.cancel_dispute("case-000001")
    assert cancelled["status"] == "cancelled"
    assert cancelled["refunded"] == ESCROW
    assert cancelled["released"]["claimant"] == ESCROW
    assert court.get_stats()["cancelled"] == 1

    with direct_vm.expect_revert("Only unanswered cases can be cancelled"):
        court.cancel_dispute("case-000001")

    open_case(court, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    court.join_dispute("case-000002")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only unanswered cases can be cancelled"):
        court.cancel_dispute("case-000002")


def test_resolve_awards_claimant_with_fee_math(
    court, direct_vm, direct_alice, direct_bob
):
    result = run_to_resolved(court, direct_vm, direct_alice, direct_bob)

    fee = ESCROW * 200 // 10000
    distributable = ESCROW - fee
    assert result["settlement"]["fee_atto"] == fee
    assert result["settlement"]["claimant_atto"] == distributable
    assert result["settlement"]["respondent_atto"] == 0
    assert result["verdict"]["winner"] == "claimant"
    assert result["verdict"]["split_pct"] == 100
    assert result["released"]["fee"] == fee
    assert result["released"]["claimant"] == distributable

    stats = court.get_stats()
    assert stats["resolved"] == 1
    assert stats["fees_collected_atto"] == fee
    assert stats["value_resolved_atto"] == ESCROW

    decision = court.get_decision("case-000001")
    assert decision["kind"] == "microcourt.dispute.v1"
    assert decision["decision"] == "claimant"
    assert decision["split_pct"] == 100
    assert decision["fee_atto"] == fee
    assert decision["authoritative_fields"] == ["decision", "split_pct"]

    case = court.get_case("case-000001")
    assert case["paid"] == {"fee": fee, "claimant": distributable, "respondent": 0}


def test_resolve_split_verdict_math(court, direct_vm, direct_alice, direct_bob):
    run_to_resolved(
        court,
        direct_vm,
        direct_alice,
        direct_bob,
        verdict_kwargs={"winner": "split", "split_pct": 40, "confidence": "medium"},
    )

    fee = ESCROW * 200 // 10000
    distributable = ESCROW - fee
    expected_claimant = distributable * 40 // 100
    expected_respondent = distributable - expected_claimant
    settlement = court.get_case("case-000001")["settlement"]
    assert settlement["claimant_atto"] == expected_claimant
    assert settlement["respondent_atto"] == expected_respondent
    assert court.get_decision("case-000001")["decision"] == "split"


def test_resolve_awards_respondent(court, direct_vm, direct_alice, direct_bob):
    run_to_resolved(
        court, direct_vm, direct_alice, direct_bob, verdict_kwargs={"winner": "respondent"}
    )
    settlement = court.get_case("case-000001")["settlement"]
    fee = ESCROW * 200 // 10000
    assert settlement["respondent_atto"] == ESCROW - fee
    assert settlement["claimant_atto"] == 0


def test_release_pending_is_idempotent(court, direct_vm, direct_alice, direct_bob):
    run_to_resolved(court, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    released = court.release_pending("case-000001")
    assert released["released"] == {}


def test_resolve_requires_closed_evidence(court, direct_vm, direct_alice, direct_bob):
    open_case(court, direct_vm, direct_alice, direct_bob)
    with direct_vm.expect_revert("evidence must be closed before resolution"):
        direct_vm.sender = direct_alice
        court.resolve("case-000001")


def test_respondent_no_show_default_judgment_path(
    court, direct_vm, direct_alice, direct_bob
):
    open_case(court, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    court.submit_evidence(
        "case-000001", "Work delivered, receipts attached.", json.dumps([RECEIPT_URL])
    )

    direct_vm.warp("2026-01-08T00:00:01+00:00")
    direct_vm.sender = direct_bob
    assert court.close_evidence("case-000001")["status"] == "evidence_closed"

    mock_verdict(direct_vm, winner="claimant")
    resolved = court.resolve("case-000001")
    assert resolved["verdict"]["winner"] == "claimant"
    assert (
        court.get_case("case-000001")["verdict"]["reasoning_provenance"]
        == "leader_output_non_authoritative"
    )


def test_set_fee_bps_owner_only(court, direct_vm, direct_alice, direct_bob):
    with direct_vm.expect_revert("Owner-only method"):
        direct_vm.sender = direct_bob
        court.set_fee_bps(500)

    with direct_vm.expect_revert("Fee must be between 0 and 1000 bps"):
        direct_vm.sender = direct_alice
        court.set_fee_bps(1001)

    direct_vm.sender = direct_alice
    result = court.set_fee_bps(500)
    assert result == {"previous_fee_bps": 200, "fee_bps": 500}
    assert court.get_config()["fee_bps"] == 500


def test_fee_change_applies_to_new_resolution(
    court, direct_vm, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    court.set_fee_bps(1000)
    run_to_resolved(court, direct_vm, direct_alice, direct_bob)
    fee = ESCROW * 1000 // 10000
    assert court.get_case("case-000001")["settlement"]["fee_atto"] == fee
    revenue = court.get_revenue()
    assert revenue["fees_collected_atto"] == fee
    assert revenue["cases_resolved"] == 1


def test_list_cases_pagination(court, direct_vm, direct_alice, direct_bob, direct_charlie):
    open_case(court, direct_vm, direct_alice, direct_bob)
    open_case(court, direct_vm, direct_bob, direct_charlie)
    open_case(court, direct_vm, direct_charlie, direct_alice)

    page = court.list_cases(0, 2)
    assert page["total"] == 3
    assert [c["id"] for c in page["items"]] == ["case-000001", "case-000002"]

    page = court.list_cases(2, 2)
    assert [c["id"] for c in page["items"]] == ["case-000003"]

    with direct_vm.expect_revert("Case not found"):
        court.get_case("case-999999")
