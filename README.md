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

Public CI runs both opt-in integration cases against an isolated, deterministic five-validator GLSim instance on Ubuntu; it does not send a public-network transaction. A hosted Studionet smoke test is separate and requires explicit authorization to create new test contracts:

```powershell
$env:RUN_GENLAYER_V4_INTEGRATION='1'
.venv\Scripts\gltest.exe tests/test_integration_v4.py --network studionet -v -s
```

The hosted smoke test covers deployment/configuration, not complete live AI adjudication or wallet acceptance. Keep the hosted-network command out of ordinary CI; the isolated GLSim cases are already included there.

## Web app

The verified **v4** Studionet core is configured in `frontend/lib/deployment.json`: `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5` on chain 61999, with its own verified v4 evidence helper `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`. The RPC is `https://studio.genlayer.com/api`. Browser and server share these manifests; address/RPC environment overrides are not used. Vercel storage is bound to this product and core address in its own v4 Neon schema. Prior manifests and their records are preserved. Live read failures never substitute sample data.

```powershell
cd frontend
pnpm dev
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

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

See [Release status](RELEASE_STATUS.md) and [the human v3 finding that required v4](frontend/verification/human-wallet-e2e-2026-09-05.md) for verified scope and remaining product work.
