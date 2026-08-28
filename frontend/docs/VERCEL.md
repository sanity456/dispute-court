# Vercel test hosting

Each product has its own Vercel project, Neon Free database, and managed sign-in. The existing Sites deployment and its D1 data remain separate. Both hosts use the same explicitly configured GenLayer Studionet contracts; test actions can therefore affect the same on-chain records.

## Two explicit targets

- Existing Sites: `pnpm dev` / `pnpm build`. Uses the Cloudflare/D1 adapter and dispatcher-provided ChatGPT identity.
- Vercel: `pnpm dev:vercel` / `pnpm build:vercel` / `pnpm start:vercel`. The wrapper selects native Next.js, Neon Postgres and managed Neon Auth. Do not run the bare Next CLI: the explicit hosting target prevents Vercel configuration from leaking into Vinext.
- `.openai/hosting.json` and existing SQLite migrations are unchanged.
- PostgreSQL initialization is in `server/postgres-schema.sql`, outside the Sites migration directory. Initialization is additive and serialized by a transaction-scoped advisory lock.

## Configuration

Connect this product's own Neon resource to its Vercel project. Required server-only values are `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and a random 32-byte `NEON_AUTH_COOKIE_SECRET`. The cookie secret must remain stable between releases and be different for the two products. Never expose these through public environment variables or commit environment files.

Vercel builds derive the public origin from Vercel's deployment URL. An optional trusted `NEXT_PUBLIC_SITE_ORIGIN` can select a custom origin. Request-supplied forwarded hosts are not used for canonical links.

For local work, pull the new project's development environment into the ignored `.env.local`. Set `PORT` to the same port used by the preview. The local Vercel target uses a real Neon database, not a file on an ephemeral server filesystem.

## Account and owner access

Visitors create a separate product account using email and password. Managed sign-in provides verification and password-reset flows. Wallet connection remains separate. Owner service controls still require the deployed contract owner's signature, a one-time challenge, and a user-bound, expiring owner session.

The Vercel API does not trust ChatGPT/Sites headers supplied by a browser. A missing authentication adapter fails closed. Account writes and authentication POST requests require the same origin.

Vercel previews should retain Vercel Authentication protection. Signing in to Vercel allows opening the private preview; signing in to the product provides saved history. Do not disable deployment protection or add a public production alias without the owner's approval.

Vercel automatically assigns a project's first deployment to its production target even without `--prod`. This is a hosting label, not permission to publish publicly: protection must cover every Vercel URL (`all_except_custom_domains`), and no custom domains are configured for these test projects. Later deployments are previews unless explicitly promoted.

## Validation and operations

- `pnpm test`: existing lifecycle/security regression tests plus hosting portability checks.
- `node scripts/check-neon.mjs`: verifies only the explicitly named test database for this product. Creates a random, isolated verification schema and removes that same schema in a finally block. It does not send a wallet transaction or touch the product's saved user rows.
- Validate native Next.js and the existing Sites build after changing shared code.
- Keep secrets out of logs. Preserve per-product database isolation.
- Monitor the free plan's limits; do not enable a paid plan or automatic upgrade without approval.
- The existing operator remains opt-in. No signer, unattended wallet action, cron, email-reminder provider, or external notification service is enabled by this hosting change.
