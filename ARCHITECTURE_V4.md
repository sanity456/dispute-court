# Dispute Court v4 decision boundary

v4 is a new immutable core release. The deployed v3 core and helper, their source files, manifests, transaction history, and database namespace remain available as historical evidence and recovery records.

## Authority boundary

- The frontend and backend own wallet authentication, drafts, explicit transaction review, discovery, local reminders, recovery journals, and non-authoritative display copy.
- The GenLayer core owns immutable party roles, payout semantics, deadlines, evidence verification, validator agreement, settlement, credits, and payout emission.
- The evidence helper owns a wallet-scoped, immutable snapshot of one complete public source. It is not a judge and never holds funds.
- Public source pages supply untrusted facts. Every adjudicating validator re-fetches and normalizes them before comparing their digest with the committed digest.

## Fixed role and payout semantics

Party A is always the funder and refund side. Party B is always the performer and payment side. User-written criteria describe what counts as performance; they cannot redefine which party a performance level pays.

The model never chooses a directional payout percentage. It returns one named performance level:

| Performance level | Party B share of net escrow | Party A share | Contract reason code |
| --- | ---: | ---: | --- |
| `full` | 100% | 0% | `PARTY_B_FULL_PERFORMANCE` |
| `substantial` | 75% | 25% | `PARTY_B_SUBSTANTIAL_PERFORMANCE` |
| `partial` | 50% | 50% | `PARTY_B_PARTIAL_PERFORMANCE` |
| `limited` | 25% | 75% | `PARTY_B_LIMITED_PERFORMANCE` |
| `none` | 0% | 100% | `PARTY_B_NO_PERFORMANCE` |

The contract derives both monetary shares and the reason code from this enum. A full-performance finding therefore cannot accidentally become a 100% Party A award through percentage-direction ambiguity.

`needs_evidence` remains a non-settling result with reason code `INSUFFICIENT_VERIFIED_EVIDENCE`. Cooperative, no-show, bounded-retry, and absolute-timeout paths remain deterministic and keep their existing fee rules.

## Consensus rule

The leader and validators independently fetch all sources, quarantine invalid exhibits, and independently ask for the Party B performance level. They compare the outcome, performance level, cited verified evidence IDs, source-observation list, and digest bundle. Leader prose remains non-authoritative and is not used to compute money.

The stored attempt and verdict expose the authoritative performance level, derived Party B performance percentage, derived Party A allocation percentage, evidence references, and deterministic reason code. The UI leads with those authoritative fields and labels the free-form explanation separately.

## User experience rule

Draft review and acceptance must state the fixed direction in plain language: full verified performance pays Party B; no verified performance pays Party A; intermediate levels use the displayed fixed buckets. The criteria field is labeled as performance criteria. Resolution screens must show the performance finding beside the resulting allocation so a contradiction is visible rather than buried.

Evidence capture is explicitly labeled as an on-chain, zero-value transaction. A failed receipt displays the decoded contract reason when available. A proof cannot be committed until a capture is loaded, verified, and reviewed. Invitation links always use the canonical public evaluator origin.

## Release boundary

v4 retains the pinned `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` runner and the 6,000-byte complete-source policy. The deployed core is `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5`; its source SHA-256 is `be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9`. Its helper is `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`; its source SHA-256 is `3999f1289f5574a80069e53ea28a2b947681fdb09821a2f06caf1c8e7b24e260`. Both finalized with successful execution and match the checked-in source byte for byte. The app uses a new core-address-derived database namespace and fails closed on any non-v4 configuration. No v3 agreement, balance, or private row is reassigned.
