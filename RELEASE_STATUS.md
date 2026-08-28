# Dispute Court — wallet-only test release

Updated: 2026-08-28

Dispute Court remains a standalone Studionet product. Commitment Pools is separate. This repository includes the contracts, contract tests, frontend, server, database schemas and operations scripts.

## Current test build

[Open Dispute Court](https://dispute-court-studionet-ngjkyl6s6-sanity3.vercel.app) while signed into the authorized Vercel account `sanity456`. Then choose **Sign in with wallet**. Use Studionet and test GEN only.

Email/password forms, provider adapters and provider-session acceptance are removed from this build. First-time and returning wallets use the same verified-signature login. Connecting a wallet alone does not authenticate it. Owner tools retain a separate expiring owner-wallet proof.

UI copy is shorter, with optional help collapsed. Essential test-network, public-evidence and loss/no-show warnings remain visible where relevant.

The automatic short production aliases were removed after anonymous checks found they were public. They now return 404; the exact deployment link above still redirects anonymous visitors to Vercel Authentication. The aliases can be reassigned deliberately; no deployment or database was deleted. Future private tests should use preview deployments, not automatic production aliases.

## Verification

- 78 application tests passed, including 20 wallet-authentication/client tests.
- Type checks, zero-warning lint, native Next.js and Sites/Vinext builds passed.
- Vercel's frozen install and production build passed.
- 13 isolated live Neon database check groups passed; only their disposable schemas were removed.
- 26 local wallet HTTP checks and 36 hosted checks passed. Hosted coverage includes 26 wallet checks, signed-session restoration, replay rejection, logout, retired email endpoints and owner isolation.
- 44 compiled client assets were scanned against 10 private configuration values; no matches or retired authentication-provider code were found.

These checks use synthetic test wallets, not a real-user browser-wallet session. No on-chain action was performed for this authentication/UI release. Existing contracts and [earlier live Studionet receipts](frontend/verification/release-2026-08-28.md) are unchanged.

## Data and release boundaries

Wallet identities are product- and chain-scoped. Additive migrations preserve prior user records. Old account data is not silently reassigned to a wallet; legacy provider users are retained but their sessions are not accepted. Existing published Sites versions were not republished.

Human wallet/mobile acceptance, a two-person trial, approved tester access, independent adversarial review, and operational ownership remain beta gates. The known `image-size` development-tool advisories remain documented with a reproducible patch and regression tests; this is not an independent security certification. Dispute Court is an experiment, not a legal court or a guarantee of a correct AI ruling.

## Build and operate

Use Node.js 24 and pnpm 11.19.0 from `frontend/`. Follow [Vercel setup](frontend/docs/VERCEL.md), [wallet authentication](frontend/docs/WALLET_AUTH.md), and [operations](frontend/docs/OPERATIONS.md). For a Vercel Git import, use `frontend` as Root Directory. The current deployment was uploaded directly; a GitHub push does not redeploy it.

[Wallet release evidence](frontend/verification/wallet-only-2026-08-28.md) records the exact deployment and remaining acceptance work. Never commit working credentials, export user keys, or enable unattended signing without approval.
