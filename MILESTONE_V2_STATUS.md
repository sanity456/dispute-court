# Dispute Court milestone v2 candidate

Status: v6 contracts deployed and source-verified on Studionet; **not yet live-flow tested, published as a reviewer preview, or submitted**. The accepted v4 production site and the v5 milestone release are unchanged. The portal milestone number v2 is distinct from contract protocol v6.

## New functionality since milestone v1

- `DisputeCourtV6` makes a validator AI decision provisional for 48 hours. No party receives withdrawable credit during that period. Either agreement party may file one public, reasoned appeal.
- An appeal gives both parties the same fixed 24-hour evidence window, up to three additional captured HTTPS sources each. Early readiness can close it; an inconclusive early review reopens only the remaining time and quota. Evidence and resolution deadlines never move.
- A second validator consensus review can replace the original decision. The original ruling, reason, source observations, all review attempts, final reason code, and allocations remain inspectable. If review is still inconclusive at the fixed deadline, anyone may finalize the original decision so escrow cannot be held indefinitely.
- The existing fee, exact allocation and withdrawal machinery runs **only after** a final ruling. Cooperative settlement, no-show, and existing timeout paths remain final as before.
- The same app has a version-gated appeal panel, explicit no-credit warning, consent tied to the current record, public evidence capture, deadline reminders, directory states, and operator expiry guidance. V4/v5 remain callable through their existing release schemas; v6 writes are not offered on them.

## Checks completed locally

- GenVM lint passes on all six v4/v5/v6 core and helper contracts, with the pinned runner checked by `scripts/check_contracts.py` and `scripts/check_reproducibility.py`.
- Direct regression suite: 559 passed, 6 integration tests intentionally excluded. Eight direct v6 appeal tests cover roles, exact deadlines, custody, one appeal, evidence limits, changed allocation, inconclusive review, timeout liveness, and unaffected cooperative settlement.
- Web tests: 134 passed. TypeScript type-check, ESLint, and Vercel production build passed locally after v6 activation in the candidate branch.
- The five-validator Ubuntu consensus suite passed at [CI run 38062537181](https://github.com/sanity456/dispute-court/actions/runs/38062537181) on commit `27a154272b61cf7cb64f4c379ac01910a403b8ba` (before the deployment manifest update).
- Account 9 deployed v6 core `0x26d7236E84632FAA3C3A158A2c000D357f021986` in transaction `0xf8cf3b5a56695e5a437b6b367a55ee164799778df5828d7e9497835ba0c95114`, and v6 evidence helper `0x0a2fB31E95CED90691C951c215d54EbFe9f05f81` in transaction `0x1f988d430794e6e7705eb08ce9ba2f655da2070a4554fb2e34dbcfed77d4be2f`. The read-only release verifier confirmed finalized successful execution, exact source bytes and SHA-256, owner, 200 bps fee, v6 appeal policy, and helper binding. V4 and v5 also re-verified unchanged.
- `git diff --check` passed. Repository-wide format check still reports pre-existing differences in unrelated tracked files; the new v6 files were formatted.

## Remaining release gates

1. With two wallets, test a funded provisional ruling, one appeal, final credit, and a separate native withdrawal transfer on the deployed v6 release. Fixed windows mean this may take several days without an explicitly designed short-window test contract; direct-mode time warps are not live-network proof.
2. Publish a separate reviewer-accessible Vercel preview of the candidate branch without changing the v4 production alias. Run signed-out review and recovery checks.
3. Confirm the exact rewarded milestone v1 Git commit in the portal, then provide an immutable comparison to the final v2 commit, CI run, source/deployment links, and transaction evidence. Only then draft and submit the milestone.
