# Dispute Court milestone v1 — owner submission draft

Updated 2026-09-24. This is a proposed milestone for the **same accepted Dispute Court project**, not a second app. Portal milestone `v1` corresponds to the new contract/application release `v5`. The owner reviews and submits the portal form; this file does not constitute a submission or an approval.

## Suggested title

Negotiated settlements and release-safe Dispute Court v5

## Changes & Improvements (under 1,000 characters)

> Dispute Court adds v5 negotiated settlements to the accepted app. Parties can make numbered, expiring offers and counteroffers, accept or reject by role, cancel their own offers, and split escrow by whole percentages without a settlement fee. Credits use the existing withdrawal path. The UI adds exact wei previews, offer history, state-bound consent and release-aware routing that keeps v4 records accessible. On Studionet, human wallets completed a funded 1,000-wei 33/67 split and both native withdrawals. Expired, stale and self-acceptance calls failed with expected reason codes; a separate 1,000-wei refund was withdrawn. Public Ubuntu CI passed 551 direct tests, 128 frontend tests and four GLSim cases; one funded GLSim case remains skipped because that runner drops native value. V5 is on a separate reviewer preview; production v4 is unchanged.

## Evidence links for the portal

Use the immutable evidence commit, not only the moving branch name:

1. [Milestone code/evidence commit `fe90fca1`](https://github.com/sanity456/dispute-court/commit/fe90fca1b83e07535f6db214c804c2d47f2fc386) — the substantive delta from pre-development baseline `1e3263ab8783877bb3927762809c077840ceb8d4` is on the same repository's milestone branch. The owner has said the original Dispute Court was accepted; confirm the portal's exact accepted baseline before claiming that commit as the accepted one.
2. [Public Ubuntu Actions run](https://github.com/sanity456/dispute-court/actions/runs/36058800303) — completed successfully at that exact commit; pinned runner/source checks, direct/frontend suites, stored-chain-time tests and opt-in GLSim checks. Four consensus cases passed; one funded case was explicitly skipped.
3. [Human funded settlement cycle](https://github.com/sanity456/dispute-court/blob/fe90fca1b83e07535f6db214c804c2d47f2fc386/evidence/milestone-v1/negotiated-settlement-wallet-cycle.json) — exact decoded inputs/outputs, stored timestamps, 330/670-wei credits and finalized native deliveries.
4. [Live negative acceptance and refund cycle](https://github.com/sanity456/dispute-court/blob/fe90fca1b83e07535f6db214c804c2d47f2fc386/evidence/milestone-v1/negative-acceptance-live.json) — `OFFER_NOT_ACTIVE`, `ONLY_OFFER_RECIPIENT`, 1,000-wei refund allocation and exact native withdrawal. [Separate stale-offer evidence](https://github.com/sanity456/dispute-court/blob/fe90fca1b83e07535f6db214c804c2d47f2fc386/evidence/milestone-v1/stale-offer-live.json) covers `STALE_OFFER`.
5. [Deployed source verification](https://github.com/sanity456/dispute-court/blob/fe90fca1b83e07535f6db214c804c2d47f2fc386/V5_DEPLOYMENT_EVIDENCE.md) and [preview recovery/rollback scope](https://github.com/sanity456/dispute-court/blob/fe90fca1b83e07535f6db214c804c2d47f2fc386/V5_PREVIEW_AND_GUARD_EVIDENCE.md).
6. Add the **deployment-specific v5 Vercel share link** directly in the portal evidence field. It was tested without Vercel credentials on 2026-09-24 (HTML and a JavaScript asset returned HTTP 200). Its access token is intentionally not stored in GitHub. The ordinary preview URL remains protected, and production remains on v4.

The immutable GitHub evidence pages were checked while signed out. The shared preview passed unauthenticated HTTP access checks, not a complete signed-out browser/wallet walkthrough. The previous Vercel deployment carries the same application code as the evidence commit; the latter adds documentation/evidence only. Do not claim a production v5 rollout, actual production alias rollback, fresh retained-release withdrawal or passing funded GLSim consensus test.
