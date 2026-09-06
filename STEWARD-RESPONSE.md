# Steward response — Dispute Court

Updated 2026-09-05. This response covers **Dispute Court only**. Commitment Pools is a separate product and repository.

## 1. Complete clean Ubuntu suite

The v4 release workflow checks out the complete repository on GitHub-hosted `ubuntu-24.04`; verifies every dependency, action and GenVM pin; lints both submitted contracts; runs all direct tests plus every v2/v3/v4 isolated five-validator GLSim integration test; reruns the stored-chain-timestamp cases explicitly; runs all frontend tests, formatting, zero-warning lint and type-checking; builds both hosting targets; source-matches both Studionet deployments; checks the public evaluator; and requires a clean tree. The final public run link will replace this sentence after the release commit is pushed and passes.

Local pre-push results: GenVM lint passed; `378` contract tests passed with the three opt-in integrations deselected; `100` application tests passed; formatting, lint, TypeScript, Sites/Vinext build, Next/Vercel build, v4 Neon isolation and live source verification passed.

## 2. Stored chain timestamps

The exact v4 tests use `direct_vm.warp(...)`, supplying the GenVM transaction datetime read by the contract. They never compare against the Ubuntu host clock. The workflow explicitly runs `test_repeated_ai_failures_cannot_block_fee_free_timeout` and `test_timeout_needs_no_successful_ai_call_and_deadline_never_extends` from `tests/test_security_court_v4.py`.

## 3. Required public GitHub Actions result

Pending the v4 release push. Submission must not proceed until that exact commit's public `Ubuntu clean suite` run passes.

## 4. Pinned dependencies and runners

- Ubuntu `24.04`, Python `3.12.13`, pip `26.2.1`, Node.js `24.18.0`, pnpm `11.19.0`.
- `genlayer-test[sim]==0.29.2`, `genvm-linter==0.11.0`, `pytest==9.1.1`, and every Python requirement are exact.
- All JavaScript dependency specifications are exact and CI requires the frozen lockfile.
- Every GitHub Action is referenced by a full 40-character commit SHA.
- Both contracts pin `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.

## 5. Immutable evidence commit

Pending the v4 release push. Final evidence will link an immutable commit, never only `main`.

## 6. Deployed-source match

The read-only release verifier fetched finalized Studionet transaction data, required successful leader execution, and compared deployed source bytes with this checkout.

| Contract | Address | Deployment transaction | Repository/live SHA-256 |
| --- | --- | --- | --- |
| DisputeCourtV4 | `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5` | `0x867c7ac7701c7e3d1fd2c6ab095a2ca3e71850ed210261eb60d0fd8a93cefc0b` | `be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9` |
| EvidenceCaptureV4 | `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f` | `0x903047ed515d6ffc314810ab73be4849f0191a88984e28713b1146a22611efc1` | `3999f1289f5574a80069e53ea28a2b947681fdb09821a2f06caf1c8e7b24e260` |

The same check verified chain `61999`, protocol `4`, owner `0x91B1b2D1f2De66400fcbeAEbadB8a5330eB28DC0`, fee `200` bps, `party_b_performance_level_v1`, fixed party roles and helper linkage. The stored deployment timestamps are `2026-09-05T21:58:36.168794Z` and `2026-09-06T06:18:06.229092Z`.

## 7. Exact timeout test vector

```json
{
  "mode": "genlayer-test direct mode",
  "sdk_version": "v0.2.16",
  "initial_chain_timestamp": "2026-01-01T00:00:00+00:00",
  "agreement_id": "agreement-1",
  "party_a": "0x2bd806c97f0e00af1a1fc3328fa763a9269723c8",
  "party_b": "0x81b637d8fcd2c6da6359e6963113a1170de795e4",
  "outsider": "0xb9dd960c1753459a78115d3cb845a57d924b6877",
  "amount_wei": 1000,
  "fee_bps": 200,
  "acceptance_window_seconds": 86400,
  "funding_window_seconds": 86400,
  "performance_window_seconds": 604800,
  "response_window_seconds": 86400,
  "evidence_window_seconds": 86400,
  "evidence_url": "https://evidence.example.com/delivery-42",
  "evidence_body": "Package 42 delivered on 2025-12-30 and acknowledged by Party A.",
  "evidence_sha256": "14f2c6b47ebc5498bc8aaeb9862640a0bb17a33ab6a1b22b7e66fe076933cc67",
  "mock_model_payload": {"outcome": "unexpected_model_outcome"},
  "stored_response_deadline_unix": 1767312000,
  "stored_resolution_deadline_unix": 1767744000
}
```

Observed expectations:

| Stored GenVM timestamp | Call and actor | Exact result/reason |
| --- | --- | --- |
| `1767740400`, `1767743880`, `1767743999` | `resolve`, Party A | `[LLM_ERROR] Invalid adjudication outcome: unexpected_model_outcome`; attempts/reopens remain `0`; deadline unchanged |
| `1767743999` | `resolve_timeout_split`, Party A | `[EXPECTED] Resolution deadline has not been reached` |
| `1767744000` | same, outsider | `[EXPECTED] Only agreement parties may perform this action` |
| `1767744000` | same, Party B | Success with `RESOLUTION_TIMEOUT_SPLIT` |
| after settlement | repeat timeout | `[EXPECTED] Agreement is not awaiting adjudication` |

Exact success payload:

```json
{
  "agreement_id": "agreement-1",
  "status": "resolved",
  "verdict": {
    "resolution_type": "resolution_timeout_split",
    "party_a_pct": 50,
    "party_b_pct": 50,
    "performance_level": "undetermined",
    "party_b_performance_pct": null,
    "reason_code": "RESOLUTION_TIMEOUT_SPLIT",
    "evidence_refs": [],
    "reasoning": "The accepted absolute resolution deadline elapsed. Escrow is split equally without a fee.",
    "reasoning_provenance": "deterministic_contract_rule"
  },
  "paid": {"fee_wei": "0", "party_a_wei": "500", "party_b_wei": "500", "conservation_wei": "1000"}
}
```

The companion cases warp to `2029-01-01T00:00:00Z` and prove the same zero-fee timeout from `evidence`, `ready_for_resolution`, and `resolution_stalled`, without a successful AI call or deadline extension.

## 8. Signed-out evaluator and evidence access

Pending v4 public deployment and immutable GitHub links. Every final link will be opened with empty Cookie and Authorization headers before submission.

## 9. Submission statement

This is the single response to the nine requested items. It is not submission-ready until sections 1, 3, 5 and 8 contain the final immutable public evidence and the v4 human wallet resolution/withdrawal retest passes. This is an implementation-assisted Studionet review, not an independent audit, legal service or mainnet-readiness claim.
