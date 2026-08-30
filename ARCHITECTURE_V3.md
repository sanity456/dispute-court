# Dispute Court v3 security boundary

v3 is a new immutable contract release. The v2 source and its deployed addresses remain unchanged for historical verification and recovery.

## Authority

- The app owns wallet authentication, discovery, user preferences, private support records, and non-authoritative previews.
- The core contract owns accepted economic terms, eligibility, evidence verification, validator comparison, settlement, and credits.
- The evidence helper prepares a public immutable source snapshot. It is neither a judge nor a funds custodian.
- External pages are untrusted facts, never instructions. The core re-fetches and normalizes them before checking the committed digest.

## Complete evidence

Every v3 core and helper enforces a maximum of 6,000 normalized UTF-8 bytes per source. Accepted source text is passed to the model in full, never sliced. Oversize capture is rejected. The app validates recovered capture bytes, digest, product linkage, URL policy and size before enabling proof submission.

All authoritative URL entrypoints use the same public-DNS HTTPS rules and reject IP shorthand, private suffixes, address aliases, credentials, fragments, backslashes, control characters and custom ports. This lexical policy is not a network sandbox: the renderer must independently protect DNS resolution and redirect destinations.

## Adjudication and liveness

Invalid/unavailable/oversize exhibits are excluded individually and retain their identity, status and observed digest in the attempt history. A model decision may cite only verified exhibits. Validators independently re-fetch sources and compare the decision, cited IDs, source digest bundle and source observations; leader prose is not authoritative.

A payout percentage must be an actual integer in 0/25/50/75/100. Booleans, numeric strings and malformed schema cannot settle.

At dispute opening the contract fixes this deadline once:

`response_deadline + 3 × evidence_window_seconds + 48 hours`

The complete formula, maximum reopens, source limit and fee-free timeout policy are in the immutable accepted terms. Failed model calls do not extend the deadline. From the evidence, ready or stalled states, either party can apply a deterministic fee-free 50/50 split after that deadline, without calling an AI. A response no-show remains governed by the separate accepted no-show rule.

The existing bounded evidence-retry fallback remains available before the absolute deadline. At or after it, only the fee-free timeout path is available. Either party can also give the entire escrow to the counterparty, fee-free, throughout any unresolved funded state. Nobody can use a cooperative method to award themselves funds.

A timeout bounds availability; it does not guarantee a correct AI decision. A party should request adjudication before the deadline rather than wait for a split.

## Wallet authentication and web boundary

Wallet-only sign-in is preserved; email and password login are not reintroduced. Challenges are rate-limited by infrastructure-supplied client identity, not a wallet address that an unauthenticated caller can claim. The global challenge circuit breaker runs only after valid input and per-client checks and cannot prevent verification of an already issued challenge.

Vercel uses its protected forwarding header; Workers use the platform connecting-IP header. Unknown hosting identity fails closed. Local development accepts only loopback hosts. IPv6 clients are grouped by /64; IPv4-mapped addresses normalize to IPv4. Rate keys contain a daily-rotated digest, not the raw IP. Shared-NAT users still share a network quota; distributed abuse remains an edge-protection/operations concern. [Vercel request headers](https://vercel.com/docs/headers/request-headers).

Documents receive fresh script nonces, strict-dynamic CSP, no-store responses, anti-framing and other defensive headers. Rendering is dynamic so cached HTML cannot reuse a nonce. Styles permit inline styling for the existing UI; production scripts do not permit unsafe-inline or unsafe-eval. [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).

## Activation boundary

The app requires protocol version 3 and the expected evidence limit before reserving new actions. A v3 helper must point at the same v3 core. Explicit deterministic recovery methods remain usable on the historical core. This gate protects the app; direct callers can still reach immutable old contracts.

For release, verify new source bytes against successful finalized deployment receipts. Preserve the old protected app link and old data for recovery. Use a separate v3 product database schema, or implement explicit contract-scoped data migration, before pointing the new app at v3; never mix old directory IDs and new contract state silently. Do not reassign old agreements, balances, or private records.

The application manifests deliberately still contain the known v2 deployment. No invented address or automatic migration was installed. See the submission checklist for the remaining external steps.
