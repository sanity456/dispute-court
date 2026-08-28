# Vercel test hosting

Each product has its own Vercel project, Neon Free database and wallet-only sign-in. The existing Sites deployment and its D1 data remain separate. Both hosts use the same explicitly configured GenLayer Studionet contracts; test actions can affect the same on-chain records.

## Two explicit targets

- Sites-compatible source: `pnpm dev` / `pnpm build`. Uses Cloudflare/D1 and the same wallet authentication adapter. Existing published Sites versions are not automatically changed.
- Vercel: `pnpm dev:vercel` / `pnpm build:vercel` / `pnpm start:vercel`. The wrapper selects native Next.js and Neon Postgres. Do not run the bare Next CLI.
- `.openai/hosting.json` is preserved. SQLite migration `drizzle/0002_wallet_auth.sql` adds dedicated login challenges and sessions without modifying account records.
- PostgreSQL initialization is in `server/postgres-schema.sql`. It is additive and serialized by a transaction-scoped advisory lock.

## Configuration

Connect this product's own Neon resource to its Vercel project. The required server-only database value is `DATABASE_URL`. Never expose it through a public environment variable or commit environment files.

No email provider, Neon Auth URL, auth cookie signing secret, OAuth client, or user private key is required for wallet login. Session tokens and login challenges are generated securely by the server. Old provider configuration is not read by the app.

Vercel builds derive canonical public links from the deployment URL. An optional trusted `NEXT_PUBLIC_SITE_ORIGIN` selects a canonical origin. Login messages always bind to the actual request origin, not a forwarded-host header or canonical-link override.

For local work, use an ignored `.env.local` and set `PORT` to the preview port. Open the native Next.js preview at `http://localhost:<port>` to match its normalized request origin. HTTP sign-in is restricted to loopback hosts; deployed sign-in requires HTTPS. The local Vercel target uses the configured Neon database.

## Wallet and owner access

The flow is connect wallet, switch to Studionet if needed, sign a one-time login message, then use the app. It creates no transaction and costs no gas. The server verifies the signature, origin, product, chain, browser binding, nonce and expiry before issuing an eight-hour HTTP-only session. Connecting alone is not authentication.

The wallet address is the account identity. Each product has a separate identity namespace, cookie and database. Wallet changes clear private UI, draft forms and owner controls. Stale tabs cannot read another wallet's private API responses. Owner controls still require a separate one-time proof from the deployed contract owner's wallet; a normal login signature cannot unlock them.

Only browser-wallet EOAs are supported. Smart-contract wallet verification and WalletConnect/mobile deep-link onboarding are not implemented. No account recovery by inbox exists; users must keep access to their wallet.

All email/password registration, login and reset APIs return `410 wallet_login_only`. Old sign-up and reset page URLs redirect to wallet sign-in. Legacy account records are retained, never reassigned to an address supplied by a client. See [wallet authentication](WALLET_AUTH.md) for migration and security boundaries.

Vercel Authentication is a separate private-preview gate, not product authentication. On Hobby, Standard Protection (`all_except_custom_domains`) protects generated deployment URLs and previews, but leaves production domains public. Do not infer privacy from that setting alone: verify anonymous requests to every link. See [Vercel deployment protection](https://vercel.com/docs/deployment-protection).

The 2026-08-28 wallet release removed this project's two automatic production aliases after they failed that check. Those aliases return 404; the immutable test URL in `RELEASE_STATUS.md` remains gated. No app, database or user record was deleted, and aliases can be reassigned if deliberately approved. Use `vercel deploy` (preview) for future private tests; do not use `--prod`, add domains, disable protection or upgrade a plan without explicit approval. A Vercel production label does not make a product mainnet-ready.

## Validation and operations

- `pnpm test`: lifecycle, journal, hosting, signature, session, wallet-switch and UI regression tests.
- `node scripts/check-neon.mjs`: validates only this product's named test database. It creates a random isolated verification schema and removes that exact schema afterward. No user records or on-chain transactions are changed.
- Validate both native Next.js and Sites/Vinext builds after shared changes.
- Keep secrets and cookies out of logs; preserve database isolation.
- Do not enable paid plans, unattended signers, background operators or notification providers without approval.
