# Wallet-only authentication

## User flow

1. Open this product in a browser with a compatible wallet.
2. Choose **Sign in with wallet** and approve a switch to GenLayer Studionet (61999) if requested.
3. Review the product name, browser origin and login-only statement, then sign the message.
4. Use history, settings and support as that wallet. Every on-chain action still has its own wallet confirmation.

There are no email, password, registration or password-reset forms. First-time and returning wallets use the same flow. Login never requests a seed phrase or private key.

## Security model

- The server creates a five-minute EIP-4361 message with a random 256-bit nonce, exact origin, product request ID, address and chain.
- A separate HTTP-only pre-login cookie binds redemption to the browser that requested the challenge.
- The client checks the exact canonical message before `personal_sign` and rechecks the account/network around signing and verification.
- Signature verification, expiry and atomic one-use consumption happen on the server. Challenges are limited per trusted client network to 20/minute and 120/hour; verification is separately limited to 100/minute and 600/hour. IPv6 clients share a /64 bucket. Unsigned wallet claims never consume another wallet's quota.
- Client identity comes only from Vercel's protected platform header or the Workers platform header. Production fails closed if identity is unavailable; arbitrary forwarding headers, cookies and JSON fields are not trusted. Rate keys use a daily product-scoped hash, not raw IP addresses. Shared-network clients can share a quota.
- A 300/minute global challenge circuit breaker remains after validation and per-client limits to bound database growth. Distributed abuse can still exhaust it; it does not block verification of existing challenges. Infrastructure-level denial-of-service protection remains necessary.
- A random 256-bit session token is sent only in an HTTP-only, host-only, SameSite=Strict cookie. HTTPS uses the `__Host-` prefix and Secure flag. Only the token's SHA-256 hash is stored.
- Sessions expire after eight hours, are bound to the actual origin and product, and rotate on a new verified login.
- POST routes require the same Origin; cross-site authentication requests are rejected. Identity headers, wallet addresses and old provider cookies are never proof of login.
- The authenticated wallet must match transaction-intent and owner-challenge wallets. The expected-wallet request header is an extra stale-tab guard, not authentication.
- Account/network/disconnect events clear private UI. Cross-tab events and late-response guards prevent stale account data from reappearing.
- Owner challenges and tokens remain in different tables. A wallet login token is not an owner token. Login rotation and logout revoke the current browser's owner proof as well.

The session is a browser credential: an unlocked browser can retain access until logout/expiry. Wallet theft, malicious extensions and XSS remain real risks. This implementation is not an independent security certification. Only EOA signatures are currently supported.

## Preserving old records

The migration adds `wallet_challenges` and `wallet_sessions` and their expiry indexes. It does not delete or rewrite existing requests, preferences, support tickets, receipts or provider users.

New user IDs are `wallet:<product>:61999:<lowercase-address>`. Old provider account data does not automatically become wallet data. An address previously typed or connected under an email account is not proof that all that account's private content belongs to its holder. Any future migration must separately prove the old account and destination wallet with explicit user consent.

Do not disable/delete the legacy Neon Auth service as a cleanup shortcut: doing so can destroy its stored user records. The new app does not call it or accept its sessions. Historical immutable deployments can retain old code; use the current wallet-only deployment.

Emergency transaction outboxes are now product-and-wallet scoped. Unattributed legacy device entries remain untouched and are not imported into a new wallet account. Public transaction hashes can be reviewed/imported deliberately in Activity without broadcasting again.

## Operational checks

Run `pnpm test`, both type checks, lint and both hosting builds. `node scripts/check-neon.mjs` additionally verifies atomic nonce consumption, session rotation, wallet isolation and logout in a disposable schema of the real Postgres database.

Before wider beta access, test actual wallet approvals/rejections, wallet switching, two-browser/two-person journeys and mobile wallet availability. Never treat synthetic signatures as proof that every wallet/device is supported. Keep the two products and their access policies separate.
