# Submission and activation checklist

## Completed in this checkout

- Versioned v4 core and evidence helper; v3 and earlier source preserved.
- Complete-source size enforcement and consistent authoritative URL policy.
- Per-exhibit quarantine, strict payout types, fixed fee-free timeout, and voluntary full-counterparty settlement.
- Per-client wallet login quotas without unsigned wallet-address lockouts.
- Nonce-based script CSP and defensive document headers.
- Security regressions, project-local Python requirements and a safe contract-check command.
- Wallet-only sign-in and the two-product separation preserved.

## Required before calling the live product security-fixed

- [x] Run the project-local check script, frontend tests, lint, both type checks, formatting and both supported builds on the release source (2026-08-30). Re-run after further code edits.
- [x] Deploy a v4 core plus its own v4 evidence helper on Studionet. Verify successful execution as well as finality, exact source bytes, owner, fee, directional decision policy, helper link and protocol version.
- [x] Preserve historical deployment/data for recovery and isolate the v4 product schema by product and core address without silent record reassignment.
- [x] Update both manifests consistently and pass `node scripts/verify-security-release.mjs --expected-fee-bps 200` from `frontend/`.
- [ ] Activate and verify the v4 public evaluator on the approved Vercel account.
- [x] Verify production headers and browser execution after deployment, including fresh document nonces, wallet-only UI, no console errors and no horizontal overflow.
- [x] Complete automated signed-wallet/session and two-wallet live lifecycle paths, including evidence-based AI adjudication and separate payout-child delivery verification.
- [x] Publish a public, commit-pinned Ubuntu 24.04 workflow that runs every direct, isolated-consensus and frontend test, explicit stored-chain timestamp regressions, both builds, source verification and hosted document checks.
- [ ] Repeat the completed human two-wallet injected-browser trial on v4 and verify that full Party B performance pays Party B before withdrawal.
- [ ] Exercise a bad exhibit beside valid evidence, schema failure, early/late timeout boundaries, outsider rejection, and fee-free settlement in an authorized integration environment.
- [ ] Test the supported injected EVM wallet/browser combination. Do not claim WalletConnect, mobile deep-link, or smart-contract-wallet support without implementing and testing it.

## Submission access and program rules

- [x] Give evaluators signed-out access to the public demo, repository and immutable deployment-source commit while retaining protection on non-aliased previews.
- [ ] Obtain the actual program rules and confirm network, eligibility, deadline, public-source/license, video and other required artifacts.
- [ ] Include a concise walkthrough, contract addresses, tested commit, setup instructions and an honest limitations statement.
- [ ] Describe this as an implementation-assisted review, not an independent security certification.

The published npm metadata still lists `image-size 2.0.2` as latest; the advisory's `2.0.3` fix is not published there as of this review. Existing parser patches and regression tests are retained. Full dependency scans therefore still flag two dev-tool advisories; do not suppress them or pretend the dependency scan is clean. If the submission requires a zero-advisory scan, resolve that policy with the program or wait for a verified compatible upstream release.

No production-money readiness is claimed. Studionet test assets only.
