# Studionet operations and recovery

## Service boundaries

This product has its own Sites project, D1 database, contract addresses, account journal and owner session. Do not point it at the other product's database or contract. The core v2 contract is the authority for balances, parties, deadlines, eligibility and decisions.

The owner desk requires the signed-in Sites account plus a one-time owner-wallet message signature. This grants an eight-hour HTTP-only session, not transaction authority. Never request a seed phrase/private key in support; every on-chain write still needs its own wallet confirmation.

## Normal operation

- Read the private owner dashboard for partial index coverage, failed RPC calls, stale stages, open tickets and uncertain payout deliveries.
- Run one bounded index refresh when coverage is partial. It walks 50 summaries and at most two full records per pass, with a 60-second refresh age for active details. A pool may require two participant pages, bounded by its 100-person contract maximum.
- Open and refresh a record before taking its displayed next action. Queue entries are observations, not guarantees that the current contract still accepts the action.
- Use My work for the connected wallet; account history belongs to the signed-in account and remains separate from wallet identity.
- Moderation only controls public-directory visibility and requires a reason. Direct links and all on-chain data remain unchanged.
- Saved support responses appear in the requester's Help section. There is no external email/SMS notification service yet.

## A pending or uncertain transaction

1. Stop clicking the action again. Preserve the request ID and transaction hash.
2. In Activity, recheck execution and delivery. Refreshing/importing/reconciling a hash never broadcasts it again.
3. If the request has no hash, inspect the wallet's own history. Attach its actual hash if it was submitted. Only close the request as unsigned when the wallet explicitly rejected it or you know no transaction was broadcast.
4. An unknown result remains review-required. A finalized reverted transaction is a failure, not success.
5. A successful withdrawal can still have a pending/unknown child transfer. Verify the finalized native child's sender, recipient, exact wei, transfer type and credited flag. Never recredit or send another payment solely because a child has not appeared.
6. Escalate a genuine failed/missing transfer to the Studionet operator with public identifiers, not secrets. The application cannot reverse network transfers or reconstruct an unproven balance.

The browser emergency outbox contains only request ID/hash/time on that device, to bridge a temporary account-journal outage. D1 is the durable history. If storage writes fail, the app must not pretend the request is safely saved.

## Evidence problems

Use only low-sensitivity public HTTPS sources. The capture helper uses the same GenLayer renderer/normalization as the product, stores a wallet-scoped immutable capture, and moves no value.

Private addresses, credentials, fragments, nonstandard ports and oversized text are rejected. DNS/redirect isolation is a GenLayer runtime boundary, not a guarantee supplied by URL syntax checks. A stable capture can still fail evaluation if the source changes before the second fetch. A digest proves which bytes were committed; it does not prove those bytes are true.

Do not silently trim, summarize or replace a captured source. Review the exact text, revise the source if needed, then obtain a new capture. Court duplicate detection is an app guard; the immutable v2 contract itself still permits repeated submissions.

## Operator runner

From this frontend directory:

```text
node scripts/operator.mjs --max-actions=3 --offset=0
```

This is a **dry run**. It sends no on-chain transaction and needs no signer. It inspects at most ten records, with at most five candidate actions per invocation. Advance the offset deliberately for larger directories.

Execution is opt-in with `--execute` and an externally supplied `KEEPER_PRIVATE_KEY` for a dedicated Studionet-only account. Never paste a key into a shell command, repository, support ticket or frontend environment variable. Use an approved secret manager/process environment. Never reuse the contract-owner key.

The runner verifies chain 61999 explicitly, never relies on the global CLI network, uses full consensus, and sends zero native value. It may only perform permissionless deadline/settlement actions. It cannot fund, withdraw, accept for a party, choose a cooperative allocation, change fees, or select a party's fallback.

Its durable `.local-data/operator.sqlite` records the intent before signing. Any unresolved old request stops new execution. Known hashes are reconciled on the next run; a no-hash uncertain request needs an operator to compare wallet history and safely reconcile the journal. Do not delete the journal to bypass that stop. Do not run concurrent scheduled instances. No host, schedule or unattended signer has been enabled in this release.

## Data, privacy and retention

- D1 retains the signed-in account's requests, preferences and support; the product also caches public records and independently verified receipts.
- Evidence text and verdicts live on the public chain. Support content is private to its account and the verified operator. Never put secrets or sensitive personal data into either.
- There is no third-party behavioral analytics SDK. RPC counters and indexed lifecycle-stage counts are operational observations, include test fixtures, and are not user-adoption metrics.
- Expired cache, rate-limit, nonce and owner-session rows are cleaned in bounded batches. Requests, tickets, observations and authoritative receipt records are not automatically purged.
- Agree a retention/deletion process and a secure backup destination before onboarding testers. Clearing a database cannot erase chain history.
- Use built-in record, history and owner-report exports for portable snapshots. They are not a substitute for an encrypted full D1 backup and a tested restore procedure.

## Release and rollback

Use the exact lockfile, dependency patch and root `drizzle/` migrations. The production bundle requires the Sites D1 binding `DB` and fails closed without it. The Node SQLite adapter is for local preview only.

Do not copy `.local-data`, secrets, wallet state or synthetic local support tickets into production. Packaging must include generated migrations; hosting metadata contains only the project ID and logical bindings.

Keep access owner-only until explicitly approved. A rollback must select an already validated app version compatible with the current additive database schema; never roll back a deployed intelligent contract or delete user rows as an application rollback. Preserve public deployment receipts and saved source. GitHub publication is not authorized.

## Incident notes to collect

Record product, public record ID, request ID, public hash, observed status, UTC time, expected action, and whether the native transfer was independently credited. Exclude credentials, auth headers, private keys and private evidence. State what is known, what remains unconfirmed and whether any write was attempted.

## Dependency patch maintenance

React/React DOM/RSC are pinned to 19.2.8; Vite to 8.0.16. Patched transitive versions are pinned in `pnpm-workspace.yaml`.

Upstream image-size has no published 2.0.3 release at verification time. The checked-in pnpm patch rejects zero/undersized/out-of-range boxes and non-progressing ICNS entries in every distributed CJS/ESM copy. The tests execute malformed fixtures in disposable processes so a regression cannot hang the suite.

A version-based audit still reports image-size's two high advisories. Do not hide them or invent a package version. Track them as locally mitigated, obtain independent review, and replace this patch only after verifying an actual upstream fix. References: [React advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g), [image parser research](https://joshua.hu/image-size-infinite-loop-dos-vulnerabilities).
