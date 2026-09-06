# Dispute Court

Independent Studionet product. Test GEN only; evidence is public. Agree before funding, resolve cooperatively or present public evidence, then verify payout delivery.

## Run and verify

Use Node 24.x and the pinned pnpm lockfile. From this frontend directory:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
$env:CODEX_LOCAL_PREVIEW = '1'
pnpm dev --host 127.0.0.1 --port 4174
```

Local preview uses the same signed-wallet login as the hosted app. SQLite persists in ignored `.local-data/`; never seed hosted databases with test data. For the native Next.js preview, use `http://localhost:<port>` so its request origin matches the browser.

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

The deployed v4 evidence helper is `../contracts/evidence_capture_v4.py`; the core v4 and its tests live in this repository's `../contracts/` and `../tests/` directories. Historical v3 and v2 sources, manifests and receipts are preserved, not upgraded in place. See the repository-root README for the self-contained Python setup.

The app deliberately blocks new agreements against legacy or mismatched contracts. Run `node scripts/verify-security-release.mjs --expected-fee-bps 200` to verify this release. This read-only command checks successful finalized execution, exact local v4 source bytes, the expected owner and fee, the directional decision policy, and the correct helper link. It fails closed for legacy code.

## Release status

The v4 contracts are deployed and the Vercel database is isolated by product and core address. Historical app data is preserved for recovery. See [release status](../RELEASE_STATUS.md) for current verification scope. A v4 human wallet retest and independent review remain explicit gates; unsupported mobile-wallet flows are not claimed. See [the submission and activation checklist](../SUBMISSION_CHECKLIST.md). This is Studionet-only, not a real-money release.

Source is maintained in the separate private `sanity456/dispute-court` repository. A push does not automatically redeploy Vercel or Sites. See [wallet authentication](docs/WALLET_AUTH.md) and [Vercel hosting](docs/VERCEL.md).
