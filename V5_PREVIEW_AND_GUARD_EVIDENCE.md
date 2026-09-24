# v5 preview recovery, rollback rehearsal and stale-offer rejection

Observed September 21–24, 2026 UTC. These are scoped test results, not overall submission approval. Application candidate: `b740c418154d45632a0407f73bcfb41c15f6ccc2`. Production and GitHub `main` were not changed by these checks.

## Deployed preview recovery

[Human preview evidence](evidence/milestone-v1/preview-human-recovery.json) records the authorized Vercel preview checks. Wallet A signed in, imported its already-completed 1,000-wei withdrawal, and saw the exact finalized native child and recipient. Sign-in and the saved request survived a full page reload. V4 kept a separate, empty history, rejected the v5 hash, and opened the original unversioned legacy agreement. No new chain transaction was sent by the recovery checks.

The preview requires Vercel access. This does not establish anonymous reviewer access. A saved finalized withdrawal is distinct from a newly executed retained-release withdrawal.

## Deployed rollback-configuration rehearsal

[Rollback evidence](evidence/milestone-v1/rollback-preview.json) identifies separate preview deployment `dpl_Dq443cEKv86w6VznHfvsUbSnyffz` and local immutable commit `8bd910fb4b4483a73fd45620f7c018d36b6a726a`. Only the two default core/helper manifests differ from the candidate: both select the accepted v4 pair. The retained v5 entry, application code and address-scoped Neon data remain unchanged.

The deployed site defaulted to v4. With the same wallet signed in, retained v5 displayed the saved withdrawal without reimport, reverified delivery, and opened the negotiated agreement's versioned deep link with the correct 330/670-wei result. New agreement creation was disabled for retained v5. Switching to v4 preserved sign-in and showed zero v5 requests there.

This is a separately deployed rollback configuration, **not** a production alias rollback, contract rollback, database rollback, or newly executed withdrawal. The rollback commit is currently local, not publicly published; the public candidate CI does not establish a public CI pass for that configuration.

## Live stale-offer rejection

[Machine-readable evidence](evidence/milestone-v1/stale-offer-live.json) records the exact decoded inputs, sender, target, 0-wei value, timestamps, baseline and verifier hashes.

- Transaction: `0xa4288ff885eeb2168cdc0bb19d2720bd4a9c2892f58617faf39ad5aa8d319d69`.
- Call: `accept_settlement("court-v5-guards-20260920-02", 1)` against the v5 core, from Wallet A.
- Fixture: already resolved, latest offer number 3. The contract checks the stale number before checking negotiation status.
- Finalized **failed execution**, with the allowlisted contract error literal `[EXPECTED] STALE_OFFER`. Failure is the expected result of this negative test; it is not successful settlement.
- No child transaction. The stored agreement status, terms hash, offer count, accepted-offer number, paid allocations and both wallets' zero credit balances were unchanged.
- RPC transaction creation timestamp: `2026-09-21T02:58:49.995896+00:00`. Verification observation: `2026-09-21T03:00:05.097Z`. Neither is claimed as an offer-expiry eligibility timestamp.

The test used an isolated loopback page limited to that one zero-value method/argument combination. Human MetaMask approval was required. Synthetic harness checks covered fixed target/value/arguments, consent, account/network rechecks, saved-hash duplicate prevention, and disabled retries after uncertain outcomes. The complete frontend suite rerun passed **128 tests**. No contract or production UI source was changed.

## Live negative acceptance and escrow return

[Machine-readable evidence](evidence/milestone-v1/negative-acceptance-live.json) records exact wallet roles, contract, decoded inputs and outputs, stored offer timestamps, expected failure codes, unchanged-state checks, the full refund allocation and the finalized native child transfer. The funded fixture `court-v5-negative-20260921-03` held exactly 1,000 wei.

1. Wallet B attempted to accept current offer #2 after its stored effective expiry `1789964859` (`2026-09-21T04:27:39Z`). Transaction `0x0f488e97b74e9af5e9fb760f57db5c2623e5f15e3853e6f38fd86c00b313014e` finalized with **failed execution** and `[EXPECTED] OFFER_NOT_ACTIVE`. The case, allocations and both credits remained unchanged.
2. Wallet A proposed fresh 50/50 offer #3 in transaction `0xcda779612c7b36bcb93e2477335392bb4bc703c1a51bf6ca5cc2adeb962f3c85`. It finalized successfully with stored creation `1790282079`, effective expiry `1790285679`, and 500/500-wei proposed split. No escrow was allocated or transferred.
3. While offer #3 was pending, proposer Wallet A attempted `accept_settlement(case, 3)`. Transaction `0xf3b8cb69e7980d8195bca9f697e5b1c6141d552ebf1b7134b8c6f761fb273675` finalized with **failed execution** and `[EXPECTED] ONLY_OFFER_RECIPIENT`. No child transfer; case, allocations and both credits unchanged.
4. Wallet B authorized full cooperative refund in transaction `0x02df3fd8f8f528f414f42e01c8db8383ed6a4475b060a2dac0dfd497fa2cd6c9`. It finalized successfully with `PARTY_B_AUTHORIZED_REFUND`, zero fee, 1,000 wei Wallet A credit and zero Wallet B credit. This was contract allocation, not native wallet delivery.
5. Wallet A called `withdraw()` once in transaction `0x45581d8859cf77873427ae3c517baf0e3b8d85baa5ffdc616fea2610c5189ffc`. The successful finalized parent referenced child `0x7e3d2babef2952ccd41270a922c93b30057c3690fb1fa169cc0a33c555fceeb5`, which independently finalized with `value_credited=true` and exactly 1,000 wei delivered from the core to Wallet A. Both remaining contract credits are zero.

All five wallet actions used isolated, one-call loopback pages with human MetaMask approval. The negative tests used zero-value calls and expected contract errors; neither is presented as a successful settlement. The verifiers allowlisted the expected reason literals and avoided publishing raw RPC error objects. The consolidated evidence has been checked against all five local verifier outputs. Publication, final-commit CI and anonymous reviewer access are separate gates, not established by this file alone.

## Still outstanding

Exact current browser/wallet versions, final public evidence publication/access review, accepted portal baseline confirmation and separately authorized production rollout remain outstanding. Preserve the known payable GLSim skip; do not relabel it as a pass.

The existing [public Ubuntu workflow](https://github.com/sanity456/dispute-court/actions/runs/35553364388) passed on candidate `b740c418154d45632a0407f73bcfb41c15f6ccc2`: 551 direct tests, 128 frontend tests, and 4 consensus tests with 1 explicitly skipped. That earlier run is not a final evidence-commit CI pass.
