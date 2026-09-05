# Steward response — Dispute Court

Updated 2026-09-05. This response covers **Dispute Court only**. Commitment Pools is a separate product and repository.

## 1. Complete clean Ubuntu suite

The [public Ubuntu run](https://github.com/sanity456/dispute-court/actions/runs/33984294179) checked out the entire repository on a fresh GitHub-hosted `ubuntu-24.04` runner and passed in 3m35s:

- GenVM lint: DisputeCourtV3 and EvidenceCaptureV3 passed.
- Contract tests: 229 direct tests passed; the two opt-in cases were then run separately and both passed through an isolated five-validator GLSim consensus environment.
- Time regressions: all four explicit stored-chain-timestamp cases passed.
- Application tests: 98 passed, zero failed or skipped.
- Prettier, zero-warning ESLint, both TypeScript checks, Sites build and Vercel build passed.
- The live contract-source check, public deployment check and final clean-tree check passed.

The exact commands and environment are in the [immutable workflow](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/.github/workflows/ubuntu-clean-suite.yml).

## 2. Stored chain timestamps

The timeout tests use `direct_vm.warp(...)`, which supplies the GenVM transaction datetime read by the contract. They do not compare against the Ubuntu host clock. The [exact tests](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/tests/test_security_court_v3.py#L124-L194) rerun explicitly in the workflow and cover one hour, two minutes and one second before the deadline; the exact deadline; and a far-future timestamp in every eligible adjudication state.

## 3. Required public GitHub Actions result

Submission evidence is the successful [public Actions run `33984294179`](https://github.com/sanity456/dispute-court/actions/runs/33984294179). It completed at `2026-09-05T18:34:23Z`. Submission must not proceed if a later required check fails.

## 4. Pinned dependencies and runners

The run enforces exact pins before installing or testing:

- Ubuntu `24.04`, Python `3.12.13`, pip `26.2.1`, Node.js `24.18.0`, pnpm `11.19.0`.
- `genlayer-test[sim]==0.29.2`, `genvm-linter==0.11.0`, `pytest==9.1.1` and every other Python requirement use exact versions in [requirements-dev.txt](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/requirements-dev.txt).
- All 25 JavaScript dependency specifications are exact and the frozen lockfile is required.
- All three GitHub Actions are referenced by full 40-character commit SHA.
- Both submitted contracts pin GenVM runner `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.

## 5. Immutable evidence commit

The tested source is [commit `66867e359d50afdeb36dca317b2e1af116a05452`](https://github.com/sanity456/dispute-court/commit/66867e359d50afdeb36dca317b2e1af116a05452), not a moving `main` link. The Actions run above is bound to that exact SHA.

## 6. Deployed-source match

The Ubuntu job fetched finalized Studionet deployment data and compared its source bytes with the checkout. Both matched:

| Contract | Address | Repository/live SHA-256 |
| --- | --- | --- |
| [DisputeCourtV3 source](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/contracts/dispute_court_v3.py) | `0x49CE252a7b8a085Ef9B859F82bD55Af1eC601BEe` | `1718a9ef8b3668599cf98d26207a611d9eb22d655ef6c5c0332f7c534bf8b66b` |
| [EvidenceCaptureV3 source](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/contracts/evidence_capture_v3.py) | `0x66cF318eb3C2276689BAe995b554104995485940` | `8eaa893c58927830a307763138dba45a5f77e4d31ead90e8d3688e0c7a6b123c` |

The same check verified chain ID `61999`, protocol version `3`, owner `0x91B1b2D1f2De66400fcbeAEbadB8a5330eB28DC0`, fee `200` bps and the helper link.

## 7. Exact timeout test vector

Deterministic inputs:

```json
{
  "mode": "genlayer-test direct mode",
  "sdk_version": "v0.2.16",
  "initial_chain_timestamp": "2026-01-01T00:00:00+00:00",
  "initial_unix": 1767225600,
  "agreement_id": "agreement-1",
  "party_a": "0x2bd806c97f0e00af1a1fc3328fa763a9269723c8",
  "party_b": "0x81b637d8fcd2c6da6359e6963113a1170de795e4",
  "outsider": "0xb9dd960c1753459a78115d3cb845a57d924b6877",
  "title": "Brand identity delivery",
  "summary": "Party B will deliver the approved brand identity package to Party A.",
  "criteria": "Award Party B for conforming delivery; award Party A for material non-delivery.",
  "amount_wei": 1000,
  "fee_bps": 200,
  "acceptance_window_seconds": 86400,
  "funding_window_seconds": 86400,
  "performance_window_seconds": 604800,
  "response_window_seconds": 86400,
  "evidence_window_seconds": 86400,
  "opening_claim": "The accepted delivery terms were not satisfied.",
  "response": "The delivery was completed and the receipt proves it.",
  "evidence_note": "Delivery receipt and acknowledgement.",
  "evidence_url": "https://evidence.example.com/delivery-42",
  "evidence_body": "Package 42 delivered on 2025-12-30 and acknowledged by Party A.",
  "evidence_sha256": "14f2c6b47ebc5498bc8aaeb9862640a0bb17a33ab6a1b22b7e66fe076933cc67",
  "mock_model_payload": {"outcome": "unexpected_model_outcome"},
  "stored_response_deadline_unix": 1767312000,
  "stored_resolution_deadline": "2026-01-07T00:00:00+00:00",
  "stored_resolution_deadline_unix": 1767744000
}
```

Expected and observed assertions:

| Stored GenVM timestamp | Call and actor | Expected result/reason code |
| --- | --- | --- |
| `2026-01-06T23:00:00Z` (`1767740400`) | `resolve("agreement-1")` | Revert: `[LLM_ERROR] Invalid adjudication outcome: unexpected_model_outcome`; attempts `0`, reopens `0`, deadline unchanged. |
| `2026-01-06T23:58:00Z` (`1767743880`) | Same | Same `[LLM_ERROR]`; attempts `0`, reopens `0`, deadline unchanged. |
| `2026-01-06T23:59:59Z` (`1767743999`) | Same | Same `[LLM_ERROR]`; attempts `0`, reopens `0`, deadline unchanged. |
| `2026-01-06T23:59:59Z` (`1767743999`) | `resolve_timeout_split`, Party A | Revert: `[EXPECTED] Resolution deadline has not been reached`. |
| `2026-01-07T00:00:00Z` (`1767744000`) | `resolve_timeout_split`, outsider | Revert: `[EXPECTED] Only agreement parties may perform this action`. |
| `2026-01-07T00:00:00Z` (`1767744000`) | `resolve_timeout_split`, Party B | Success payload below. |
| After settlement | Repeat `resolve_timeout_split` | Revert: `[EXPECTED] Agreement is not awaiting adjudication`. |

Exact success payload:

```json
{
  "agreement_id": "agreement-1",
  "status": "resolved",
  "verdict": {
    "resolution_type": "resolution_timeout_split",
    "party_a_pct": 50,
    "evidence_refs": [],
    "reasoning": "The accepted absolute resolution deadline elapsed. Escrow is split equally without a fee.",
    "reasoning_provenance": "deterministic_contract_rule"
  },
  "paid": {
    "fee_wei": "0",
    "party_a_wei": "500",
    "party_b_wei": "500",
    "conservation_wei": "1000"
  }
}
```

The companion parameterized cases set the stored timestamp to `2029-01-01T00:00:00Z` (`1861920000`) and verify a zero-fee timeout from `evidence`, `ready_for_resolution` and `resolution_stalled`, without requiring a successful AI call or extending the original deadline.

## 8. Signed-out evaluator and evidence access

At `2026-09-05T18:35:44Z`, all 11 reviewer-facing evidence links in this response were fetched again with redirects enabled and with empty `Cookie` and `Authorization` headers. Each returned final HTTP `200`: the commit, Actions run, workflow, tests, requirements, both contract sources, [full Studionet lifecycle report](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/frontend/verification/end-to-end-2026-08-30.md), [release status](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/RELEASE_STATUS.md), [public evaluator](https://dispute-court-studionet.vercel.app/) and [wallet sign-in route](https://dispute-court-studionet.vercel.app/auth/sign-in).

The public deployment check also returned HTTP `200` with fresh CSP nonces, matching script nonces and the production document policy. Chrome with MetaMask completed wallet connection, an origin-bound login signature, session restoration after reload and wallet-scoped data loading on chain `61999`; authentication created no transaction and spent no gas or funds. A complete human two-wallet transaction/withdrawal trial is still a beta gate and is not claimed here.

## 9. Submission statement

This file is the single concise response to the nine requested items. The evidence demonstrates a reproducible Studionet test release; it is an implementation-assisted review, not an independent audit, legal service or mainnet-readiness claim.
