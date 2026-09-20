# v5 rollout — same app, separate immutable contract

Rollout checklist, not proof that all gates passed. The separate v5 pair is now finalized and source-verified; see [V5_DEPLOYMENT_EVIDENCE.md](V5_DEPLOYMENT_EVIDENCE.md). Candidate manifests are isolated to staging and a local preview. The primary checkout still defaults to v4.

## What is implemented locally

- `evidence_capture_v5.py` retains v4 normalization, URL validation, limits and idempotency; its advertised protocol is 5. It must be deployed with the new core address. Old helper source is untouched.
- The read-only release verifier selects the core/helper source by explicit protocol version, matches finalized deployment bytes and SHA-256, checks owner/fee/helper binding, and checks v5 negotiation policy and limits.
- Browser and API choose only checked-in releases. An arbitrary URL/header cannot supply an RPC, address or version. Unknown releases fail closed.
- Existing unversioned `/agreements/<id>` links and unversioned API clients remain v4. New share links include `?release=v4` or `?release=v5`.
- The version selector performs a full navigation, clearing UI state and consent. The server isolates journals, directories, cached state and support by core address. The `v4_` SQL prefix names the schema format, not the contract version. Existing schema names are not changed.
- Primary wallet authentication stays in the existing v4 database, so a default-version change does not discard existing login sessions. Owner privileges are still checked against each selected release's owner and database.
- Previous releases retain all existing-agreement operations and withdrawal access. New agreement creation in a non-default release is blocked in both UI and journal reservation.
- Vercel/Neon uses a separate address-scoped schema for each release. The alternate Worker target requires a separate `DB_V5` binding; it fails closed if absent, never reuses v4's `DB`.

## Before activation

1. Review and freeze an immutable commit; run the complete clean Ubuntu workflow. The local Windows results are not a substitute. Existing tests that deliberately assert the default is still v4 must be updated explicitly at activation, without dropping v4 regression coverage.
2. With explicit authorization, deploy the candidate core and its matching helper on Studionet. Preserve v4 core/helper manifests and source bytes. Do not fund real-money/mainnet accounts or export wallet keys.
3. Keep candidate `deployment.json` and `evidence-deployment.json` in a separate staging directory, with actual finalized addresses, hashes, source SHA-256 and owner. Never invent these values. The helper deployment tool accepts `--core-manifest <candidate deployment.json>` and still requires its existing explicit execution flag.
4. From `frontend`, run `node scripts/verify-security-release.mjs --expected-fee-bps 200 --manifest-dir <candidate-directory>`. This command only reads the chain; it does not activate the candidate. Use `--release v4` to recheck the accepted archived release. Keep the public scalar verification output with immutable source evidence; do not dump full RPC errors.
5. After successful source verification, retain the complete `{id: "v5", core: <core manifest>, helper: <helper manifest>}` in `frontend/lib/retained-releases.json` before changing the two default manifests. The app rejects a new default that was not retained. Keep the accepted `*-v4.json` files unchanged.
6. Use a candidate preview deployment first. Verify isolated database initialization and existing v4 records/credit access. `check-release-data.mjs --release v5` performs scoped database writes and needs authorization; it is not a read-only diagnostic.
7. Run the funded two-wallet test and recovery checks below. Only after passing them should the approved Vercel production rollout occur.

## Minimum funded test evidence

Record the exact commit, core/helper addresses, chain ID, wallet addresses, input arguments, transaction hashes, finalized execution results and public return payloads. Record contract-stored times rather than deriving eligibility from a device clock.

- Create and accept a fresh 1,000-wei test agreement; confirm stored terms and fund exactly 1,000 wei. Keep starting credits for both wallets so later assertions use deltas.
- A proposes `propose_settlement(id, 60, 3600, 0)`: offer #1, `OFFER_PROPOSED`, B is recipient. Record `created_at`, `expires_at`, and `effective_expires_at` from chain state.
- Reject one wallet confirmation before broadcast; confirm no new hash/state change. Do not confuse wallet rejection with an on-chain rejected offer.
- B counters with `propose_settlement(id, 67, 3600, 1)`: #1 becomes `OFFER_SUPERSEDED`; #2 belongs to B and only A may accept it. Confirm the stale #1 acceptance and self-acceptance guards (`STALE_OFFER`, `ONLY_OFFER_RECIPIENT`).
- A accepts `accept_settlement(id, 2)`: `MUTUAL_SETTLEMENT_ACCEPTED`, fee `0`, Party A `330`, Party B `670`, conservation `1000`. No AI performance finding is implied.
- Check credit deltas once only. Withdraw separately from each wallet; verify the finalized native child transfers and exact recipient/value. A finalized withdrawal receipt alone is not delivery proof.
- On another fresh agreement, exercise recipient rejection (`OFFER_REJECTED`), proposer cancellation (`OFFER_CANCELLED`), replacement and expiry (`OFFER_EXPIRED` view; `OFFER_NOT_ACTIVE` on acceptance while the agreement remains negotiable). Use the stored effective deadline for the expiry check; the minimum offer window is one hour.
- Confirm unresolved/expired offers do not extend response or absolute resolution deadlines, change readiness, or block the original no-show/AI/timeout paths. Repeat one pending-hash recovery after reload without resending.
- Switch releases with the same wallet and the same textual case ID; confirm different contract addresses, isolated history, and cleared consent. Open an old unversioned v4 link and recover existing v4 credit normally.

The isolated GLSim funded case remains blocked by its native-value forwarding limitation. Do not relabel the direct/mock tests as chain evidence or change funding validation to get a pass.

## Rollback without hiding funds

If v5 has ever accepted funds, never roll back to an old app build that lacks v5 support. Keep both retained releases and their database schemas. Change only the default core/helper manifests back to the accepted v4 pair, preserving the v5 retained entry and v5 deep links. Verify both versions' records and withdrawals before switching production. Do not delete, migrate or merge escrow, journals or hashes.

Finish with public Ubuntu CI at the final commit, signed-out evidence-link checks, and a <=1,000-character milestone summary limited to completed changes. The user submits the portal form.
