# Steward response — Dispute Court

Updated 2026-09-06. This response covers **Dispute Court only**. Commitment Pools is a separate product and repository.

## 1. Complete clean Ubuntu suite

The [public Ubuntu run `34024278445`](https://github.com/sanity456/dispute-court/actions/runs/34024278445) checked out the complete repository on GitHub-hosted `ubuntu-24.04`; verified every dependency, action and GenVM pin; linted both submitted contracts; ran all direct tests plus every v2/v3/v4 isolated five-validator GLSim integration test; reran the stored-chain-timestamp cases explicitly; ran all frontend tests, formatting, zero-warning lint and type-checking; built both hosting targets; source-matched both Studionet deployments; checked the public evaluator; and required a clean tree. It passed at `2026-09-06T09:22:18Z`.

Local pre-push results: GenVM lint passed; `378` contract tests passed with the three opt-in integrations deselected; `110` application tests passed; formatting, lint, TypeScript, Sites/Vinext build, Next/Vercel build, v4 Neon isolation and live source verification passed.

## 2. Stored chain timestamps

The [exact v4 tests](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/tests/test_security_court_v4.py) use `direct_vm.warp(...)`, supplying the GenVM transaction datetime read by the contract. They never compare against the Ubuntu host clock. The workflow explicitly runs `test_repeated_ai_failures_cannot_block_fee_free_timeout` and `test_timeout_needs_no_successful_ai_call_and_deadline_never_extends`.

## 3. Required public GitHub Actions result

The required [public `Ubuntu clean suite` run](https://github.com/sanity456/dispute-court/actions/runs/34024278445) passed at `2026-09-06T09:22:18Z` against commit `84f757d2fee89ae466d7dc56316cf9077f0d44e6`. Submission must stop if any later required run fails.

## 4. Pinned dependencies and runners

- Ubuntu `24.04`, Python `3.12.13`, pip `26.2.1`, Node.js `24.18.0`, pnpm `11.19.0`.
- `genlayer-test[sim]==0.29.2`, `genvm-linter==0.11.0`, `pytest==9.1.1`, and every [Python requirement](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/requirements-dev.txt) are exact.
- All JavaScript dependency specifications are exact and CI requires the frozen lockfile.
- Every GitHub Action is referenced by a full 40-character commit SHA.
- Both contracts pin `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.

## 5. Immutable evidence commit

The tested source is immutable commit [`84f757d2fee89ae466d7dc56316cf9077f0d44e6`](https://github.com/sanity456/dispute-court/commit/84f757d2fee89ae466d7dc56316cf9077f0d44e6), not a moving `main` link. The Actions run above is bound to that exact SHA; the [workflow definition](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/.github/workflows/ubuntu-clean-suite.yml) is pinned to the same commit.

## 6. Deployed-source match

The read-only release verifier fetched finalized Studionet transaction data, required successful leader execution, and compared deployed source bytes with this checkout.

| Contract | Address | Deployment transaction | Repository/live SHA-256 |
| --- | --- | --- | --- |
| [DisputeCourtV4](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/contracts/dispute_court_v4.py) | `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5` | `0x867c7ac7701c7e3d1fd2c6ab095a2ca3e71850ed210261eb60d0fd8a93cefc0b` | `be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9` |
| [EvidenceCaptureV4](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/contracts/evidence_capture_v4.py) | `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f` | `0x903047ed515d6ffc314810ab73be4849f0191a88984e28713b1146a22611efc1` | `3999f1289f5574a80069e53ea28a2b947681fdb09821a2f06caf1c8e7b24e260` |

The same check verified chain `61999`, protocol `4`, owner `0x91B1b2D1f2De66400fcbeAEbadB8a5330eB28DC0`, fee `200` bps, `party_b_performance_level_v1`, fixed party roles and helper linkage. The stored deployment timestamps are `2026-09-05T21:58:36.168794Z` and `2026-09-06T06:18:06.229092Z`.

## 7. Exact inputs, times, payloads and reason codes

The [immutable human v4 record](https://github.com/sanity456/dispute-court/blob/6021966a967003c92ba57f1147a28408283c6ca4/frontend/verification/human-wallet-v4-e2e-2026-09-06.md) includes every input, stored chain timestamp, transaction hash and decoded output. Full Party B performance produced `PARTY_B_FULL_PERFORMANCE`: A `0`, B `980`, fee `20 wei`. B's withdrawal parent and separately finalized, credited native child match the exact recipient/amount and balance movement. One prior network-canceled resolution request is preserved, not counted as successful execution.

The human test used frontend commit `113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7`. The [follow-up UI regression record](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/frontend/verification/ui-refresh-regressions-2026-09-06.md) separately covers refresh, consent, capture retention and recovery fixes. Contract bytes did not change.

Exact timeout vector:

```json
{
  "mode": "genlayer-test direct mode",
  "sdk_version": "v0.2.16",
  "initial_chain_timestamp": "2026-01-01T00:00:00+00:00",
  "agreement_id": "agreement-1",
  "title": "Brand identity delivery",
  "summary": "Party B will deliver the approved brand identity package to Party A.",
  "criteria": "Award Party B for conforming delivery; award Party A for material non-delivery.",
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
  "opening_claim": "The accepted delivery terms were not satisfied.",
  "response": "The delivery was completed and the receipt proves it.",
  "evidence_note": "Delivery receipt and acknowledgement.",
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

All **12 distinct links** in this response—including the public [evaluator](https://dispute-court-studionet.vercel.app/), [wallet sign-in page](https://dispute-court-studionet.vercel.app/auth/sign-in), [repository](https://github.com/sanity456/dispute-court), immutable evidence, source and CI—returned HTTP `200` without redirects at `2026-09-06T09:27:24.669Z`–`2026-09-06T09:27:31.403Z`. Checks used anonymous GETs with empty Cookie/Authorization headers, consumed each document and verified its page title rather than accepting a sign-in page. No GitHub or Vercel account was required. The app's transaction workflow still correctly requires its own wallet sign-in.

Private generated Vercel deployment URLs are not evaluator links: the new generated deployment returned `302` to Vercel SSO at `2026-09-06T09:21:05.029Z`; the canonical evaluator returned `200` with fresh matching CSP nonces.

## 9. Submission statement

This is the single response to the nine requested items. The current source, passing public Ubuntu run, live v4 source match and human resolution/withdrawal evidence are verified. The approved `sanity3` evaluator was redeployed as `dpl_DjmbmweP4dVD1Yt9i7QLbCfZKQK6` and is Ready. The real signed-in Activity view shows B's delivered payout and distinguishes the preserved historical recovery hash from current requests. Program-specific eligibility, deadlines, license and any video/form requirements still need the actual submission rules. Direct-mode adversarial tests pass; the isolated consensus suite is an acceptance smoke suite, not a complete adversarial live-network campaign. Production dependency audit is clean; two existing dev-tool advisories remain subject to the program's policy. This is an implementation-assisted Studionet review, not an independent audit, legal service or mainnet-readiness claim.
