# Dispute Court — private v3 Studionet release

Updated: 2026-08-30

## Current release

Dispute Court is a standalone, wallet-only Studionet product. Commitment Pools remains a separate product and repository.

- Private preview: [Dispute Court](https://dispute-court-studionet-agk7midys-sanity3.vercel.app)
- Core v3: `0x49CE252a7b8a085Ef9B859F82bD55Af1eC601BEe`
- Evidence helper v3: `0x66cF318eb3C2276689BAe995b554104995485940`
- Network: Studionet, chain ID `61999`
- Adjudication fee: 200 bps

The exact v3 source bytes, deployment execution, owner, fee, protocol version and helper linkage were verified against finalized Studionet data. Historical v2 source, manifests, protected deployment and records remain preserved for recovery; the v3 Neon namespace is isolated by product and core address.

Email/password pages, APIs, provider adapters and provider-session acceptance are removed. First-time and returning users authenticate by signing an origin-bound wallet message. Connecting a wallet alone does not authenticate it. Owner tools require a separate expiring owner-wallet proof.

The preview is protected by Vercel Authentication and is not anonymously accessible. No production alias or Sites deployment was changed by this release.

## End-to-end verification

The 2026-08-30 release pass completed successfully:

- 229 direct contract tests passed; 2 opt-in deployment cases were deselected.
- 98 application tests passed.
- GenVM lint, zero-warning ESLint, both TypeScript targets and formatting passed.
- Native Next/Vercel and Sites/Vinext production builds passed.
- 13 real Neon check groups passed in a disposable schema, which was removed. The v3 release migration was idempotent and legacy row counts were unchanged.
- The hosted preview passed anonymous-protection, fresh-CSP-nonce, private-value-leak, wallet-session, wrong-signer, CSRF, retired-email-route, v3-identity, logout and revocation checks.
- The production dependency tree reports zero vulnerabilities. The full development tree retains the two documented patched `image-size@2.0.2` advisories.
- The live fixture `verified-source-mtfk2b5m` completed 11 finalized-success transactions: create, accept, fund, open, respond, consensus source capture, evidence submission, two readiness confirmations, AI resolution and withdrawal.
- AI adjudication allocated 0 wei to Party A, 980 wei to Party B and a 20-wei fee, conserving the 1,000-wei escrow exactly. The 980-wei withdrawal child transfer was independently verified as finalized and delivered.

The exact transaction, verdict and payout evidence is recorded in [the 2026-08-30 E2E report](frontend/verification/end-to-end-2026-08-30.md).

## Remaining beta gates

The exact hosted UI rendered without console errors or horizontal overflow, and correctly explained that a compatible injected wallet was unavailable. This machine's in-app browser has no Ethereum wallet extension, so a human extension-popup/signature run remains required. WalletConnect, mobile deep links and smart-contract wallets are not implemented or claimed.

Before evaluator access or real-money use, also complete the program-specific submission checklist, approve evaluator access to the private preview/source, run a two-person human trial, assign operational ownership and key custody, and obtain an independent security/AI-policy review. Dispute Court is an experiment, not a legal court, legal advice or a guarantee of a correct AI ruling. This is a Studionet test release, not a mainnet or security certification.

## Build and operate

Use Node.js 24 and pnpm 11.19.0 from `frontend/`. Follow [Vercel setup](frontend/docs/VERCEL.md), [wallet authentication](frontend/docs/WALLET_AUTH.md), and [operations](frontend/docs/OPERATIONS.md). For Vercel Git import, use `frontend` as Root Directory. A GitHub push does not automatically redeploy this uploaded preview.
