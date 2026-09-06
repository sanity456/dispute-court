# Dispute Court — v4 Studionet evaluator candidate

Updated: 2026-09-06

Dispute Court is a standalone, wallet-only Studionet product. Commitment Pools remains a separate product and repository.

## Candidate release

- Public evaluator: [dispute-court-studionet.vercel.app](https://dispute-court-studionet.vercel.app/)
- Vercel production deployment: `dpl_DjmbmweP4dVD1Yt9i7QLbCfZKQK6` (`dispute-court-studionet-mabm7mlhr-sanity3.vercel.app`), created at `2026-09-06T09:18:33Z` and verified Ready on the canonical alias. The generated deployment URL remains Vercel-SSO protected; share the public canonical URL above.
- Public source: [sanity456/dispute-court](https://github.com/sanity456/dispute-court)
- Core v4: `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5`
- Core deployment: `0x867c7ac7701c7e3d1fd2c6ab095a2ca3e71850ed210261eb60d0fd8a93cefc0b`, stored chain timestamp `2026-09-05T21:58:36.168794Z`
- Core source SHA-256: `be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9`
- Evidence helper v4: `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`
- Helper deployment: `0x903047ed515d6ffc314810ab73be4849f0191a88984e28713b1146a22611efc1`, stored chain timestamp `2026-09-06T06:18:06.229092Z`
- Helper source SHA-256: `3999f1289f5574a80069e53ea28a2b947681fdb09821a2f06caf1c8e7b24e260`
- Network: Studionet, chain ID `61999`; fee: `200` bps

Both release receipts finalized with successful leader execution and empty stderr. A read-only chain verifier matched both deployed source byte for byte, then verified protocol 4, owner, fee, the directional decision policy, and the helper-to-core link. An earlier helper attempt, transaction `0xf72424a8b054e9b2b2b9c221950e991b932ef2745fffd81ef2063c195e59003f`, finalized with a constructor type error and is explicitly excluded from every release manifest.

v4 fixes the blocker found by the human v3 trial: the model now returns only Party B's named performance level. The contract—not model prose—maps `none`, `limited`, `partial`, `substantial`, and `full` to fixed Party B shares of 0%, 25%, 50%, 75%, and 100% and emits a matching reason code. Party A remains the funder/refund side; Party B remains the performer/payment side.

Email/password UI and APIs are removed. Users authenticate by an origin-bound wallet signature. Owner tools require a separate expiring owner-wallet proof. Historical deployments, manifests, agreements, balances, and database rows are preserved rather than reassigned.

## Candidate verification

The current local release pass completed:

- GenVM lint passed for both v4 contracts.
- `378` contract tests passed; the three explicit integration cases were deselected locally for the public Ubuntu GLSim job.
- `110` application tests passed, including core-scoped outbox recovery, retained drafts and review invalidation.
- Prettier, zero-warning ESLint, TypeScript, Sites/Vinext build, and native Next/Vercel build passed.
- The v4 Neon namespace `v4_dispute_court_c49ed63ddc1685850aaf5d5e85986c1bcedbe8b5` initialized idempotently; scoped writes passed and legacy row counts were unchanged.
- The read-only release verifier matched both finalized deployed sources and configuration exactly.
- The v4 Vercel deployment reached `Ready`; anonymous root and wallet-sign-in requests returned HTTP 200 with fresh matching CSP nonces and the production document policy. The visible app identifies core `0xC49E…e8b5` and explains the fixed Party B performance mapping.

The current immutable application source is commit [`84f757d2fee89ae466d7dc56316cf9077f0d44e6`](https://github.com/sanity456/dispute-court/commit/84f757d2fee89ae466d7dc56316cf9077f0d44e6). Its [complete public Ubuntu Actions run](https://github.com/sanity456/dispute-court/actions/runs/34024278445) passed at `2026-09-06T09:22:18Z`, including all 378 direct tests, all three v2/v3/v4 isolated five-validator acceptance integrations, 110 frontend tests, both builds and live source/document verification. These consensus smoke tests are not a full adversarial live-network campaign. Exact stored-timestamp vectors and final signed-out access results are in [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md).

## Human wallet status

The [immutable human v4 record](https://github.com/sanity456/dispute-court/blob/6021966a967003c92ba57f1147a28408283c6ca4/frontend/verification/human-wallet-v4-e2e-2026-09-06.md) passes the two-wallet critical path in Chrome with MetaMask: acceptance, 1,000-wei funding, dispute, response, real public evidence capture/commit, both parties Ready, AI decision and withdrawal. Full Party B performance produced `PARTY_B_FULL_PERFORMANCE`; Wallet B received exactly 980 wei in a separately finalized credited native child. A received 0 wei and the fee recipient retains 20 wei of credit. The first network-canceled resolution request is preserved. The v3 directional failure remains historical evidence, not a v4 success claim.

The human run used frontend source `113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7`; subsequent UI changes are separately covered by the [refresh regression record](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/frontend/verification/ui-refresh-regressions-2026-09-06.md). The isolated browser fixture retained drafts/captures and consent during unchanged refreshes, disabled actions during outages, and cleared review after terms/state changes or wallet switches. On the redeployed public app, Wallet B's real Activity shows `Payout delivered` and `0 current, 1 earlier-release hashes`. The old hash and intent are available through explicit recovery controls; no old transaction was resent or deleted. Production browser error logs were empty in this check.

## Remaining submission gates

- [Completed] Activate and verify the v4 public evaluator deployment.
- [Completed] Repeat the critical two-wallet human path on v4 and confirm full Party B performance pays Party B, including independent native-transfer delivery proof.
- [Completed] Push the immutable source commit and require its public Ubuntu 24.04 Actions run to pass.
- [Completed] Publish and anonymously open the immutable human and UI evidence. Verify every steward-response source/CI/evaluator link; the final response permalink is checked after its documentation commit.
- [Completed] Publish refresh/capture retention, persistent login feedback and deployment-scoped emergency recovery fixes on the approved Vercel project.
- Expand adverse-scenario consensus coverage if required by the program. Quarantine, schema failures, timeout boundaries and outsider rejection are covered by direct-mode regressions, not claimed as a full live adverse-case campaign.
- Obtain program-specific rules and any required license, video, or form artifacts.
- Confirm the dependency-audit policy: production audit reports zero advisories; the full scan still flags two high-severity `image-size` dev-tool advisories despite retained parser patches and regression tests.
- Assign operational ownership/key custody and obtain an independent security and AI-policy review before any real-money claim.

WalletConnect, mobile deep links, and smart-contract wallets are not implemented or claimed. This is a Studionet test release, not a legal court, legal advice, mainnet readiness, or an independent security certification.

## Build and operate

Use Node.js 24 and pnpm 11.19.0 from `frontend/`; public CI pins Node.js 24.18.0 exactly. Follow [Vercel setup](frontend/docs/VERCEL.md), [wallet authentication](frontend/docs/WALLET_AUTH.md), and [operations](frontend/docs/OPERATIONS.md). For Vercel Git import, use `frontend` as Root Directory.
