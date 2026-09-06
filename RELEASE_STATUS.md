# Dispute Court — v4 Studionet evaluator candidate

Updated: 2026-09-05

Dispute Court is a standalone, wallet-only Studionet product. Commitment Pools remains a separate product and repository.

## Candidate release

- Public evaluator: [dispute-court-studionet.vercel.app](https://dispute-court-studionet.vercel.app/)
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
- `100` application tests passed.
- Prettier, zero-warning ESLint, TypeScript, Sites/Vinext build, and native Next/Vercel build passed.
- The v4 Neon namespace `v4_dispute_court_c49ed63ddc1685850aaf5d5e85986c1bcedbe8b5` initialized idempotently; scoped writes passed and legacy row counts were unchanged.
- The read-only release verifier matched both finalized deployed sources and configuration exactly.

The immutable release commit, public Ubuntu Actions run, exact stored-timestamp vector, signed-out checks, and final submission statement belong in [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md). They must be refreshed after the candidate is pushed and the public evaluator is activated.

## Human wallet status

Chrome with MetaMask completed wallet-only login, signature rejection, account switching, Studionet funding, a two-party dispute, real public evidence capture, AI resolution, and verified native payout delivery on v3. That run deliberately failed the semantic-correctness gate because full Party B performance paid Party A; the exact record is [human-wallet-e2e-2026-09-05.md](frontend/verification/human-wallet-e2e-2026-09-05.md). v4 directly removes that ambiguity, but the critical resolution and withdrawal path must be repeated against the v4 public app before submission.

## Remaining submission gates

- Activate and verify the v4 public evaluator deployment.
- Repeat the critical two-wallet human path on v4 and confirm that full Party B performance pays Party B.
- Push the immutable source commit and require its public Ubuntu 24.04 Actions run to pass.
- Open every cited evaluator/evidence link while signed out and record HTTP 200 access.
- Obtain program-specific rules and any required license, video, or form artifacts.
- Assign operational ownership/key custody and obtain an independent security and AI-policy review before any real-money claim.

WalletConnect, mobile deep links, and smart-contract wallets are not implemented or claimed. This is a Studionet test release, not a legal court, legal advice, mainnet readiness, or an independent security certification.

## Build and operate

Use Node.js 24 and pnpm 11.19.0 from `frontend/`; public CI pins Node.js 24.18.0 exactly. Follow [Vercel setup](frontend/docs/VERCEL.md), [wallet authentication](frontend/docs/WALLET_AUTH.md), and [operations](frontend/docs/OPERATIONS.md). For Vercel Git import, use `frontend` as Root Directory.
