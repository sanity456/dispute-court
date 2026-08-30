"""Opt-in full-consensus smoke test for DisputeCourtV3."""

import os
import time

import pytest

from gltest import create_accounts, get_contract_factory, get_gl_client
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_GENLAYER_V3_INTEGRATION") != "1",
        reason="Set RUN_GENLAYER_V3_INTEGRATION=1 with GenLayer Studio running",
    ),
]


def deploy_with_schema_retry(factory, wallet):
    receipt = factory.deploy_contract_tx(
        account=wallet,
        args=[200],
        consensus_max_rotations=5,
    )
    assert tx_execution_succeeded(receipt)
    address = extract_contract_address(receipt)
    for attempt in range(20):
        try:
            schema = get_gl_client().get_contract_schema(address)
            return address, schema, Contract.new(address, schema, account=wallet)
        except Exception:
            if attempt == 19:
                raise
            time.sleep(3)


def test_dispute_court_v3_full_consensus_acceptance():
    party_a, party_b = create_accounts(2)
    address, schema, court_a = deploy_with_schema_retry(
        get_contract_factory("DisputeCourtV3"), party_a
    )
    config = court_a.get_config().call()
    assert config["protocol_version"] == 3
    assert config["max_source_bytes"] == 6000
    assert config["resolution_window_seconds"] == 48 * 3600
    assert config["owner"].lower() == party_a.address.lower()
    assert config["fee_bps"] == 200
    agreement_id = f"integration-{party_a.address[-8:].lower()}"
    receipt = court_a.create_agreement(
        args=[
            agreement_id,
            party_b.address,
            "Integration design delivery",
            "Party B will deliver a design package to Party A.",
            "Award according to evidence of conforming delivery.",
            1000,
            24 * 3600,
            24 * 3600,
            7 * 24 * 3600,
            24 * 3600,
            24 * 3600,
        ]
    ).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(receipt)

    court_b = Contract.new(address, schema, account=party_b)
    accept_receipt = court_b.accept_agreement(args=[agreement_id]).transact(
        consensus_max_rotations=5
    )
    assert tx_execution_succeeded(accept_receipt)
    record = court_a.get_agreement(args=[agreement_id]).call()
    assert record["status"] == "awaiting_funding"
    assert record["terms_hash"]
