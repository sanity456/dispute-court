# Dispute Court v5: negotiated settlements

Status: separate Studionet v5 candidate deployed and source-verified; happy-path and guard wallet cycles complete. Production activation and milestone submission remain gated. The live v4 manifests remain unchanged.

Baseline for the milestone diff: `1e3263ab8783877bb3927762809c077840ceb8d4`.
This is the pre-development repository baseline; link the portal's accepted submission when preparing the final evidence.

## Authority and product boundary

One app and repository. New agreements will use a separately deployed immutable v5 core after release approval. Existing v4 agreements, funds, addresses, source and evidence stay on v4. A release must preserve access to those records and withdrawals before changing the default contract.

The browser owns presentation, wallet authentication, previews, consent and transaction recovery. The core owns offers, party authorization, deadlines, the accepted split, credits and payout emission. The owner cannot accept on behalf of parties or redirect funds. Negotiation itself is deterministic; GenLayer's existing independently verified AI adjudication remains the route when parties disagree. Offers are not evidence of performance and are not passed to the adjudication prompt.

## Settlement rules

- Either party can propose Party B's whole-number percentage (0–100). Party A receives the complement. Preview exact wei: A = floor(escrow × A% / 100), B = remainder. No court fee; network fees may apply.
- Only the other party can accept or reject. The proposer can cancel. A counteroffer creates a new numbered offer and supersedes the previous one; the sender of a replacement never accepts it implicitly.
- Every proposal supplies the last observed offer number. Accept, reject and cancel require the exact current number. This prevents stale wallet requests from acting on newer offers.
- Offer lifetime is 1 hour–7 days, capped at the response deadline while awaiting a response, or the absolute resolution deadline after a response. If a dispute starts after an offer, its effective expiry is also capped. At the exact expiry, acceptance fails.
- Negotiation never changes agreement status, evidence, readiness, response deadlines or the absolute resolution deadline. No-show, AI and timeout routes remain callable. After any settlement all unaccepted offers are unusable.
- Each party has 50 proposals per agreement, independent of the other party's allowance. History is separately stored and paginated. No unbounded history traversal is needed to settle.
- Acceptance credits both parties once through the existing payout machinery. It does not imply native transfer delivery; withdrawal and child-transfer verification remain separate.

## Release acceptance gates

- GenVM lint, pinned runner, complete direct regressions including historical releases, frontend tests/lint/types/builds.
- Exact chain-time boundary tests, stale/counter/cancel races, unauthorized parties, independent quotas, conservation/rounding, no duplicate credits, and unchanged arbitration/timeout behavior.
- Isolated consensus test and public Ubuntu CI at an immutable commit; mocked direct tests are not consensus evidence.
- Reviewed v5 UI and transaction consent, owner statistics, negotiation history/export, same-app v4 recovery compatibility.
- Authorized Studionet deployment, byte-for-byte source matching, human two-wallet new-path test and independently verified payouts.
- Approved Vercel rollout, signed-out evidence links and concise milestone text using completed work only.

No new deployment, wallet transaction, GitHub push or submission is authorized merely by this development note.

Release plumbing is implemented locally: a matching v5 evidence helper, source verifier with candidate-directory and registered-release selection, immutable v4 archives, release-scoped API/database bindings, versioned links and a full-navigation selector. The registry requires retaining a v5 manifest before making it the default. Previous versions remain accessible for existing agreement operations and withdrawals, while new agreements are reserved for the default version. See `V5_ROLLOUT.md` for gates, `V5_HUMAN_WALLET_EVIDENCE.md` and `V5_GUARD_TEST_EVIDENCE.md` for completed wallet cycles, and `V5_RECOVERY_EVIDENCE.md` for the bounded Neon recovery test. None of these is proof of production activation.

Development harness: `gltest` deletes its configured output directory at startup. Its output is isolated to `work/gltest-artifacts`; keep environments and release evidence elsewhere. The first Windows consensus attempt used the old broad `artifacts` setting and partially removed the disposable test environment before a locked module stopped cleanup. Tracked source and evidence were unchanged. The replacement environment lives at `work/milestone-venv`.

Known consensus blocker: GLSim 0.29.2's SDK transaction handler calls the VM without forwarding native transaction value. The exact 1,000-wei funding call therefore reverts with `Exact escrow amount required: 1000 wei`. Do not alter the contract to make this pass. The ordinary v5 simulator case covers acceptance and the unfunded-negotiation guard only. The separate full payable case is explicitly skipped unless `RUN_GENLAYER_V5_PAYABLE_INTEGRATION=1` on a value-capable local GenLayer node. Passing the simulator smoke case does not satisfy the payable lifecycle release gate.
