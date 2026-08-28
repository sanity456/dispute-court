# Dispute Court v2 Architecture

## Product boundary

Dispute Court is a bilateral escrow-resolution product. A case cannot be created against an arbitrary address. It must originate from an agreement that both parties accepted before the escrow was funded.

- **Frontend/indexer owns:** agreement drafting, notifications, party-scoped case lists, evidence preparation, human-readable GEN amounts, appeal/finality UX, and delivery monitoring.
- **Contract owns:** immutable accepted terms, fee snapshot, escrow, evidence procedure, deterministic no-show rules, consensus ruling buckets, settlement credits, and audit records.
- **External evidence owns:** raw public artifacts. Material URL evidence carries a normalized content digest that validators independently verify.

## Agreement flow

`awaiting_acceptance -> awaiting_funding -> funded -> resolved (cooperative release/refund)`

or, when disputed:

`funded -> awaiting_response -> evidence -> ready_for_resolution -> resolved`

If evidence remains unavailable or unverifiable after two reopened evidence windows:

`ready_for_resolution -> resolution_stalled -> resolved (accepted 50/50 fallback)`

If a respondent ignores a dispute after signing the underlying agreement, the no-show result is deterministic: the responding opener receives the distributable escrow. AI does not invent procedure.

## Actors

- **Protocol owner:** schedules future fee changes; cannot alter accepted or funded agreements.
- **Party A:** creates the agreement and funds the escrow after Party B accepts.
- **Party B:** accepts the exact terms and may receive a cooperative release.
- **Case opener/respondent:** either party may open; the other receives a response window.
- **Keeper:** any address may close an expired evidence phase, execute a deterministic no-show, or resolve a closed case.

## Ruling model

Authoritative settlement percentages are canonical buckets: `0`, `25`, `50`, `75`, or `100` percent to Party A. Validators must independently fetch evidence, reproduce the ruling, and agree exactly on the decision bucket and material evidence references.

`needs_evidence` performs no settlement and reopens a bounded evidence window. A source outage or digest mismatch cannot silently become a forced financial ruling.

## Safety invariants

1. Both parties accept one terms hash before escrow funding.
2. A funded agreement snapshots fee, fee recipient, windows, and no-show procedure.
3. One party cannot close evidence early; both must mark ready or wait for the deadline.
4. Every listed source is evaluated or the case remains unresolved.
5. `fee + party_a_credit + party_b_credit == escrow` for every final ruling.
6. A credit is created once and settlement is idempotent.
7. “Transfer emitted” is not represented as confirmed payment.
