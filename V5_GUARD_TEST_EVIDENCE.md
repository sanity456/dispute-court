# v5 rejection, cancellation, recovery and expiry checks

Source checkpoint: `51cbb8805887167cbe4b435fcdb705b01e1c7387`. Same app, separate Studionet v5 candidate; no milestone push or production activation.

Agreement `court-v5-guards-20260920-02` uses the same A/B test wallets as [the completed negotiation cycle](V5_HUMAN_WALLET_EVIDENCE.md). Exactly 1,000 wei is funded. These observations span September 20–21 UTC.

## Verified so far

- Create, B acceptance and exact-value funding finalized successfully; exact decoded inputs/outputs and immutable terms were checked.
- Reloaded while the creation UI awaited finality. Activity retained the exact hash and reconciled it to finalized successful execution without resubmission. This is saved-journal recovery, not an injected network outage or pre-hash crash test.
- A offer 1: 40/60, 3,600 seconds. B rejected it with `OFFER_REJECTED` at stored timestamp `1789950118`. Escrow, credits and original deadlines were unchanged.
- B offer 2: 33/67, 3,600 seconds. B cancelled it with `OFFER_CANCELLED` at stored timestamp `1789950391`. Offer 1 retained its rejection and original closure time; no credits were allocated.
- B offer 3: 50/50, created `1789950518`, effective expiry `1789954118` (`2026-09-21T01:28:38Z`). Read-only finalized-state contract view returned `OFFER_EXPIRED`; escrow, credits, original deadlines and earlier closures were unchanged. Observation label `2026-09-21T01:31:20.804Z` is not the eligibility proof; no expiry transaction was sent.
- B's full refund finalized with `PARTY_B_AUTHORIZED_REFUND`, allocating exactly 1,000 wei to A and zero to B/fees. Exact decoded inputs/output matched the cooperative-refund rule. Parent: `0x4adb0b542dc6a24479e04947b7c026aefc5895b44286107d39dcf16437218bb3`.
- A's withdrawal finalized successfully, emitting payout `payout-00000003` at stored timestamp `2026-09-21T01:51:42.522408+00:00`. Parent `0x25027dcbd2c7f3fdb761bafdccaf95e7315244007f9620a211a08aae501468ba` references exactly one native child: `0x2147316e839c57af62e3b50011339d8745078639f72cff977cf762257fda7bf2`. That child finalized with `value_credited=true`, type 0, exact core sender, A recipient and 1,000 wei value. Both final contract credits are zero.
- Complete local contract regression rerun: **551 passed, 5 integration tests deselected**. Complete frontend suite: **125 passed**. Local results do not replace the required public Ubuntu workflow.

Exact public transaction payloads, state reports and local rollback observations are in [the original guard-test checkpoint](evidence/milestone-v1/guard-tests-in-progress.json), preserved unchanged. [Completion evidence](evidence/milestone-v1/guard-tests-completion.json) adds expiry, refund and native-withdrawal verification. This wallet cycle is complete; it does not establish overall submission readiness.

## Local release/rollback drill

Chrome retained the same wallet session across v4/v5 selection. V4 opened its original `human-wallet-v4-20260906-01` record. Looking up the v5-only ID in v4 failed closed with paused actions, although its error message was generic. Wallet B's v4 Activity had no v5 entries.

Temporarily changed **only** the isolated preview's default manifests back to v4 while retaining v5. After a clean dev-server restart, v4 was the default and v5 remained selectable. The funded v5 guard agreement, pending offer 3, refund-review controls and withdrawal section stayed accessible; creation was disabled for non-default v5. All eight exact journal entries and the indexed v5 record survived, with no matching entries in v4's database. Consent was unchecked after navigation. Restored v5 as the preview default and checked it after another clean restart.

This uses actual local SQLite files, not Neon. With both available credits at zero, the drill proves access and preservation—not an executed retained-release/legacy withdrawal. Dev-server manifest changes required restart. A test-harness comparison initially failed on SQLite row prototypes; normalizing the selected public fields fixed the comparison without changing data.

## Still open

- Live failed-acceptance reason-code evidence (`STALE_OFFER`, `ONLY_OFFER_RECIPIENT`, `OFFER_NOT_ACTIVE`) remains separate from passing direct tests and visible UI restrictions. No such failed live transaction is claimed here.
- Temporary-schema real Neon isolation/SQL rollback/saved-hash recovery passed; see [its scoped evidence](V5_RECOVERY_EVIDENCE.md). Actual Vercel rollback and legacy/retained withdrawal recovery remain, along with exact browser/MetaMask environment evidence, final clean public Ubuntu CI, authorized publication/rollout, signed-out immutable evidence links and final milestone notes.

No wallet approvals are automated. The requested scheduled check was paused to conserve usage and remains paused; expiry was verified read-only when the user returned. Refund and withdrawal were separately approved by the user.
