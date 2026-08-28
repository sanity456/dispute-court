# Dispute Court — repository and test release

Updated: 2026-08-28

This is the complete, standalone Dispute Court product: `contracts/` contains the intelligent contracts, `tests/` contains their tests, and `frontend/` contains the web app, server, database schemas, application tests and operations scripts. Commitment Pools is a separate repository and product.

## Test deployment

[Open the private Vercel test deployment](https://dispute-court-studionet-m6davwc1k-sanity3.vercel.app) using the authorized Vercel account `sanity456`. This exact origin is registered with this product's separate Neon Auth project. Other preview aliases are not approved login origins. Studionet only; use test GEN, never real funds.

The current build uses email/password authentication for saved account history, reminders and support. The wallet separately authorizes on-chain actions, and owner tools additionally verify an expiring owner-wallet proof. No private key is stored in the app or exported by the release workflow. Owner moderation cannot change agreed terms, erase chain evidence, choose a ruling or reverse a transfer.

## Building from this repository

Use Node.js 24 and pnpm 11.19.0. Work in `frontend/`; configure environment values from `frontend/.env.example` in an ignored local environment file or the hosting provider. Never commit working credentials.

For a Vercel Git import, set **Root Directory** to `frontend` and follow [the Vercel setup guide](frontend/docs/VERCEL.md). The existing deployment was uploaded directly; pushing to GitHub does not itself connect or redeploy it. The original Sites target remains available through the default scripts and was not republished by the Vercel migration.

## Evidence and limits

- 58 application tests passed, including 8 hosting-portability tests.
- Native Next.js and existing Sites/Vinext builds passed; type checks and zero-warning lint passed.
- 9 isolated live Neon database check groups passed.
- All 15 hosted checks passed after exact-domain registration. Invalid credentials reach managed authentication and return `401 INVALID_EMAIL_OR_PASSWORD`; cross-origin authentication and forged identities remain denied.
- Homepage, sign-in and sign-up navigation was checked in the authenticated Vercel browser. No real product account or wallet journey was created by those hosted checks.
- Earlier live contract and payout evidence is retained in [the Studionet verification record](frontend/verification/release-2026-08-28.md).

Before calling this a dependable beta, complete real-user sign-up/sign-in and email-policy testing, two-person wallet/device and mobile acceptance, approved tester access, independent adversarial review, and operational ownership for support, backups and key custody. Any always-on operator or closed-app notifications require a separately approved service and signer/provider. This is not an independent security certification or mainnet-ready release.

Dispute Court is a Studionet experiment, not a legal court or a guarantee of a correct AI ruling. Evidence is public and immutable. See [the operations runbook](frontend/docs/OPERATIONS.md) for recovery and operator boundaries. The existing `image-size` development dependency has a reproducible security patch and regression tests; do not remove it or misrepresent an audit as independent certification.
