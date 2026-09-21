# Milestone v1 — Negotiated Settlements (development candidate)

Date: 2026-09-20. **Separate v5 candidate deployed and source-verified. Not pushed, production-activated, or submission-ready.**

Same Dispute Court app and repository. The public v4 app, manifests, source and existing agreements are unchanged. The portal's milestone number (v1) is different from the proposed contract version (v5).

## Baseline and real delta

Pre-development repository baseline: `1e3263ab8783877bb3927762809c077840ceb8d4`. Confirm the exact accepted portal evidence before writing the final milestone comparison.

Previously, cooperative settlement meant full release or full refund. The local v5 core adds fee-free whole-percentage splits, numbered offers and counteroffers, recipient-only acceptance/rejection, proposer-only cancellation, deadline-bounded expiry, separate per-party quotas, paginated on-chain history and negotiated-settlement totals. Credits use the existing withdrawal machinery. Arbitration rules and fixed dispute deadlines remain in force.

The same app now contains a version-gated settlement panel, exact GEN/wei previews, consent tied to wallet/case/offer state, history export and read-only owner statistics. The backend selects its callable methods from the checked-in deployment version. With the unchanged v4 manifest, v5 actions remain disabled, not silently routed to v4.

Design and constraints: [ARCHITECTURE_V5.md](ARCHITECTURE_V5.md).

## Local verification

- GenVM lint and SDK validation passed for the new core and current v4 contracts; concrete runner header retained. Linter runtime selection explicitly pinned to GenVM v0.2.16.
- Complete direct suite: **551 passed**. Includes the old lifecycle/security suite on both v4 and v5, both evidence helpers, historical releases, exact timestamp boundaries, stale offers, role checks, quotas, payout conservation and competing settlement routes.
- Frontend suite: **125 passed**. Includes preview rounding, consent invalidation, authorization, deployment gating, ABI coverage, release/source verification, cross-release journal isolation and rollback retention.
- TypeScript and zero-warning ESLint passed. Formatting now reads every source file directly, including Windows cloud-backed files that directory globs skipped.
- Both final frontend build reruns passed: `pnpm build:vercel` and `pnpm build`. Existing framework middleware-deprecation and route-classification warnings remain; neither build failed.
- Browser exercise of the isolated mock: proposal, changed-input consent reset, wallet switch, counteroffer, acceptance confirmation, stale-data disabling, settled state, offer history and expiry gating. This is **not** a human wallet/chain test.
- Isolated five-validator GLSim final fresh-process run: **4 passed, 1 skipped**. v2/v3/v4 acceptance and v5 acceptance/unfunded-negotiation guard passed, including the expected `NEGOTIATION_CLOSED` reason. Reusing the simulator across separate test invocations caused a deployment failure; use a fresh process for each complete run. **The funded negotiation consensus case is blocked, not passed.** GLSim 0.29.2 drops native value on its SDK call path, so exact funding reverts. That separate test requires explicit enablement on a value-capable local node. See the architecture note for the failed attempts and harness limitations.

Local environment: Windows, Node 24.18.0, pnpm 11.19.0, Python 3.12.14. The required Ubuntu CI still pins Python 3.12.13; local results are not a substitute for that run.

## Release preparation implemented locally

The v5 evidence helper, protocol-selected source verifier and candidate-manifest verification are now implemented. V4 source and live manifests remain byte-identical to the baseline. The app has a checked-in release registry, immutable v4 archives, versioned share links, a full-navigation version selector, and release-scoped API/database access. Unversioned old record links stay on v4. Non-default releases permit existing-agreement operations but block new agreement creation. Activation requires a retained v5 entry so rollback can preserve access to both contracts.

The initial local app was opened signed out: current v4 rendered, an unversioned record route stayed on v4, and unregistered v5 was blocked without falling back. The separate v5 preview has since passed the funded two-wallet happy-path cycle, including exact native deliveries. See [V5_HUMAN_WALLET_EVIDENCE.md](V5_HUMAN_WALLET_EVIDENCE.md). The full two-release/rollback checks remain open.

## Release/submission gates still open

1. Candidate deployment and source verification passed: see [V5_DEPLOYMENT_EVIDENCE.md](V5_DEPLOYMENT_EVIDENCE.md). Candidate registration is isolated to the local preview; production activation remains gated by the checks below.
2. Validate the implemented same-app v4/v5 release selection and isolated storage on a candidate preview, including real v4 credit recovery and a rollback drill. No transfer or migration of existing escrow.
3. Funded negotiation happy-path cycle passed on Studionet: 1,000 wei funded, numbered offer/counteroffer, 330/670 credit split with zero fee, both exact native transfers delivered, both remaining credits zero. The evidence bundle includes exact decoded inputs/outputs and stored timestamps.
4. Live recipient rejection and proposer cancellation now passed with unchanged credits/deadlines. Saved-hash reload recovery and the local two-release rollback/access drill also passed within their documented scope. Offer 3 is awaiting its stored expiry; refund, withdrawal, live negative-acceptance evidence and production-style recovery checks remain. See [V5_GUARD_TEST_EVIDENCE.md](V5_GUARD_TEST_EVIDENCE.md).
5. After authorization: push the tested milestone and evidence, require public Ubuntu Actions, reverify the source-matched Studionet pair at the final commit, and roll out to Vercel with rollback/recovery checks.
6. Open every evidence link signed out. Prepare the portal's <=1,000-character change summary using completed work, immutable commits, exact test inputs/timestamps/reason codes and transaction evidence. User performs final submission.

## Reproduce locally without touching real wallets

Use a fresh environment outside `work/gltest-artifacts`. The current task's disposable environment is `work/milestone-venv`.

```powershell
$env:PYTHONUTF8='1'
work/milestone-venv/Scripts/python.exe scripts/check_contracts.py --legacy
work/milestone-venv/Scripts/python.exe scripts/check_reproducibility.py
# Separate terminal; loopback-only simulator, five validators:
work/milestone-venv/Scripts/python.exe scripts/run_local_glsim.py
```

Enable the versioned integration tests explicitly and run `gltest ... --network localnet --artifacts-dir work/gltest-artifacts -v -s`. This output directory is disposable: gltest deletes it at startup. Never put release evidence or a virtual environment there.

From `frontend`: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm build:vercel`. `node scripts/preview-workspace.mjs --settlement` starts a labeled mock with no wallet/RPC access.
