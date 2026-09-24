# v5 funded negotiation — human wallet evidence

Historical September 20 checkpoint. Later guard tests, public publication, final evidence-commit CI and reviewer preview access are recorded in [milestone status](MILESTONE_V1_STATUS.md); the historical remaining-gates list below is not the current checklist.

## Result and scope

**Passed on Studionet, 2026-09-20:** creation, counterparty acceptance, exact 1,000-wei funding, wallet cancellation, an offer and counteroffer, recipient settlement acceptance, and both native withdrawals. This is one completed happy-path cycle, **not completion of every milestone/submission gate**.

Same Dispute Court app. Source checkpoint: `51cbb8805887167cbe4b435fcdb705b01e1c7387`. The isolated local preview used that code with three candidate release-manifest overrides. Live v4 and Vercel production were not changed. These milestone commits have not yet been pushed.

Core: `0x369D8f95744C8eaBcF50E8De009Eb162248D1504`, chain `61999`.
Agreement: `court-v5-human-20260920-01`.
Party A: `0x7Cef5DBbD598ba74EF9C665c9853E573448d97D0`.
Party B: `0x29B8b7D7CBF534Eba01E56919dE19d79d1509360`.

Full public test data is in [the JSON evidence bundle](evidence/milestone-v1/negotiated-settlement-wallet-cycle.json). It contains the candidate manifests, exact decoded calldata and output payloads for all eight successful wallet transactions, verification reports, stored contract timestamps, credit baselines and both native child-transfer identifiers. It contains no raw RPC error objects or private keys. See [deployment source verification](V5_DEPLOYMENT_EVIDENCE.md).

## Observed sequence

| Step | Verified result |
| --- | --- |
| A creates; B accepts | Exact parties, terms, 1,000 wei and five one-day windows matched the review. Terms hash remained unchanged. |
| A funds | Finalized successful exact-value funding; performance deadline is 86,400 seconds after the stored funding time. |
| A cancels first wallet proposal request | Browser and Activity report cancellation without a saved hash. Finalized state still has zero offers, unchanged quotas, credit balances and performance deadline. This is not an on-chain offer rejection. |
| A proposes offer 1 | 40% A / 60% B; 400/600 wei, zero fee, 3,600-second validity, `OFFER_PROPOSED`. |
| B's first counteroffer attempt is cancelled | Saved request has no hash; offer 1 remains pending and B's offer count stays zero. |
| B retries with offer 2 | 33% A / 67% B; 330/670 wei, zero fee, 3,600-second validity. Offer 1 is `OFFER_SUPERSEDED`. Each party's offer count is one. |
| A accepts offer 2 | Case resolved with `MUTUAL_SETTLEMENT_ACCEPTED`, `cooperative_negotiated`, and performance `not_evaluated`. No AI adjudication claim. |
| Credit comparison | Starting credits were zero. Exact increases: A 330 wei, B 670 wei. Fee 0; conservation 1,000 wei. |
| A withdraws | Parent finalized successfully; its linked native child finalized and credited exactly 330 wei to A. |
| B withdraws | Parent finalized successfully; its linked native child finalized and credited exactly 670 wei to B. Both remaining contract credits are zero. |

The native delivery checks require the parent's exact child hash, native transaction type `0`, `FINALIZED`, `value_credited=true`, expected core sender, correct wallet recipient and exact value. A successful parent receipt alone was not treated as delivery.

## Time-sensitive evidence

These are contract-stored values, not eligibility inferred from the local clock:

- Creation: `2026-09-20T23:08:50.297752+00:00`; acceptance deadline `1790032130`.
- Acceptance: `2026-09-20T23:14:36.716411+00:00`; funding deadline `1790032476`.
- Funding: `2026-09-20T23:20:05.411541+00:00`; performance deadline `1790032805`.
- Offer 1: created `1789946836`, expiry `1789950436`.
- Offer 2: created `1789947325`, expiry `1789950925`; original offer closed at the counteroffer's stored creation time.
- Settlement: `2026-09-20T23:39:21.176697+00:00`, before offer 2's effective expiry.

All eight successful parent transactions were checked for finalized successful execution, expected sender, target, method, exact arguments and native input value. The JSON bundle preserves their decoded return payloads separately from later state reads.

## Remaining gates — not claimed as passed

- Live on-chain offer rejection, proposer cancellation and stored-timestamp expiry tests; stale/self-acceptance guard evidence. The wallet cancellations above do not replace these tests.
- Pending-transaction reload/recovery, real v4/v5 storage isolation, legacy credit access and rollback drill.
- Complete clean Ubuntu CI at the final public commit. Local direct tests and the simulator results remain separate evidence; this human test does not change the simulator's native-value limitation.
- Final candidate app review, authorized GitHub push and Vercel rollout, source re-verification, signed-out evidence-link checks, and the final milestone summary.

Browser and MetaMask versions for this specific run have not yet been independently recorded. Do not reuse old screenshots as proof of the current environment.
