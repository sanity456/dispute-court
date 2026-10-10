"""Opt-in local five-validator v6 deployment and appeal-policy smoke test.

GLSim 0.29.2 does not forward SDK native value to GenVM, so the funded appeal
path is covered by direct tests until a value-capable network test is run.
"""

import json
import os
from pathlib import Path

import pytest
from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_GENLAYER_V6_INTEGRATION") != "1",
        reason="Explicitly enable the isolated v6 consensus test",
    ),
]


def test_v6_policy_and_unfunded_appeal_guard_consensus():
    from gltest_cli.config.general import get_general_config

    assert get_general_config().get_rpc_url() == "http://127.0.0.1:4000/api", "v6 test is localnet-only"
    party_a, party_b = create_accounts(2)
    receipt = get_contract_factory("DisputeCourtV6").deploy_contract_tx(
        account=party_a, args=[200], consensus_max_rotations=5
    )
    assert tx_execution_succeeded(receipt), "v6 local deployment execution failed"
    address = extract_contract_address(receipt)
    schema = json.loads(
        (Path(__file__).resolve().parents[1] / "frontend/lib/contract-schema-v6.json").read_text()
    )
    court_a = Contract.new(address, schema, account=party_a)
    court_b = court_a.connect(party_b)
    config = court_a.get_config().call()
    assert config["protocol_version"] == 6
    assert config["appeal_policy"] == "one_challenge_before_credit_v1"
    assert config["appeal_window_seconds"] == 48 * 3600
    assert config["max_appeal_evidence_per_party"] == 3
    agreement_id = "appeal-" + party_a.address[-8:].lower()
    creation = court_a.create_agreement(
        args=[agreement_id, party_b.address, "Local appeal test", "Deliver a report",
              "Evaluate report against sources", 1000, 86400, 86400, 86400, 86400, 86400]
    ).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(creation), "v6 agreement creation failed"
    acceptance = court_b.accept_agreement(args=[agreement_id]).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(acceptance), "v6 agreement acceptance failed"
    agreement = court_a.get_agreement(args=[agreement_id]).call()
    assert agreement["status"] == "awaiting_funding"
    assert agreement["appeal_policy"] == "one_challenge_before_credit_v1"
    premature = court_b.file_appeal(args=[agreement_id, "Premature appeal"]).transact(consensus_max_rotations=5)
    assert not tx_execution_succeeded(premature), "Unfunded agreement wrongly accepted an appeal"
    assert court_a.get_agreement(args=[agreement_id]).call()["status"] == "awaiting_funding"
