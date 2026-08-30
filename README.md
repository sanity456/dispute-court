# Dispute Court

Dispute Court is an independent bilateral escrow-resolution product. Party B accepts Party A's immutable agreement before funding; cooperative settlement stays fee-free, while disputes follow a bounded evidence and exact-bucket procedure.

The repository includes the contracts, their tests, and the complete app in `frontend/`. For the private Vercel test link, Git import setup and remaining acceptance checks, see [Release status](RELEASE_STATUS.md).

## Security-fixed v3 Studionet contracts

- Contract: `contracts/dispute_court_v3.py`
- Evidence helper: `contracts/evidence_capture_v3.py`
- Direct tests: `tests/test_dispute_court_v3.py` plus the v3 security regressions
- Opt-in deployment smoke test: `tests/test_integration_v3.py`
- Web app: `frontend/`
- Security boundaries and rollout: `ARCHITECTURE_V3.md` and `SUBMISSION_CHECKLIST.md`

`contracts/micro_dispute_court.py` is the audited legacy prototype and remains only for regression comparison.

## Contract checks from a fresh checkout

Use Python 3.12 (tested with 3.12.13). From this repository's root on Windows:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe scripts/check_contracts.py
```

On macOS/Linux, use `python3.12 -m venv .venv` and `.venv/bin/python` for the same install/check commands. No parent-workspace environment is required. The check script lints first, disables auto-loaded CLI plugins, and runs only mocked v3 tests. Add `--legacy` to include historical direct-mode regressions. It never sends transactions or clears artifact directories. Contract source is pinned to LF line endings by `.gitattributes` so byte-for-byte deployment verification survives a fresh checkout.

Live smoke tests are separate and require explicit authorization to create new Studionet test contracts:

```powershell
$env:RUN_GENLAYER_V3_INTEGRATION='1'
.venv\Scripts\gltest.exe tests/test_integration_v3.py --network studionet -v -s
```

This smoke test covers deployment/configuration, not complete live AI adjudication or wallet acceptance. Keep it out of ordinary CI/direct tests.

## Web app

The verified **v3** Studionet core is configured in `frontend/lib/deployment.json`: `0x49CE252a7b8a085Ef9B859F82bD55Af1eC601BEe` on chain 61999, with its own verified v3 evidence helper in `frontend/lib/evidence-deployment.json`. The RPC is `https://studio.genlayer.com/api`. Browser and server share these manifests; address/RPC environment overrides are not used. Vercel storage is bound to this product and core address in its own v3 Neon schema. The old manifests are archived as `*-v2.json`; the previous protected deployment and its records are preserved. Live read failures never substitute sample data.

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

The prototype and v2 contracts are historical and have known limitations; do not create new commitments on them. v3 addresses the reported code issues and is deployed on Studionet, but has not been independently audited. Current verification evidence and the remaining acceptance, privacy, monitoring, key-custody and external-review gates are listed in [Release status](RELEASE_STATUS.md).

## Live lifecycle verification

The live scripts target the checked-in deployment manifest. Older v2 receipt files remain historical evidence only. From `frontend/`, using Node 24 and explicit authorization for new test records:

```powershell
$env:RUN_STUDIONET_LIFECYCLE='1'
node scripts/verify-source.mjs
```

This explicitly opt-in harness creates labeled Studionet-only test records with ephemeral signers and at most 1,000 wei per payable call. It never exports keys, mints funds, runs on mainnet, or modifies an existing user agreement/pool. Every parent transaction must finalize with successful execution. Payout child delivery is reported separately and is not implied by a successful withdrawal call.

The source-backed court harness exercises bilateral acceptance, native-value funding, response, actual public-page capture, evidence-based adjudication and payout delivery. The separate `verify-studionet.mjs` harness covers the evidence-empty fallback path.

See [Release status](RELEASE_STATUS.md) and [the latest end-to-end verification record](frontend/verification/end-to-end-2026-08-30.md) for verified scope and remaining product work.
