# Dispute Court milestone v2 candidate

Status: local candidate; **not yet deployed or submitted**. The accepted v4 production site and the v5 milestone release are unchanged. The portal milestone number v2 is distinct from contract protocol v6.

## New functionality since milestone v1

- `DisputeCourtV6` makes a validator AI decision provisional for 48 hours. No party receives withdrawable credit during that period. Either agreement party may file one public, reasoned appeal.
- An appeal gives both parties the same fixed 24-hour evidence window, up to three additional captured HTTPS sources each. Early readiness can close it; an inconclusive early review reopens only the remaining time and quota. Evidence and resolution deadlines never move.
- A second validator consensus review can replace the original decision. The original ruling, reason, source observations, all review attempts, final reason code, and allocations remain inspectable. If review is still inconclusive at the fixed deadline, anyone may finalize the original decision so escrow cannot be held indefinitely.
- The existing fee, exact allocation and withdrawal machinery runs **only after** a final ruling. Cooperative settlement, no-show, and existing timeout paths remain final as before.
- The same app has a version-gated appeal panel, explicit no-credit warning, consent tied to the current record, public evidence capture, deadline reminders, directory states, and operator expiry guidance. V4/v5 remain callable through their existing release schemas; v6 writes are not offered on them.

## Checks completed locally

- GenVM lint passes on all six v4/v5/v6 core and helper contracts, with the pinned runner checked by `scripts/check_contracts.py` and `scripts/check_reproducibility.py`.
- Direct regression suite: 559 passed, 6 integration tests intentionally excluded. Eight direct v6 appeal tests cover roles, exact deadlines, custody, one appeal, evidence limits, changed allocation, inconclusive review, timeout liveness, and unaffected cooperative settlement.
- Web tests: 133 passed. TypeScript type-check, ESLint, and Vercel production build passed locally.
- `git diff --check` passed. Repository-wide format check still reports pre-existing differences in unrelated tracked files; the new v6 files were formatted.

## Remaining release gates

1. Run the new local five-validator v6 smoke test on Ubuntu CI. Windows GLSim 0.29.2 failed deployment of both v6 and an unchanged v5 baseline, including a fresh-process v5 run; no v6 consensus success is claimed from Windows. The current GLSim SDK also cannot forward native value, so it cannot prove the funded appeal path.
2. Deploy the v6 core and capture helper to GenLayer Studionet using the owner wallet, then verify finalized successful receipts, exact source hashes, config, and helper binding. No address or transaction has been recorded yet.
3. With two wallets, test a funded provisional ruling, one appeal, final credit, and a separate native withdrawal transfer on the deployed v6 release. Fixed windows mean this may take several days without an explicitly designed short-window test contract; direct-mode time warps are not live-network proof.
4. Register verified v6 manifests while retaining v4 and v5; publish a separate reviewer-accessible Vercel preview without changing the v4 production alias. Run signed-out review and recovery checks.
5. Confirm the exact rewarded milestone v1 Git commit in the portal, then provide an immutable comparison to the final v2 commit, CI run, source/deployment links, and transaction evidence. Only then draft and submit the milestone.
