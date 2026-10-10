# Dispute Court v6: bounded reconsideration

Status: design and local development. No v6 deployment, reviewer preview, or milestone v2 evidence is claimed by this document.

## Authority and scope

The v6 core is a new immutable Studionet contract. The existing v4 and v5 contracts, releases, agreements, credits, and withdrawals remain on their original addresses. New v6 agreements alone use the reconsideration policy. The browser prepares evidence and shows deadlines; the contract enforces roles, escrow custody, deadline gates, consensus review, and credit allocation. Validators independently fetch the cited public sources and compare the substantive performance level.

Only a consensus AI decision is provisional. Cooperative settlement, no-show, bounded fallback, and absolute timeout keep their existing final settlement behavior. A provisional decision holds the full escrow in the contract and creates no withdrawable credit. Either agreement party may challenge it once within 48 hours. If nobody challenges, anyone may finalize after that fixed deadline.

An appeal includes a bounded reason. The parties then have 24 hours from filing to add up to three new public HTTPS exhibits each, with captured source digests, and may both mark ready to close early. The contract reruns consensus on the full record, including new evidence and the appeal reason as untrusted data. A decision replaces the provisional performance level and allocates escrow once. A `needs_evidence` result reopens the original evidence window only if time and exhibit quota remain; otherwise it leaves escrow locked for retry until the fixed 48-hour appeal resolution deadline. If that deadline passes without a defensible new decision, any connected wallet may finalize the original, already-consensed decision so absent parties cannot lock escrow. Repeated calls cannot extend either deadline.

The original decision, appeal reason, source observations, reconsideration attempts, final reason code, allocation, and timestamps remain in the agreement and attempt records. The initial ruling and appeal result are distinct; the UI must not label a provisional ruling as paid or final. Funds move only after a final resolution credits balances, and native withdrawal delivery still needs separate receipt verification.

## Required checks before milestone submission

- Complete historical and v6 direct suites: role checks, exact deadline boundaries, one appeal, evidence limits, no premature credit, allocation conservation, no duplicate payout, retry/timeout, and unaffected cooperative/no-show routes.
- GenVM lint and pinned runner, public Ubuntu CI, and at least one full-consensus test of the challenged decision path. Direct mode alone does not exercise validator agreement.
- Separate v6 deployment and source hash verification; v4/v5 records must remain accessible. Wallet A/B must demonstrate an appeal, final credit, and native transfer on the deployed v6 contract.
- A public reviewer preview, immutable compare from accepted v1 head `9237a7dedac98847d5b5ba9cf6f63d5434a6bfb8`, and signed-out evidence links. The production v4 alias is not changed as part of candidate development.
