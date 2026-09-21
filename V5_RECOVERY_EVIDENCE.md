# v5 database recovery evidence

On September 21, 2026 UTC, the real Neon PostgreSQL backend passed an isolated recovery check. [Machine-readable evidence](evidence/milestone-v1/neon-release-recovery.json) records the results. No live chain requests, wallet signatures or transactions were made by this check.

Post-check local regressions: complete direct suite **551 passed, 5 integration tests deselected**; complete frontend suite **125 passed**; zero-warning lint, TypeScript and formatting checks passed (127 source files, zero differences). These are local Windows results, not a clean Ubuntu CI run. No fresh application build is claimed for this documentation/test-harness checkpoint.

## Scope and results

The test used the application's PostgreSQL adapter, schema initializer, request journal and release-registry logic, with two temporary randomly named release schemas. All fixtures were synthetic. Chain transport deliberately threw an unavailable-RPC error; no real withdrawal was requested.

- Both schemas initialized with the existing migration, twice, without losing data.
- A deliberately failing database transaction rolled back its earlier write.
- The same wallet and case ID stayed separate across both schemas. Cross-release targets and saved-request IDs were rejected.
- Concurrent reads retained the correct search path; a transaction mixing database instances was rejected.
- A synthetic withdrawal hash survived the simulated RPC outage and reconstruction of database adapters. Duplicate withdrawal reservation and hash replacement were rejected.
- The release registry retained both versions when switching the default v5 → v4. Existing records and saved requests remained readable. New agreement creation in a retained, non-default release was rejected.
- Counts of records, intents and transactions in existing public/v4/v5 namespaces were unchanged. No authentication/session contents were read.
- Both invocation-owned temporary schemas and their test data were removed after the check. No user data was deleted.

## What this does not prove

This is real Neon SQL, but not a production Vercel rollback, not actual release-schema cold initialization on a deployed preview, and not a real legacy/retained-release wallet withdrawal. The two checked schemas and chain responses were fixtures. Database transaction rollback is distinct from a website deployment rollback. These limits remain visible in the release checklist.

The separate Studionet human test did verify delivery of the full 1,000-wei guard refund to Wallet A; see [guard evidence](V5_GUARD_TEST_EVIDENCE.md). That withdrawal ran against the current local v5 candidate, not a rolled-back production app.

## Reproduction

From `frontend`, with the authorized Dispute Court Neon credentials in the ignored `.env.local`:

```powershell
node scripts/check-neon-release-recovery.mjs --execute
```

This command performs scoped test writes. It requires the expected project ID, creates exclusively owned random schemas, refuses to overwrite an existing report, and cleans up only its own schemas. It never emits raw database/RPC errors or credentials. Preserve the previous report before intentionally arranging another run. Output is written to the ignored `artifacts/milestone-v1/v5-candidate/neon-release-recovery.json`; the checked-in copy above is the observed result.
