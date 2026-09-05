"""Security regressions: passing means the v3 defense holds, not an exploit."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from test_dispute_court_v3 import (
    court_v3, create_agreement, accept_and_fund, open_answered_dispute,
    ready_both, submit_source, mock_decision, addr, SOURCE_URL, SOURCE_BODY,
    DIRECT_TEST_SDK_VERSION,
)

ROOT = Path(__file__).resolve().parents[1]
URLS = json.loads((ROOT / "tests/fixtures/evidence-urls.json").read_text())
BAD_URL = "https://evidence.example.com/bad"
TAIL = "CRITICAL_APPENDIX: the material requirements are NOT met."


def digest(value):
    return hashlib.sha256(re.sub(r"\s+", " ", value).strip().encode()).hexdigest()


def warp(vm, timestamp):
    vm.warp(datetime.fromtimestamp(timestamp, timezone.utc).isoformat())


@pytest.fixture
def answered(court_v3, direct_vm, direct_alice, direct_bob):
    open_answered_dispute(court_v3, direct_vm, direct_alice, direct_bob)
    return court_v3


@pytest.fixture
def helper(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    return direct_deploy(str(ROOT / "contracts/evidence_capture_v3.py"), "0x" + "11" * 20,
                         sdk_version=DIRECT_TEST_SDK_VERSION)


@pytest.mark.parametrize("bad_first", [False, True])
@pytest.mark.parametrize("bad_kind", ["digest_mismatch", "empty", "too_large", "unavailable"])
def test_invalid_exhibit_cannot_veto_good_evidence(answered, direct_vm, direct_alice, direct_bob, bad_first, bad_kind):
    body = {"digest_mismatch": "Changed receipt", "empty": "", "too_large": "x" * 6001, "unavailable": ""}[bad_kind]
    order = ["bad", "good"] if bad_first else ["good", "bad"]
    for item in order:
        direct_vm.sender = direct_alice if item == "bad" else direct_bob
        if item == "bad":
            bad = answered.submit_evidence("agreement-1", "Untrusted bad exhibit", BAD_URL,
                                           "0" * 64 if bad_kind == "digest_mismatch" else digest(body))
        else:
            good = submit_source(answered, direct_vm, direct_bob)
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, 0, refs=[good["id"]])
    if bad_kind != "unavailable":
        direct_vm.mock_web(re.escape(BAD_URL), {"status": 200, "body": body})
    # No matching web mock means an isolated renderer failure, not a live fetch.
    direct_vm.sender = direct_alice
    result = answered.resolve("agreement-1")
    assert result["verdict"]["party_a_pct"] == 0
    assert result["paid"]["party_b_wei"] == "980"
    state = answered.get_agreement("agreement-1")
    checks = {item["id"]: item["status"] for item in state["last_source_observations"]}
    assert checks == {good["id"]: "verified", bad["id"]: bad_kind}
    assert state["reopen_count"] == 0
    assert len(state["evidence"]) == 2
    with direct_vm.expect_revert("retries are not exhausted"):
        answered.resolve_fallback_split("agreement-1")


def test_model_cannot_cite_an_excluded_exhibit(answered, direct_vm, direct_alice, direct_bob):
    submit_source(answered, direct_vm, direct_bob)
    direct_vm.sender = direct_alice
    bad = answered.submit_evidence("agreement-1", "Bad digest", BAD_URL, "0" * 64)
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, 100, refs=[bad["id"]])
    direct_vm.mock_web(re.escape(BAD_URL), {"status": 200, "body": "Changed"})
    with direct_vm.expect_revert("Unknown evidence reference"):
        answered.resolve("agreement-1")
    assert answered.get_agreement("agreement-1")["status"] == "ready_for_resolution"


@pytest.mark.parametrize("percentage", [False, True, "0", "25", "25.9", None, [], {}])
def test_payout_requires_an_actual_integer(answered, direct_vm, direct_alice, direct_bob, percentage):
    submit_source(answered, direct_vm, direct_bob)
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, percentage)
    with direct_vm.expect_revert("must be an integer"):
        answered.resolve("agreement-1")
    assert answered.get_agreement("agreement-1")["status"] == "ready_for_resolution"
    assert answered.get_credit(addr(direct_bob))["credit_wei"] == "0"


def test_all_supported_source_text_reaches_model(answered, direct_vm, direct_alice, direct_bob):
    body = "x" * (6000 - len(TAIL)) + TAIL
    direct_vm.sender = direct_bob
    answered.submit_evidence("agreement-1", "Complete document", SOURCE_URL, digest(body))
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(re.escape(SOURCE_URL), {"status": 200, "body": body})
    direct_vm.mock_llm(r"(?s)^.*CRITICAL_APPENDIX.*$", json.dumps({
        "outcome": "decision", "party_a_pct": 100, "evidence_refs": ["evidence-001"],
        "reasoning": "The complete appendix contradicts the claim",
    }))
    assert answered.resolve("agreement-1")["verdict"]["party_a_pct"] == 100


@pytest.mark.parametrize("body", ["x" * 6001, "é" * 3001, "x" * 8800 + TAIL])
def test_oversize_source_never_becomes_a_truncated_ruling(answered, direct_vm, direct_alice, direct_bob, body):
    direct_vm.sender = direct_bob
    answered.submit_evidence("agreement-1", "Oversize document", SOURCE_URL, digest(body))
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    mock_decision(direct_vm, 0)
    direct_vm.clear_mocks()
    direct_vm.mock_web(re.escape(SOURCE_URL), {"status": 200, "body": body})
    result = answered.resolve("agreement-1")
    assert result["outcome"] == "needs_evidence"
    assert answered.get_agreement("agreement-1")["last_source_observations"][0]["status"] == "too_large"
    assert answered.get_credit(addr(direct_bob))["credit_wei"] == "0"


def test_repeated_ai_failures_cannot_block_fee_free_timeout(answered, direct_vm, direct_alice, direct_bob, direct_charlie):
    submit_source(answered, direct_vm, direct_bob)
    ready_both(answered, direct_vm, direct_alice, direct_bob)
    before = answered.get_agreement("agreement-1")
    deadline = before["resolution_deadline"]
    assert deadline == before["response_deadline"] + 3 * before["evidence_window_seconds"] + 48 * 3600
    direct_vm.mock_web(re.escape(SOURCE_URL), {"status": 200, "body": SOURCE_BODY})
    direct_vm.mock_llm(r"(?s).*", json.dumps({"outcome": "unexpected_model_outcome"}))
    for remaining in (3600, 120, 1):
        warp(direct_vm, deadline - remaining)
        with direct_vm.expect_revert(
            "[LLM_ERROR] Invalid adjudication outcome: unexpected_model_outcome"
        ):
            answered.resolve("agreement-1")
        state = answered.get_agreement("agreement-1")
        assert state["resolution_attempt_count"] == state["reopen_count"] == 0
        assert state["resolution_deadline"] == deadline
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert(
        "[EXPECTED] Resolution deadline has not been reached"
    ):
        answered.resolve_timeout_split("agreement-1")
    warp(direct_vm, deadline)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(
        "[EXPECTED] Only agreement parties may perform this action"
    ):
        answered.resolve_timeout_split("agreement-1")
    direct_vm.sender = direct_bob
    result = answered.resolve_timeout_split("agreement-1")
    expected = {
        "agreement_id": "agreement-1",
        "status": "resolved",
        "verdict": {
            "resolution_type": "resolution_timeout_split",
            "party_a_pct": 50,
            "evidence_refs": [],
            "reasoning": "The accepted absolute resolution deadline elapsed. Escrow is split equally without a fee.",
            "reasoning_provenance": "deterministic_contract_rule",
        },
        "paid": {
            "fee_wei": "0",
            "party_a_wei": "500",
            "party_b_wei": "500",
            "conservation_wei": "1000",
        },
    }
    assert result == expected
    print(json.dumps({"resolution_deadline": deadline, "output": result}, sort_keys=True))
    with direct_vm.expect_revert(
        "[EXPECTED] Agreement is not awaiting adjudication"
    ):
        answered.resolve_timeout_split("agreement-1")
    assert answered.get_credit(addr(direct_alice))["credit_wei"] == "500"
    assert answered.get_credit(addr(direct_bob))["credit_wei"] == "500"


@pytest.mark.parametrize("stage", ["evidence", "ready_for_resolution", "resolution_stalled"])
def test_timeout_needs_no_successful_ai_call_and_deadline_never_extends(answered, direct_vm, direct_alice, direct_bob, stage):
    deadline = answered.get_agreement("agreement-1")["resolution_deadline"]
    if stage != "evidence":
        ready_both(answered, direct_vm, direct_alice, direct_bob)
    if stage == "resolution_stalled":
        for number in range(3):
            answered.resolve("agreement-1")
            if number < 2:
                ready_both(answered, direct_vm, direct_alice, direct_bob)
    assert answered.get_agreement("agreement-1")["resolution_deadline"] == deadline
    direct_vm.warp("2029-01-01T00:00:00+00:00")
    direct_vm.sender = direct_alice
    assert answered.resolve_timeout_split("agreement-1")["paid"]["fee_wei"] == "0"


@pytest.mark.parametrize("release", [True, False])
@pytest.mark.parametrize("stage", ["evidence", "ready_for_resolution", "resolution_stalled"])
def test_party_can_give_full_escrow_to_counterparty_after_dispute(answered, direct_vm, direct_alice, direct_bob, stage, release):
    if stage != "evidence":
        ready_both(answered, direct_vm, direct_alice, direct_bob)
    if stage == "resolution_stalled":
        for number in range(3):
            answered.resolve("agreement-1")
            if number < 2:
                ready_both(answered, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice if release else direct_bob
    result = answered.release_to_party_b("agreement-1") if release else answered.refund_to_party_a("agreement-1")
    assert result["paid"]["fee_wei"] == "0"
    assert result["paid"]["party_b_wei" if release else "party_a_wei"] == "1000"


def test_timeout_cannot_override_a_response_no_show(court_v3, direct_vm, direct_alice, direct_bob):
    create_agreement(court_v3, direct_vm, direct_alice, direct_bob)
    accept_and_fund(court_v3, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    court_v3.open_dispute("agreement-1", "No delivery")
    direct_vm.warp("2029-01-01T00:00:00+00:00")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not awaiting adjudication"):
        court_v3.resolve_timeout_split("agreement-1")
    assert court_v3.resolve_no_show("agreement-1")["verdict"]["party_a_pct"] == 100


@pytest.mark.parametrize("body", ["x" * 6001, "é" * 3001, "x" * 8800 + TAIL])
def test_helper_rejects_documents_the_core_cannot_judge_in_full(helper, direct_vm, body):
    direct_vm.mock_web(re.escape(SOURCE_URL), {"status": 200, "body": body})
    with direct_vm.expect_revert("exceeds 6000 UTF-8 bytes"):
        helper.capture(SOURCE_URL, "oversize")
    assert helper.get_config()["captures"] == 0


@pytest.mark.parametrize("url", URLS["invalid"])
def test_core_rejects_unsafe_urls(answered, direct_vm, direct_alice, url):
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("[EXPECTED]"):
        answered.submit_evidence("agreement-1", "Invalid URL", url, "0" * 64)


@pytest.mark.parametrize("url", URLS["invalid"])
def test_helper_uses_the_same_url_policy(helper, direct_vm, url):
    with direct_vm.expect_revert("[EXPECTED]"):
        helper.capture(url, "bad-url")


@pytest.mark.parametrize("url", URLS["valid"])
def test_supported_public_urls_remain_usable(answered, direct_vm, direct_alice, url):
    direct_vm.sender = direct_alice
    assert answered.submit_evidence("agreement-1", "Complete receipt", url, digest(SOURCE_BODY))["url"] == url


def test_new_safety_policy_is_in_immutable_terms(answered):
    terms = answered.get_agreement("agreement-1")
    assert terms["protocol_version"] == 3
    assert terms["max_source_bytes"] == 6000
    assert terms["resolution_window_seconds"] == 48 * 3600
    assert terms["timeout_policy"] == "50_50_without_fee_after_absolute_resolution_deadline"
    assert answered.get_config()["protocol_version"] == 3
