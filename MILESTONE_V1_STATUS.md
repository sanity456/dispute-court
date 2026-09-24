# Milestone v1 — Negotiated Settlements (development candidate)

Date: 2026-09-21. **Separate v5 candidate deployed and source-verified. Candidate branch has passing public CI and a tested Vercel preview; not production-activated or submission-ready.**

Latest checkpoint: [preview recovery, deployed rollback-configuration rehearsal, live stale/expired/self-acceptance guards and exact refund withdrawal](V5_PREVIEW_AND_GUARD_EVIDENCE.md). Final evidence-commit CI, anonymous link checks and other release gates are tracked separately. Historical verification details below retain their original scope.

Same Dispute Court app and repository. The public v4 app, archived manifests, source and existing agreements are unchanged. The milestone candidate branch selects the verified v5 pair as its default and retains both versions; this does not promote a Vercel production deployment. The portal's milestone number (v1) is different from the proposed contract version (v5).

## Baseline and real delta

Pre-development repository baseline: `1e3263ab8783877bb3927762809c077840ceb8d4`. Confirm the exact accepted portal evidence before writing the final milestone comparison.

Previously, cooperative settlement meant full release or full refund. The local v5 core adds fee-free whole-percentage splits, numbered offers and counteroffers, recipient-only acceptance/rejection, proposer-only cancellation, deadline-bounded expiry, separate per-party quotas, paginated on-chain history and negotiated-settlement totals. Credits use the existing withdrawal machinery. Arbitration rules and fixed dispute deadlines remain in force.

The same app now contains a version-gated settlement panel, exact GEN/wei previews, consent tied to wallet/case/offer state, history export and read-only owner statistics. The backend selects its callable methods from the checked-in deployment version. V5 actions remain disabled on retained v4, never silently routed to it.

Design and constraints: [ARCHITECTURE_V5.md](ARCHITECTURE_V5.md).

## Local verification

- GenVM lint and SDK validation passed for the new core and current v4 contracts; concrete runner header retained. Linter runtime selection explicitly pinned to GenVM v0.2.16.
- Complete direct suite: **551 passed**. Includes the old lifecycle/security suite on both v4 and v5, both evidence helpers, historical releases, exact timestamp boundaries, stale offers, role checks, quotas, payout conservation and competing settlement routes.
- Frontend suite: **128 passed** at candidate `b740c418154d45632a0407f73bcfb41c15f6ccc2` and the latest local rerun. Includes preview rounding, consent invalidation, authorization, deployment gating, ABI coverage, release/source verification, cross-release journal isolation, rollback retention and release-correct preview invitations/reminders.
- TypeScript and zero-warning ESLint passed. Formatting now reads every source file directly, including Windows cloud-backed files that directory globs skipped.
- Both final frontend build reruns passed: `pnpm build:vercel` and `pnpm build`. Existing framework middleware-deprecation and route-classification warnings remain; neither build failed.
- Browser exercise of the isolated mock: proposal, changed-input consent reset, wallet switch, counteroffer, acceptance confirmation, stale-data disabling, settled state, offer history and expiry gating. This is **not** a human wallet/chain test.
- Isolated five-validator GLSim final fresh-process run: **4 passed, 1 skipped**. v2/v3/v4 acceptance and v5 acceptance/unfunded-negotiation guard passed, including the expected `NEGOTIATION_CLOSED` reason. Reusing the simulator across separate test invocations caused a deployment failure; use a fresh process for each complete run. **The funded negotiation consensus case is blocked, not passed.** GLSim 0.29.2 drops native value on its SDK call path, so exact funding reverts. That separate test requires explicit enablement on a value-capable local node. See the architecture note for the failed attempts and harness limitations.

Local environment: Windows, Node 24.18.0, pnpm 11.19.0, Python 3.12.14. The required Ubuntu CI still pins Python 3.12.13; local results are not a substitute for that run.

## Release preparation implemented locally

The v5 evidence helper, protocol-selected source verifier and candidate-manifest verification are now implemented. V4 source and archived manifests remain byte-identical to the baseline. The candidate branch registers verified v5 as default with its retained entry; v4 remains available. The app has a checked-in release registry, immutable v4 archives, versioned share links, a full-navigation version selector, and release-scoped API/database access. Unversioned old record links stay on v4. Non-default releases permit existing-agreement operations but block new agreement creation. Production activation still requires separate approval.

The initial local app was opened signed out: current v4 rendered, an unversioned record route stayed on v4, and unregistered v5 was blocked without falling back. The v5 candidate subsequently passed the funded two-wallet happy-path cycle, including exact native deliveries; see [V5_HUMAN_WALLET_EVIDENCE.md](V5_HUMAN_WALLET_EVIDENCE.md). Later deployed two-release recovery and rollback-configuration results are in the latest checkpoint linked above; they are not a production alias rollback or fresh retained-release withdrawal.

## Release/submission gates still open

1. Candidate deployment and source verification passed: see [V5_DEPLOYMENT_EVIDENCE.md](V5_DEPLOYMENT_EVIDENCE.md). Candidate registration is published on the milestone branch and deployed to a protected Vercel preview; production activation remains gated.
2. Local v4/v5 selection/rollback, isolated SQLite storage and temporary-schema real Neon recovery passed; see [V5_RECOVERY_EVIDENCE.md](V5_RECOVERY_EVIDENCE.md). Actual v5 Neon initialization, preview recovery and a separately deployed v4-default rollback configuration also passed, preserving the existing v5 saved withdrawal without reimport. A production alias rollback and freshly executed retained/legacy withdrawal are not claimed. No transfer or migration of existing escrow.
3. Funded negotiation happy-path cycle passed on Studionet: 1,000 wei funded, numbered offer/counteroffer, 330/670 credit split with zero fee, both exact native transfers delivered, both remaining credits zero. The evidence bundle includes exact decoded inputs/outputs and stored timestamps.
4. Live recipient rejection, proposer cancellation and read-only stored-expiry verification passed with unchanged credits/deadlines. B's full refund and A's separate 1,000 wei native withdrawal both finalized; exact delivery verified and both final credits zero. Saved-hash reload recovery, local two-release rollback/access and temporary-schema Neon checks also passed within their documented scope. Live negative-acceptance evidence and actual deployed recovery checks remain separate. See [V5_GUARD_TEST_EVIDENCE.md](V5_GUARD_TEST_EVIDENCE.md).
   A separate funded negative-acceptance fixture now has both **live expired-offer and proposer self-acceptance rejections** with exact expected codes `OFFER_NOT_ACTIVE` and `ONLY_OFFER_RECIPIENT`, unchanged 1,000 wei escrow and credits, and zero child transfers. Wallet A then created fresh pending offer #3; Wallet B authorized a full cooperative refund; Wallet A withdrew the exact 1,000 wei. The finalized native child transfer to Wallet A and both zero remaining credits were verified. Exact hashes, inputs, outputs and stored chain timestamps are in [the negative-acceptance evidence](evidence/milestone-v1/negative-acceptance-live.json) and [the scoped narrative](V5_PREVIEW_AND_GUARD_EVIDENCE.md). Publication and reviewer access require separate checks at an immutable evidence commit.
5. Candidate branch publication and public Ubuntu Actions passed at `b740c418154d45632a0407f73bcfb41c15f6ccc2`, including both deployed source checks. Preview human recovery and separately deployed rollback-configuration checks passed; see the latest checkpoint above. Publish the final evidence bundle and require CI at its final commit. Production promotion still needs separate authorization.
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
