# Dispute Court

Dispute Court is an independent bilateral escrow-resolution product. Party B accepts Party A's immutable agreement before funding; cooperative settlement stays fee-free, while disputes follow a bounded evidence and exact-bucket procedure.

The repository includes the contracts, their tests, and the complete app in `frontend/`. For the private Vercel test link, Git import setup and remaining acceptance checks, see [Release status](RELEASE_STATUS.md).

## Use the v2 build

- Contract: `contracts/dispute_court_v2.py`
- Direct tests: `tests/test_dispute_court_v2.py`
- Full-consensus smoke test: `tests/test_integration_v2.py`
- Web app: `frontend/`
- Product boundary and invariants: `ARCHITECTURE.md`

`contracts/micro_dispute_court.py` is the audited legacy prototype and remains only for regression comparison.

## Contract checks

From the workspace root:

```powershell
.venv\Scripts\genvm-lint.exe check dispute-court\contracts\dispute_court_v2.py --json
```

From this directory:

```powershell
..\.venv\Scripts\python.exe -m pytest tests -q
```

For the opt-in full-consensus Studionet smoke test:

```powershell
$env:RUN_GENLAYER_INTEGRATION='1'
..\.venv\Scripts\gltest.exe tests\test_integration_v2.py --network studionet -v -s
```

## Web app

The verified Studionet deployment is configured in `frontend/lib/deployment.json`: `0xe1fC0258b506c6b1491db11350762D73A6fCE0A1` on chain 61999. The default RPC is `https://studio.genlayer.com/api`. No secret is needed for reads. Optional `NEXT_PUBLIC_*` overrides belong in an ignored `frontend/.env.local`; they must point to the matching v2 contract on Studionet. Missing/invalid configuration disables transactions. Live read failures never substitute sample data.

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

Do not use the legacy contract. Do not treat v2 as externally audited. Current verification evidence and the remaining acceptance, privacy, monitoring, key-custody and external-review gates are listed in [Release status](RELEASE_STATUS.md).

## Live lifecycle verification

From `frontend/`, using Node 24 (or another runtime supporting TypeScript stripping):

```powershell
$env:RUN_STUDIONET_LIFECYCLE='1'
node scripts/verify-studionet.mjs
```

This explicitly opt-in harness creates labeled Studionet-only test records with ephemeral signers and at most 1,000 wei per payable call. It never exports keys, mints funds, runs on mainnet, or modifies an existing user agreement/pool. Every parent transaction must finalize with successful execution. Payout child delivery is reported separately and is not implied by a successful withdrawal call.

The court harness exercises bilateral acceptance, native-value funding, response, three evidence-empty resolution attempts, the accepted fallback, and withdrawals.

See [Release status](RELEASE_STATUS.md) and [the detailed Studionet verification record](frontend/verification/release-2026-08-28.md) for verified scope and remaining product work.
