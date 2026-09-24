# Dispute Court

[![Ubuntu clean suite](https://github.com/sanity456/dispute-court/actions/workflows/ubuntu-clean-suite.yml/badge.svg)](https://github.com/sanity456/dispute-court/actions/workflows/ubuntu-clean-suite.yml)

Dispute Court is an independent bilateral escrow-resolution product. Party B accepts Party A's immutable agreement before funding; cooperative settlement stays fee-free, while disputes follow a bounded evidence and exact-bucket procedure.

The repository includes the contracts, their tests, and the complete app in `frontend/`. The accepted [public production app](https://dispute-court-studionet.vercel.app/) still runs **v4**. This repository's default manifests and `main` branch now contain the separately deployed **v5 milestone candidate**; merging the code did not promote the Vercel production alias.

For milestone reviewers: start with the [milestone v1 submission draft](MILESTONE_V1_SUBMISSION.md) for the substantive v4-to-v5 delta, immutable commit, public CI and transaction evidence. The working **v5 reviewer preview requires the deployment-specific share link supplied in the portal evidence field**; the plain preview URL is protected and the production URL above remains v4. [Milestone status](MILESTONE_V1_STATUS.md) separates completed tests from remaining release limits. Portal milestone `v1` and contract protocol `v5` are different version numbers.

## Release map on Studionet

- **v5 milestone candidate on `main` and in the reviewer preview:** `contracts/dispute_court_v5.py`, `contracts/evidence_capture_v5.py`, core `0x369D8f95744C8eaBcF50E8De009Eb162248D1504`, helper `0x7547521fA84Df53f0C02BCdb9A60C323819F00b3`. The checked-in `frontend/lib/deployment.json` and `frontend/lib/evidence-deployment.json` select these verified v5 contracts. Negotiated settlements are available only for v5 agreements.
- **Accepted v4 production release:** `contracts/dispute_court_v4.py`, `contracts/evidence_capture_v4.py`, core `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5`, helper `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`. The immutable `frontend/lib/*-v4.json` manifests and unversioned old agreement links preserve v4 access. The current Vercel production deployment remains v4.

V5 retains the original agreement, dispute and withdrawal paths and adds numbered, deadline-bound offers/counteroffers, role-checked settlement, fee-free percentage splits and offer history. Both versions are on Studionet chain 61999; neither is a mainnet deployment. See [v5 architecture](ARCHITECTURE_V5.md), [deployment/source verification](V5_DEPLOYMENT_EVIDENCE.md) and [human-wallet evidence](V5_HUMAN_WALLET_EVIDENCE.md).

The v4 regression surface remains in the repository:

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

On macOS/Linux, use `python3.12 -m venv .venv` and `.venv/bin/python` for the same install/check commands. No parent-workspace environment is required. The check script lints the current v4/v5 core and helper contracts, disables auto-loaded CLI plugins, and runs the current direct-mode suites. Add `--legacy` for the complete historical direct-mode regression suite. It never sends transactions or clears artifact directories. Contract source is pinned to LF line endings by `.gitattributes` so byte-for-byte deployment verification survives a fresh checkout.

Public Ubuntu CI runs the complete direct/frontend suites and opt-in consensus cases against an isolated five-validator GLSim instance; it does not send a public-network transaction. Four consensus cases pass. The funded v5 GLSim case is explicitly skipped because that runner drops native value; the separate funded human-wallet Studionet cycle is [documented here](V5_HUMAN_WALLET_EVIDENCE.md) and is not presented as a GLSim pass. A hosted v4 Studionet smoke test is separate and requires explicit authorization to create new test contracts:

```powershell
$env:RUN_GENLAYER_V4_INTEGRATION='1'
.venv\Scripts\gltest.exe tests/test_integration_v4.py --network studionet -v -s
```

That hosted smoke test covers v4 deployment, configuration and programmatic bilateral acceptance, not live AI adjudication or a human browser-wallet trial. Keep hosted-network commands out of ordinary CI; the isolated GLSim cases are already included there.

## Web app

The checked-in default manifests select the verified **v5** Studionet core/helper listed above. The deployed v4 production build still uses its original v4 pair. The RPC is `https://studio.genlayer.com/api`. Browser and server use checked-in release manifests; arbitrary address/RPC environment overrides are not used. Vercel/Neon stores records in separate core-address-scoped schemas, preserving existing v4 records while the v5 preview uses its own schema. Live read failures never substitute sample data.

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

v3 and earlier contracts are historical and have known limitations; do not create new agreements on them. V4 removes model-selected payout direction and derives money deterministically from Party B's named performance level. V5 preserves bounded adjudication while adding deterministic negotiated splits. Both deployed pairs are source-matched on Studionet, but neither has an independent security audit. The v4 [release status](RELEASE_STATUS.md) and [v5 milestone status](MILESTONE_V1_STATUS.md) distinguish completed evidence from remaining monitoring, key-custody and external-review gates.

## Live lifecycle verification

The opt-in live scripts target the checked-in default deployment manifest, currently v5; they are not a substitute for the recorded v5 two-wallet milestone evidence. Older v2 receipt files remain historical evidence only. From `frontend/`, using Node 24 and explicit authorization for new test records:

```powershell
$env:RUN_STUDIONET_LIFECYCLE='1'
node scripts/verify-source.mjs
```

This explicitly opt-in harness creates labeled Studionet-only test records with ephemeral signers and at most 1,000 wei per payable call. It never exports keys, mints funds, runs on mainnet, or modifies an existing user agreement/pool. Every parent transaction must finalize with successful execution. Payout child delivery is reported separately and is not implied by a successful withdrawal call.

The source-backed court harness exercises bilateral acceptance, native-value funding, response, actual public-page capture, evidence-based adjudication and payout delivery. The separate `verify-studionet.mjs` harness covers the evidence-empty fallback path.

The [v4 human two-wallet test](https://github.com/sanity456/dispute-court/blob/6021966a967003c92ba57f1147a28408283c6ca4/frontend/verification/human-wallet-v4-e2e-2026-09-06.md) passed: full Party B performance resulted in the correct reason code and a separately verified 980-wei native payout to Wallet B. The canceled first resolution attempt is preserved in that record. Follow-up refresh and recovery fixes have a [separate UI regression record](https://github.com/sanity456/dispute-court/blob/84f757d2fee89ae466d7dc56316cf9077f0d44e6/frontend/verification/ui-refresh-regressions-2026-09-06.md).

For the nine requested submission checks, start with [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md). [Release status](RELEASE_STATUS.md) distinguishes completed evidence from remaining program-specific and real-money gates. The [human v3 finding](frontend/verification/human-wallet-e2e-2026-09-05.md) remains preserved as historical failure evidence.
