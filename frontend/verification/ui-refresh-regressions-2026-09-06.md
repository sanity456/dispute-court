# Post-wallet-test UI regression checks

Date: 2026-09-06. Dispute Court only. The immutable live-wallet proof is [human-wallet-v4-e2e-2026-09-06.md](https://github.com/sanity456/dispute-court/blob/6021966a967003c92ba57f1147a28408283c6ca4/frontend/verification/human-wallet-v4-e2e-2026-09-06.md). These follow-up changes were **not** present during that earlier human test.

## Changes

- Preserve the selected agreement, drafts and loaded capture during an unchanged focus/revision refresh. Pause actions until fresh session, configuration and case reads succeed. A failed case read leaves the last record visible but read-only.
- Bind consent to the wallet/network/core/helper workspace identity and canonical recorded agreement state. Terms, state, readiness, evidence or deadline changes require review again. Actual wallet and network checks remain in the transaction path.
- Keep the specific rejected/expired login reason through the next signed-out session refresh.
- Scope new emergency hashes by product, wallet and core. Never automatically attach v2 entries with unknown contract identity to the new journal. Activity exposes those historical hashes with explicit verification, export and support controls. Unreadable storage, older hashes and malformed entries are preserved; recovery never resends a transaction.

No contract, database schema, dependency version, deployment manifest or owner setting changed.

## Verification

All 110 frontend tests pass, including ten new recovery/review regressions and expanded wallet/core isolation coverage. Formatting, zero-warning lint, both TypeScript configurations and both supported builds pass. The read-only Studionet verifier still matches both deployed source hashes and the v4 configuration.

The browser fixture runs the actual ProductHome and EvidenceCapture components with local mock reads and a mock capture. Start it with `node scripts/preview-workspace.mjs` from `frontend/` and open the printed loopback URL. It builds entirely in memory, has no production route or database, blocks network connections with CSP, and cannot sign or send an on-chain transaction. This is UI-state evidence, **not** another live-wallet trial or consensus test.

Browser observations:

| Action | Observed result |
| --- | --- |
| Review acceptance terms, then Refresh | Review remains checked; acceptance is disabled during the read and resumes after unchanged data returns. |
| Change the mock terms hash | Review becomes unchecked; acceptance remains disabled pending a new review. |
| Enter `Draft kept across refresh — local fixture only.`, capture and review `https://example.com/fixture`, then Refresh | Draft, captured text and checkbox remain visible. Commit pauses during the read and enables only after it succeeds. |
| Simulate a read outage | Visible refresh error; draft and capture retained; commit disabled. |
| Recover the read with unchanged data | Prior review remains valid and commit becomes available. |
| Change the mock evidence readiness state | Capture and draft remain, but the checkbox clears and commit requires review again. |
| Switch the mock wallet | The workspace remounts for the new wallet; the previous wallet's draft, capture and review are cleared. |

The mock source was `Fixture source. No live capture or wallet transaction.`, 54 UTF-8 bytes, SHA-256 `610924f7bad09a27a0e7403387d9e5ee1fc92c58bad0071965b4c9900b316abd`. Fixture time is fixed at Unix `100`, not used as proof of chain time. Contract timestamp regressions separately use the stored GenVM transaction datetime.

The fixture also checks wallet-change remount behavior. Production redeployment, signed-in Activity recovery visibility, public document headers and the complete clean Ubuntu run are separate final-release gates recorded in `STEWARD-RESPONSE.md`.
