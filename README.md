# Dispute Court

[![Ubuntu clean suite](https://github.com/sanity456/dispute-court/actions/workflows/ubuntu-clean-suite.yml/badge.svg)](https://github.com/sanity456/dispute-court/actions/workflows/ubuntu-clean-suite.yml)

Dispute Court is an independent bilateral escrow-resolution product. Party B accepts Party A's immutable agreement before funding; cooperative settlement stays fee-free, while disputes follow a bounded evidence and exact-bucket procedure.

The repository includes the contracts, their tests, and the complete app in `frontend/`. The public evaluator build is at [dispute-court-studionet.vercel.app](https://dispute-court-studionet.vercel.app/); deployment evidence and remaining acceptance checks are in [Release status](RELEASE_STATUS.md).

## Current v4 Studionet contracts

- Contract: `contracts/dispute_court_v4.py`
- Evidence helper: `contracts/evidence_capture_v4.py`
- Direct tests: `tests/test_dispute_court_v4.py` plus the v4 security regressions
- Opt-in full-consensus test: `tests/test_integration_v4.py`
- Web app: `frontend/`
- Decision boundary and rollout: `ARCHITECTURE_V4.md` and `SUBMISSION_CHECKLIST.md`

The v3 and earlier contracts remain immutable historical records and regression fixtures. Do not create new agreements on them.

## Contract checks from a fresh checkout

Use Python 3.12 (tested with 3.12.13). From this repository's root on Windows:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe scripts/check_contracts.py
```

On macOS/Linux, use `python3.12 -m venv .venv` and `.venv/bin/python` for the same install/check commands. No parent-workspace environment is required. The check script lints first, disables auto-loaded CLI plugins, and runs the complete mocked v4 suite. Add `--legacy` to include historical direct-mode regressions. It never sends transactions or clears artifact directories. Contract source is pinned to LF line endings by `.gitattributes` so byte-for-byte deployment verification survives a fresh checkout.

Public CI runs all three v2/v3/v4 opt-in integration cases against an isolated, deterministic five-validator GLSim instance on Ubuntu; it does not send a public-network transaction. A hosted Studionet smoke test is separate and requires explicit authorization to create new test contracts:

```powershell
$env:RUN_GENLAYER_V4_INTEGRATION='1'
.venv\Scripts\gltest.exe tests/test_integration_v4.py --network studionet -v -s
```

The hosted smoke test covers deployment, configuration and programmatic bilateral acceptance, not live AI adjudication or a human browser-wallet trial. Keep the hosted-network command out of ordinary CI; the isolated GLSim cases are already included there.

## Web app

The verified **v4** Studionet core is configured in `frontend/lib/deployment.json`: `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5` on chain 61999, with its own verified v4 evidence helper `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`. The RPC is `https://studio.genlayer.com/api`. Browser and server share these manifests; address/RPC environment overrides are not used. Vercel storage is bound to this product and core address in its own v4 Neon schema. Prior manifests and their records are preserved. Live read failures never substitute sample data.

For the current Vercel target, configure the server-only `DATABASE_URL` in an ignored `.env.local`, following [Vercel setup](frontend/docs/VERCEL.md). Use Node.js 24.18.0 and pnpm 11.19.0:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm dev:vercel
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build:vercel
```

`pnpm dev` and `pnpm build` retain the separate Sites-compatible target. Neither development command deploys the app or sends a transaction.

The app exposes distinct Case, Agreement, Agreement Builder, and Owner experiences. The owner console cannot edit agreements, evidence, rulings, or credits.

## Public-money warning

v3 and earlier contracts are historical and have known limitations; do not create new agreements on them. v4 removes model-selected payout direction and derives money deterministically from Party B's named performance level. It is deployed and source-matched on Studionet, but has not been independently audited. Current evidence and the remaining acceptance, monitoring, key-custody and external-review gates are listed in [Release status](RELEASE_STATUS.md).

## Live lifecycle verification

The live scripts target the checked-in deployment manifest. Older v2 receipt files remain historical evidence only. From `frontend/`, using Node 24 and explicit authorization for new test records:

```powershell
$env:RUN_STUDIONET_LIFECYCLE='1'
node scripts/verify-source.mjs
```

This explicitly opt-in harness creates labeled Studionet-only test records with ephemeral signers and at most 1,000 wei per payable call. It never exports keys, mints funds, runs on mainnet, or modifies an existing user agreement/pool. Every parent transaction must finalize with successful execution. Payout child delivery is reported separately and is not implied by a successful withdrawal call.

The source-backed court harness exercises bilateral acceptance, native-value funding, response, actual public-page capture, evidence-based adjudication and payout delivery. The separate `verify-studionet.mjs` harness covers the evidence-empty fallback path.

The [v4 human two-wallet test](https://github.com/sanity456/dispute-court/blob/6021966a967003c92ba57f1147a28408283c6ca4/frontend/verification/human-wallet-v4-e2e-2026-09-06.md) passed: full Party B performance resulted in the correct reason code and a separately verified 980-wei native payout to Wallet B. The canceled first resolution attempt is preserved in that record. Follow-up refresh and recovery fixes have a [separate UI regression record](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/frontend/verification/ui-refresh-regressions-2026-09-06.md).

For the nine requested submission checks, start with [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md). [Release status](RELEASE_STATUS.md) distinguishes completed evidence from remaining program-specific and real-money gates. The [human v3 finding](frontend/verification/human-wallet-e2e-2026-09-05.md) remains preserved as historical failure evidence.
