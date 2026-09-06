"""Opt-in full-consensus smoke test for DisputeCourtV4."""

import os

import pytest

from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_GENLAYER_V4_INTEGRATION") != "1",
        reason="Set RUN_GENLAYER_V4_INTEGRATION=1 with GenLayer Studio running",
    ),
]


# GLSim 0.29.2 can execute contracts pinned to the current GenVM runner, but its
# local schema extractor does not recognize that runner's public-method markers.
# Contract.new only uses this metadata to choose read versus write wrappers; the
# simulator still decodes and executes the real method names and calldata.
INTEGRATION_SCHEMA = {
    "ctor": {"params": ["u256"], "kwparams": {}},
    "methods": {
        "accept_agreement": {
            "params": ["string"],
            "kwparams": {},
            "ret": "none",
            "readonly": False,
        },
        "create_agreement": {
            "params": [],
            "kwparams": {},
            "ret": "none",
            "readonly": False,
        },
        "get_agreement": {
            "params": ["string"],
            "kwparams": {},
            "ret": "dict",
            "readonly": True,
        },
        "get_config": {
            "params": [],
            "kwparams": {},
            "ret": "dict",
            "readonly": True,
        },
    },
}


def deploy_for_integration(factory, wallet):
    receipt = factory.deploy_contract_tx(
        account=wallet,
        args=[200],
        consensus_max_rotations=5,
    )
    assert tx_execution_succeeded(receipt), receipt
    address = extract_contract_address(receipt)
    return address, Contract.new(address, INTEGRATION_SCHEMA, account=wallet)


def test_dispute_court_v4_full_consensus_acceptance():
    party_a, party_b = create_accounts(2)
    address, court_a = deploy_for_integration(
        get_contract_factory("DisputeCourtV4"), party_a
    )
    config = court_a.get_config().call()
    assert config["protocol_version"] == 4
    assert config["decision_policy"] == "party_b_performance_level_v1"
    assert config["party_a_role"] == "funder_refund_side"
    assert config["party_b_role"] == "performer_payment_side"
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
    assert tx_execution_succeeded(receipt), receipt

    court_b = court_a.connect(party_b)
    accept_receipt = court_b.accept_agreement(args=[agreement_id]).transact(
        consensus_max_rotations=5
    )
    assert tx_execution_succeeded(accept_receipt), accept_receipt
    record = court_a.get_agreement(args=[agreement_id]).call()
    assert record["status"] == "awaiting_funding"
    assert record["terms_hash"]
