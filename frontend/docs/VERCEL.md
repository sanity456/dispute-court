# Vercel test hosting

Each product has its own Vercel project, Neon Free database and wallet-only sign-in. This release uses the v4 Studionet core/helper pair and a contract-bound v4 database namespace. Historical deployments and data remain unchanged. Do not publish this checkout to an old Sites/D1 instance without a separately approved data-isolation plan.

## Two explicit targets

- Sites-compatible source: `pnpm dev` / `pnpm build`. Uses Cloudflare/D1 and the same wallet authentication adapter. Existing published Sites versions are not automatically changed.
- Vercel: `pnpm dev:vercel` / `pnpm build:vercel` / `pnpm start:vercel`. The wrapper selects native Next.js and Neon Postgres. Do not run the bare Next CLI.
- `.openai/hosting.json` is preserved. SQLite migration `drizzle/0002_wallet_auth.sql` adds dedicated login challenges and sessions without modifying account records.
- PostgreSQL initialization is in `server/postgres-schema.sql`. It is additive and serialized by a transaction-scoped advisory lock. Every read/write uses a transaction-local `search_path` containing only the product/core-bound v4 schema; historical `public` tables are not a fallback.

## Configuration

Connect this product's own Neon resource to its Vercel project. The required server-only database value is `DATABASE_URL`. Never expose it through a public environment variable or commit environment files.

No email provider, Neon Auth URL, auth cookie signing secret, OAuth client, or user private key is required for wallet login. Session tokens and login challenges are generated securely by the server. Old provider configuration is not read by the app.

Canonical public links are fixed to `https://dispute-court-studionet.vercel.app/`. Login messages always bind to the actual request origin, not a forwarded-host header or canonical-link override.

For local work, use an ignored `.env.local` and set `PORT` to the preview port. Open the native Next.js preview at `http://localhost:<port>` to match its normalized request origin. HTTP sign-in is restricted to loopback hosts; deployed sign-in requires HTTPS. The local Vercel target uses the configured Neon database.

## Wallet and owner access

The flow is connect wallet, switch to Studionet if needed, sign a one-time login message, then use the app. It creates no transaction and costs no gas. The server verifies the signature, origin, product, chain, browser binding, nonce and expiry before issuing an eight-hour HTTP-only session. Connecting alone is not authentication.

The wallet address is the account identity. Each product has a separate identity namespace, cookie and database. Wallet changes clear private UI, draft forms and owner controls. Stale tabs cannot read another wallet's private API responses. Owner controls still require a separate one-time proof from the deployed contract owner's wallet; a normal login signature cannot unlock them.

Only browser-wallet EOAs are supported. Smart-contract wallet verification and WalletConnect/mobile deep-link onboarding are not implemented. No account recovery by inbox exists; users must keep access to their wallet.

All email/password registration, login and reset APIs return `410 wallet_login_only`. Old sign-up and reset page URLs redirect to wallet sign-in. Legacy account records are retained, never reassigned to an address supplied by a client. See [wallet authentication](WALLET_AUTH.md) for migration and security boundaries.

Vercel Authentication is a separate private-preview gate, not product authentication. On Hobby, Standard Protection (`all_except_custom_domains`) protects generated deployment URLs and previews, but leaves production domains public. Do not infer privacy from that setting alone: verify anonymous requests to every link. See [Vercel deployment protection](https://vercel.com/docs/deployment-protection).

The September 2026 evaluator activation deliberately restored the approved public canonical domain, `https://dispute-court-studionet.vercel.app/`, on the user's `sanity3` project. That domain is public; generated deployment URLs retain their separate preview protection. No old app, database or user record was deleted. Use `vercel deploy` (preview) for private tests; production redeployments are limited to this approved evaluator project. Do not add other domains, change protection, switch accounts or upgrade a plan without approval. A Vercel production label does not make a product mainnet-ready.

## Validation and operations

- `pnpm test`: lifecycle, journal, hosting, signature, session, wallet-switch and UI regression tests.
- `node scripts/check-neon.mjs`: validates only this product's named test database. It creates a random isolated verification schema and removes that exact schema afterward. No user records or on-chain transactions are changed.
- Validate both native Next.js and Sites/Vinext builds after shared changes.
- Keep secrets and cookies out of logs; preserve database isolation.
- Do not enable paid plans, unattended signers, background operators or notification providers without approval.

## Verified v4 contract and data binding

The checked-in manifests name the verified v4 contracts; prior versions are preserved as versioned manifests. Browser and server read the same manifests, not address/RPC environment overrides. The Neon namespace is derived from the product ID and full core address by `server/release-data.ts`; no user-supplied namespace is accepted. Initialization fails closed unless the manifest is v4. Historical schemas remain available for recovery.

`node scripts/check-release-data.mjs` initializes this product's verified v4 namespace, checks idempotence and scoped writes, and confirms unchanged legacy row counts. Its temporary preference marker is inserted and removed within one transaction. `node scripts/check-neon.mjs` separately exercises authentication, concurrency and journal behavior in a newly created disposable verification schema. Neither script migrates or reassigns old records.

Run `node scripts/verify-security-release.mjs --expected-fee-bps <approved-integer>` after updating both manifests. This is read-only and must fail against legacy or mismatched code. Then follow [the activation checklist](../../SUBMISSION_CHECKLIST.md), including private access and actual wallet/browser checks.

Documents use a fresh per-response script nonce and a strict CSP; they are not statically cached. The shared `middleware.ts` entry supports the two hosting targets. Next.js 16 currently reports its middleware-to-proxy naming deprecation; that warning is not a disabled security check. After deployment, verify nonce-bearing scripts and production response headers on the actual host.
