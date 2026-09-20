"""Opt-in isolated five-validator negotiation flow; never runs on a public network."""
import json
import os
from pathlib import Path

import pytest
from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address

pytestmark = [pytest.mark.integration, pytest.mark.skipif(
    os.getenv("RUN_GENLAYER_V5_INTEGRATION") != "1",
    reason="Explicitly enable the isolated v5 consensus test",
)]


def prepare_agreement():
    # Network selection must remain localnet. This test requires no real wallet.
    from gltest_cli.config.general import get_general_config
    assert get_general_config().get_rpc_url() == "http://127.0.0.1:4000/api", "v5 test is localnet-only"
    party_a, party_b = create_accounts(2)
    factory = get_contract_factory("DisputeCourtV5")
    receipt = factory.deploy_contract_tx(account=party_a, args=[200], consensus_max_rotations=5)
    assert tx_execution_succeeded(receipt), "v5 local deployment execution failed"
    address = extract_contract_address(receipt)
    schema = json.loads((Path(__file__).resolve().parents[1] / "frontend/lib/contract-schema-v5.json").read_text())
    a = Contract.new(address, schema, account=party_a)
    b = a.connect(party_b)
    agreement_id = "negotiation-" + party_a.address[-8:].lower()
    args = [agreement_id, party_b.address, "Local negotiation test", "Deliver a design", "Evaluate delivery",
            1000, 86400, 86400, 86400, 86400, 86400]
    def succeeds(call, **kwargs):
        result = call.transact(consensus_max_rotations=5, **kwargs)
        assert tx_execution_succeeded(result), "Local negotiation transaction execution failed"
    succeeds(a.create_agreement(args=args))
    succeeds(b.accept_agreement(args=[agreement_id]))
    return a, b, party_a, party_b, agreement_id, succeeds


def test_v5_acceptance_and_unfunded_negotiation_guard_consensus():
    a, b, party_a, party_b, agreement_id, succeeds = prepare_agreement()
    config = a.get_config().call()
    assert config["protocol_version"] == 5
    assert config["negotiation_policy"] == "bilateral_percentage_offers_v1"
    record = a.get_agreement(args=[agreement_id]).call()
    assert record["status"] == "awaiting_funding"
    assert record["negotiation_fee_bps"] == 0
    refused = a.propose_settlement(args=[agreement_id, 60, 3600, 0]).transact(consensus_max_rotations=5)
    assert not tx_execution_succeeded(refused)
    receipts = refused.get("consensus_data", {}).get("leader_receipt", [])
    if isinstance(receipts, dict):
        receipts = [receipts]
    errors = [r.get("genvm_result", {}).get("stderr", "") for r in receipts if isinstance(r, dict)]
    assert any(isinstance(error, str) and "NEGOTIATION_CLOSED" in error for error in errors), "Expected unfunded-negotiation reason code"
    assert a.get_agreement(args=[agreement_id]).call()["settlement_offer_count"] == 0


@pytest.mark.skipif(
    os.getenv("RUN_GENLAYER_V5_PAYABLE_INTEGRATION") != "1",
    reason="BLOCKED in GLSim 0.29.2: SDK native value is not forwarded to GenVM; requires a value-capable local node",
)
def test_v5_bilateral_counteroffer_payable_consensus():
    a, b, party_a, party_b, agreement_id, succeeds = prepare_agreement()
    succeeds(a.fund_agreement(args=[agreement_id]), value=1000)
    succeeds(a.propose_settlement(args=[agreement_id, 60, 3600, 0]))
    succeeds(b.propose_settlement(args=[agreement_id, 67, 3600, 1]))
    succeeds(a.accept_settlement(args=[agreement_id, 2]))
    record = a.get_agreement(args=[agreement_id]).call()
    assert record["status"] == "resolved"
    assert record["accepted_offer_number"] == 2
    assert record["verdict"]["reason_code"] == "MUTUAL_SETTLEMENT_ACCEPTED"
    assert record["paid"] == {"fee_wei":"0", "party_a_wei":"330", "party_b_wei":"670", "conservation_wei":"1000"}
    assert a.get_credit(args=[party_b.address]).call()["credit_wei"] == "670"
