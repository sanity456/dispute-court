# Dispute Court

Independent Studionet product. Test GEN only; evidence is public. Agree before funding, resolve cooperatively or present public evidence, then verify payout delivery.

## Run and verify

Use Node 24.x and the pinned pnpm lockfile. From this frontend directory:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
$env:CODEX_LOCAL_PREVIEW = '1'
pnpm dev --host 127.0.0.1 --port 4174
```

The local sign-in is the Sites development fixture, not production OAuth. Local SQLite persists in ignored `.local-data/`. Do not seed production with that test data.

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm audit --json
```

For the Cloudflare/Sites production build, set `CODEX_LOCAL_PREVIEW=0` and run `pnpm build`. This must use the D1 adapter, not Node SQLite. Root `drizzle/` migrations and `.openai/hosting.json` are required by the package workflow.

## Where things live

- `components/ProductHome.tsx`: product-specific lifecycle interface.
- `components/`: evidence capture, activity recovery, directory, support and owner tools.
- `lib/`: wallet/network guards, exact money, lifecycle policy, deadline/export helpers.
- `server/`: private API, journal/receipt reconciliation, owner proof, bounded indexer and support.
- `db/schema.ts` and `drizzle/`: durable schema and additive migrations.
- `lib/deployment.json`, `lib/evidence-deployment.json`: explicit Studionet deployments; no secret values.
- `scripts/operator.mjs`: dry-run-first permissionless runner.
- `verification/source-lifecycle-2026-08-28.json`: real full-consensus source verification and native payout receipts, clearly labeled automated fixtures.
- `patches/`: reproducible local fix for the upstream image-size parser issues.

Read [operations and recovery](docs/OPERATIONS.md) before enabling any unattended process. Keep this product's database, signer, configuration and Sites deployment separate from the other product.

## Live verification is intentionally opt-in

`scripts/verify-source.mjs` and `scripts/verify-studionet.mjs` are network-writing tests, not ordinary unit tests. They require `RUN_STUDIONET_LIFECYCLE=1`, create dedicated test actors and tiny test-value fixtures, and verify actual finalized execution/payouts. Do not casually rerun deployment scripts or replace the existing contract address.

The evidence helper's canonical Python source lives at `../contracts/evidence_capture.py` in the parent product directory. Core v2 direct tests and helper tests live in that product's `../tests/` directory. Full workspace source must be kept alongside this frontend when working on contracts.

## Release status

Current implementation is a Studionet beta candidate, not a real-money release or an independently audited system. Human wallet/mobile acceptance, approved tester access, independent review and any always-on provider/signing setup remain explicit release gates. See the workspace `PRODUCT_COMPLETION_CHECKLIST.md`.

No GitHub push is part of this workflow.
