# Human two-wallet v4 E2E — 2026-09-06

Result: the v4 human two-wallet critical path passed, including the expected semantic verdict and actual payout delivery. The agreement resolved with `full` performance and `PARTY_B_FULL_PERFORMANCE`: Wallet B withdrew and received exactly `980 wei`; Wallet A received `0 wei`; the fee recipient retains `20 wei` of contract credit. Eleven contract transactions finalized successfully, and the separate native-transfer child finalized with `value_credited=true`. One earlier canceled resolution request is preserved below. This is not a blanket submission-ready or defect-free claim: the refresh, capture-restoration, login-message, and historical-recovery UX findings remain open.

## Environment and exact agreement inputs

- Public UI: `https://dispute-court-studionet.vercel.app/`, Chrome with MetaMask.
- Source commit: `113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7`.
- Vercel deployment: `dpl_7N13dJcw3pogiZ5xsT254tFRf2Lp`.
- Network: GenLayer Studionet, chain ID `61999`, RPC `https://studio.genlayer.com/api`.
- Core v4: `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5`.
- EvidenceCaptureV4: `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`.
- Wallet A / funder: `0xAb99c741494bEF91FAE66144dda31Be93180baD4`.
- Wallet B / performer: `0xE6E7bfFA242d2900fad7067012564d441F735c43`.
- Agreement ID: `human-wallet-v4-20260906-01`.
- Title: `V4 human-wallet performance payout test`.
- Escrow: `1000 wei` (`0.000000000000001 GEN`); create value: `0 wei`; fee: `200 bps`.
- Windows: acceptance `259200`, funding `259200`, performance `1209600`, response `259200`, evidence `259200` seconds.

Summary:

```text
Party B delivers a publicly accessible technical note documenting Dispute Court v4 at https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md. This is a Studionet test agreement using test GEN only. Party A funds; Party B performs and receives the performance-based payment.
```

Party B performance criteria:

```text
Evaluate the contents of the agreed immutable technical note against four equally weighted checks: (1) it defines Party A as funder/refund side and Party B as performer/payment side; (2) it lists all five performance levels none, limited, partial, substantial, full with Party B shares 0%, 25%, 50%, 75%, 100%; (3) it states that the contract, not the model, derives the payout percentages and reason code; (4) it identifies both v4 deployed contract addresses and their source SHA-256 hashes. Count only checks supported by the verified public exhibit. Four checks = full; three = substantial; two = partial; one = limited; zero = none. Full performance pays Party B 100% of net escrow and Party A 0%; all other levels follow the fixed contract mapping. No external linked page needs to be followed to judge this documentation-delivery task.
```

## Finalized transaction trail

All transaction timestamps below come from the stored Studionet receipt, not the local clock.

| Action | Sender | Value (wei) | Created Unix | Finalized Unix | Execution | Hash |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Create | A | 0 | 1788679102 | 1788679136.1154253 | success | `0x0e497a389a44cd39f5f56f3d436d9e9a7100c7002635c800503a4d5c43eddcbc` |
| Accept | B | 0 | 1788680120 | 1788680153.7520082 | success | `0x5048af0ab15a97295b1a04f81ceec0ae34e93b5dc3b11cd04773b57824be4011` |
| Fund | A | 1000 | 1788680664 | 1788680697.3666055 | success | `0x389d89a8d29ae716a952ed57d84559799460730c1880296d9bb1814981e843ed` |
| Open dispute | A | 0 | 1788680840 | 1788680874.0288627 | success | `0x67fecc16c95129c96328684958f2e0743ab515b65098190b53b3f50e66651b35` |
| Respond | B | 0 | 1788681394 | 1788681429.037992 | success | `0x83859580594a1d1a3f160985336eb34f0cac60032aada6fa465be4a292f90df3` |
| Capture public source | B | 0 | 1788681628 | 1788681664.117432 | success | `0xcfd5f3b73b03efffb52afea96ade53cce043b823937ca81a2227cfacdcf72a50` |
| Submit evidence | B | 0 | 1788682074 | 1788682108.1247575 | success | `0x423198ec984ee8a0f6cc62dd3459ed64359867d08f78ebc762bb0f2cff8cb7d7` |
| Mark evidence ready | B | 0 | 1788682261 | 1788682295.070359 | success | `0xe15d9c74865fc9001b043fc39ff0c59456ba16b4191e7d329bf8164c82ee3268` |
| Mark evidence ready | A | 0 | 1788682648 | 1788682682.0146854 | success | `0xef1cd0f3bc59483a5386ac7090012f1c27f2527944e4664e75695e268ca4387a` |
| Resolve (one fresh retry after canceled request) | A | 0 | 1788683371 | 1788683418.7534502 | success | `0xeb31b1e2ca0e9a41a18b5e21ac3b5974b99d0c6ff1b4368a55fa753c933dc106` |
| Withdraw credit | B | 0 | 1788683878 | 1788683912.1066222 | success | `0x5e07397308a2df20c52d89d414b8e50ee004dd292b856ad2d4fd3031d4148ef6` |
| Native payout child | v4 core | 980 | 1788683912 | not exposed; status FINALIZED | native value credited | `0x7387a20e8a8c33eb907fb8b95d41d152bf957b6f08a6a335b8831af7047324cc` |

The receipt's `created_at` is `2026-09-06T07:18:22.981693+00:00`. Sender and recipient match Wallet A and the v4 core; value is zero; leader execution is `SUCCESS` with empty stderr; all five validator votes are `agree`. The public app independently loaded the finalized agreement in `awaiting_acceptance` state.

Exact decoded create output:

```json
{
  "acceptance_deadline": 1788938302,
  "amount_wei": "1000",
  "fee_bps": 200,
  "funding_deadline": 0,
  "id": "human-wallet-v4-20260906-01",
  "party_a": "0xAb99c741494bEF91FAE66144dda31Be93180baD4",
  "party_b": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
  "performance_due_at": 0,
  "status": "awaiting_acceptance",
  "terms_hash": "e262edd3f8a58ba45b4bb59958e80167d7f3bf0217e0b381b96bfece93d16257",
  "title": "V4 human-wallet performance payout test"
}
```

The acceptance receipt's `created_at` is `2026-09-06T07:35:20.140412+00:00`. Its sender is Wallet B, recipient is the v4 core, attached value is zero, status is `FINALIZED`, and leader execution is `SUCCESS` with empty stderr. Reported votes are three `agree` and two `idle`; do not describe this receipt as unanimous. Both the app's Activity journal and a separate `LATEST_FINAL` contract read confirmed the acceptance. The immutable terms hash is unchanged; the stored funding deadline is exactly the accepted chain Unix timestamp plus `259200` seconds.

Exact decoded acceptance input and output:

```json
{
  "input": {
    "args": ["human-wallet-v4-20260906-01"],
    "method": "accept_agreement"
  },
  "output": {
    "acceptance_deadline": 1788938302,
    "amount_wei": "1000",
    "fee_bps": 200,
    "funding_deadline": 1788939320,
    "id": "human-wallet-v4-20260906-01",
    "party_a": "0xAb99c741494bEF91FAE66144dda31Be93180baD4",
    "party_b": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
    "performance_due_at": 0,
    "status": "awaiting_funding",
    "terms_hash": "e262edd3f8a58ba45b4bb59958e80167d7f3bf0217e0b381b96bfece93d16257",
    "title": "V4 human-wallet performance payout test"
  }
}
```

The funding receipt's `created_at` is `2026-09-06T07:44:24.358143+00:00`. Its sender is Wallet A, recipient is the v4 core, and attached value is exactly `1000 wei`. Status is `FINALIZED`; leader execution is `SUCCESS` with empty stderr; reported votes are three `agree` and two `idle`. Both the live UI and a separate `LATEST_FINAL` read show `funded`. The stored performance deadline is `1789890264`, exactly the funding transaction's chain Unix timestamp plus the agreed `1209600` seconds. Terms are unchanged.

Exact decoded funding input and output:

```json
{
  "input": {
    "args": ["human-wallet-v4-20260906-01"],
    "method": "fund_agreement"
  },
  "output": {
    "acceptance_deadline": 1788938302,
    "amount_wei": "1000",
    "fee_bps": 200,
    "funding_deadline": 1788939320,
    "id": "human-wallet-v4-20260906-01",
    "party_a": "0xAb99c741494bEF91FAE66144dda31Be93180baD4",
    "party_b": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
    "performance_due_at": 1789890264,
    "status": "funded",
    "terms_hash": "e262edd3f8a58ba45b4bb59958e80167d7f3bf0217e0b381b96bfece93d16257",
    "title": "V4 human-wallet performance payout test"
  }
}
```

## Opening claim and response deadline

The following exact text was submitted by Wallet A as the second argument of `open_dispute`; the first argument is `human-wallet-v4-20260906-01`. Its zero-value transaction finalized successfully.

```text
Party A requests a formal Studionet test evaluation of Party B's delivery of the agreed immutable v4 technical note. Determine how many of the four documentation checks are supported by the verified public exhibit and apply the agreed performance-level mapping. This is a test, not an allegation of misconduct.
```

The receipt's `created_at` is `2026-09-06T07:47:20.270419+00:00`. Sender and recipient are Wallet A and the v4 core; value is `0`; execution is `SUCCESS` with empty stderr; all five votes are `agree`. One read-only receipt check received transient HTTP `502`; retrying the receipt read succeeded without repeating the transaction. The live app also reported successful finalization and `awaiting_response`.

Exact decoded opening-dispute output:

```json
{
  "agreement_id": "human-wallet-v4-20260906-01",
  "opener": "0xAb99c741494bEF91FAE66144dda31Be93180baD4",
  "resolution_deadline": 1789890440,
  "responder": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
  "response_deadline": 1788940040,
  "status": "awaiting_response"
}
```

Verified directly against the stored transaction timestamp: `1788940040 = 1788680840 + 259200`; `1789890440 = 1788940040 + 3 × 259200 + 172800`. The response must finalize before `2026-09-09T07:47:20Z`. These deadlines use stored chain time, not the local clock.

The following exact response was submitted by Wallet B as the second argument of `respond_to_dispute`; the first argument is `human-wallet-v4-20260906-01`:

```text
Party B confirms the agreed immutable technical note satisfies all four documentation checks. It defines Party A and Party B roles, lists all five performance levels and percentages, states deterministic contract-derived payouts and reason codes, and identifies both v4 contract addresses and source SHA-256 hashes. The agreed immutable URL will be captured and submitted as evidence.
```

The response receipt's `created_at` is `2026-09-06T07:56:34.187233+00:00`. Its sender is Wallet B, recipient is the v4 core, attached value is `0 wei`, status is `FINALIZED`, and leader execution is successful with empty stderr and no error code. All five votes are `agree`. The exact decoded method and both arguments match the response above. The app's Activity journal independently reported successful finalization, and a separate `LATEST_FINAL` read returned the exact response, `status=evidence`, no exhibits, and unchanged absolute resolution deadline `1789890440`.

Exact decoded response output:

```json
{
  "agreement_id": "human-wallet-v4-20260906-01",
  "evidence_deadline": 1788940594,
  "status": "evidence"
}
```

Verified from stored chain time: `1788940594 = 1788681394 + 259200`. The evidence deadline is `2026-09-09T07:56:34Z`. This response was recorded before the stored response deadline `1788940040`; no local-clock assumption was used to prove eligibility.

## Evidence preflight

Before preparing funding, a fresh `LATEST_FINAL` read confirmed `awaiting_funding`, unchanged terms hash `e262edd3f8a58ba45b4bb59958e80167d7f3bf0217e0b381b96bfece93d16257`, exact escrow `1000 wei`, empty `funded_at`, and stored funding deadline `1788939320`. A read-only Studionet `eth_getBalance` call returned Wallet A's balance as `999999999999999980 wei`, sufficient for the exact test escrow. This balance read is a preflight observation, not proof that funding has occurred.

- Immutable public source: `https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md`.
- Anonymous HTTP `200`, checked at `2026-09-06T07:17:46.998Z` with empty Cookie and Authorization headers.
- Whitespace-normalized UTF-8 bytes: `4156`; SHA-256: `a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7`.
- The normalized public body exactly matched the checked-out immutable technical note and is below the helper's 6,000-byte limit.
- This HTTP preflight is distinct from the subsequently finalized on-chain capture below. Evidence commitment is not yet claimed.

## Finalized public evidence capture

Wallet B manually approved the helper's zero-value `capture` request. The receipt's stored `created_at` is `2026-09-06T08:00:28.234811+00:00`; sender is Wallet B; recipient is the v4 helper; value is `0 wei`; status is `FINALIZED`; execution is successful with empty stderr and no error code. Votes are three `agree` and two `idle`, not unanimous. The public UI also reported successful finalization.

The captured text is exactly the complete immutable technical note after the repository's `python-re-whitespace-v1` normalization. Recomputing its UTF-8 length and SHA-256 returned `4156` and `a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7`; it is within the `6000`-byte source limit. This verifies source identity, not the future model verdict. All four documentation checks are present in the captured text.

Exact decoded capture input and output:

```json
{
  "input": {
    "args": [
      "https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md",
      "d8dd34c2-46b7-42b1-a868-516ae883a1d9"
    ],
    "method": "capture"
  },
  "output": {
    "account": "0xe6e7bffa242d2900fad7067012564d441f735c43",
    "byte_length": 4156,
    "captured_at": 1788681628,
    "digest": "a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7",
    "id": "0xe6e7bffa242d2900fad7067012564d441f735c43:d8dd34c2-46b7-42b1-a868-516ae883a1d9",
    "normalization": "python-re-whitespace-v1",
    "product_contract": "0xc49ed63ddc1685850aaf5d5e85986c1bcedbe8b5",
    "request_id": "d8dd34c2-46b7-42b1-a868-516ae883a1d9",
    "text": "# Dispute Court v4 decision boundary v4 is a new immutable core release. The deployed v3 core and helper, their source files, manifests, transaction history, and database namespace remain available as historical evidence and recovery records. ## Authority boundary - The frontend and backend own wallet authentication, drafts, explicit transaction review, discovery, local reminders, recovery journals, and non-authoritative display copy. - The GenLayer core owns immutable party roles, payout semantics, deadlines, evidence verification, validator agreement, settlement, credits, and payout emission. - The evidence helper owns a wallet-scoped, immutable snapshot of one complete public source. It is not a judge and never holds funds. - Public source pages supply untrusted facts. Every adjudicating validator re-fetches and normalizes them before comparing their digest with the committed digest. ## Fixed role and payout semantics Party A is always the funder and refund side. Party B is always the performer and payment side. User-written criteria describe what counts as performance; they cannot redefine which party a performance level pays. The model never chooses a directional payout percentage. It returns one named performance level: | Performance level | Party B share of net escrow | Party A share | Contract reason code | | --- | ---: | ---: | --- | | `full` | 100% | 0% | `PARTY_B_FULL_PERFORMANCE` | | `substantial` | 75% | 25% | `PARTY_B_SUBSTANTIAL_PERFORMANCE` | | `partial` | 50% | 50% | `PARTY_B_PARTIAL_PERFORMANCE` | | `limited` | 25% | 75% | `PARTY_B_LIMITED_PERFORMANCE` | | `none` | 0% | 100% | `PARTY_B_NO_PERFORMANCE` | The contract derives both monetary shares and the reason code from this enum. A full-performance finding therefore cannot accidentally become a 100% Party A award through percentage-direction ambiguity. `needs_evidence` remains a non-settling result with reason code `INSUFFICIENT_VERIFIED_EVIDENCE`. Cooperative, no-show, bounded-retry, and absolute-timeout paths remain deterministic and keep their existing fee rules. ## Consensus rule The leader and validators independently fetch all sources, quarantine invalid exhibits, and independently ask for the Party B performance level. They compare the outcome, performance level, cited verified evidence IDs, source-observation list, and digest bundle. Leader prose remains non-authoritative and is not used to compute money. The stored attempt and verdict expose the authoritative performance level, derived Party B performance percentage, derived Party A allocation percentage, evidence references, and deterministic reason code. The UI leads with those authoritative fields and labels the free-form explanation separately. ## User experience rule Draft review and acceptance must state the fixed direction in plain language: full verified performance pays Party B; no verified performance pays Party A; intermediate levels use the displayed fixed buckets. The criteria field is labeled as performance criteria. Resolution screens must show the performance finding beside the resulting allocation so a contradiction is visible rather than buried. Evidence capture is explicitly labeled as an on-chain, zero-value transaction. A failed receipt displays the decoded contract reason when available. A proof cannot be committed until a capture is loaded, verified, and reviewed. Invitation links always use the canonical public evaluator origin. ## Release boundary v4 retains the pinned `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` runner and the 6,000-byte complete-source policy. The deployed core is `0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5`; its source SHA-256 is `be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9`. Its helper is `0x4E13Da8eF88E75Eb1a6c2A1BB4180b69f78a916f`; its source SHA-256 is `3999f1289f5574a80069e53ea28a2b947681fdb09821a2f06caf1c8e7b24e260`. Both finalized with successful execution and match the checked-in source byte for byte. The app uses a new core-address-derived database namespace and fails closed on any non-v4 configuration. No v3 agreement, balance, or private row is reassigned.",
    "url": "https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md",
    "warning": "A capture is not a verdict. The product re-fetches this URL; changed content will not match."
  }
}
```

A separate `LATEST_FINAL` call to `get_capture` returned the same request ID, product core, account, URL, digest, byte length, and stored capture timestamp. A separate finalized agreement read still showed zero exhibits, both ready flags false, `status=evidence`, and evidence deadline `1788940594`. A finalized helper capture does not itself commit an exhibit to the agreement.

After the app's post-transaction refresh, the capture form was empty even though the transaction had finalized. The existing snapshot was loaded through the visible recovery control using request ID `d8dd34c2-46b7-42b1-a868-516ae883a1d9`; no second capture was sent. Automatic restoration after finality is a follow-up UX finding.

An initial commitment click timed out during another form reset. Activity still showed exactly the three completed Wallet B requests (accept, respond, capture), with no submission request. After restoring the same capture, reviewing its verified text, and filling the note below, the app displayed `Submit evidence: request saved. Review the wallet confirmation. Never repeat a pending request.` That notice alone was not treated as success. The resulting transaction's successful finalization is independently verified below; no duplicate submission was sent.

Exact decoded `submit_evidence` arguments, in order:

```json
[
  "human-wallet-v4-20260906-01",
  "Immutable v4 technical note supporting the four agreed documentation checks.",
  "https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md",
  "a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7"
]
```

## Finalized evidence commitment

The `submit_evidence` receipt's stored `created_at` is `2026-09-06T08:07:54.667699+00:00`. Sender is Wallet B; recipient is the v4 core; attached value is `0 wei`; status is `FINALIZED`; execution is successful with empty stderr and no error code. Votes are three `agree` and two `idle`. The decoded method and all four arguments match the exact values above.

Exact decoded output:

```json
{
  "expected_digest": "a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7",
  "id": "evidence-001",
  "note": "Immutable v4 technical note supporting the four agreed documentation checks.",
  "party": "party_b",
  "submitted_at": "2026-09-06T08:07:54.667699+00:00",
  "submitted_by": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
  "url": "https://raw.githubusercontent.com/sanity456/dispute-court/113a27b732f6ebd46db4f4d9ad9d760a23d1d3b7/ARCHITECTURE_V4.md"
}
```

The submitted timestamp matches the stored transaction timestamp, and `1788682074 < 1788940594` verifies submission before the evidence deadline using chain time. A separate `LATEST_FINAL` read returned exactly this one exhibit, `status=evidence`, and both ready flags false. The public case workspace showed `evidence-001`; Activity showed exactly four completed Wallet B requests, including this successful evidence submission. The commitment is final, but adjudication has not yet re-fetched and evaluated the exhibit.

## Wallet B readiness finalized

Wallet B manually approved `mark_ready`. The receipt's stored `created_at` is `2026-09-06T08:11:01.580390+00:00`; sender is Wallet B; recipient is the v4 core; value is `0 wei`; status is `FINALIZED`; execution is successful with empty stderr and no error code. Votes are three `agree` and two `idle`.

Exact decoded input and output:

```json
{
  "input": {
    "args": ["human-wallet-v4-20260906-01"],
    "method": "mark_ready"
  },
  "output": {
    "agreement_id": "human-wallet-v4-20260906-01",
    "party_a_ready": false,
    "party_b_ready": true,
    "status": "evidence"
  }
}
```

The stored timestamp satisfies `1788682261 < 1788940594`, before the evidence deadline. An initial finalized-state read, while the app still reported the transaction as accepted, returned both flags false. After successful finalization, a separate `LATEST_FINAL` read and the public UI both showed Party B ready and Party A not ready. The one committed exhibit and its digest remained unchanged; the agreement stayed in `evidence`, with evidence deadline `1788940594` and absolute resolution deadline `1789890440`. Wallet B's readiness alone neither closes evidence nor resolves the agreement.

## Wallet A readiness finalized; evidence closed early

After switching back to Wallet A and manually approving its fresh login signature, the public app showed Wallet A signed in with the funder role. A separate finalized contract read showed Party B ready, Party A not ready, and the same one committed exhibit. Wallet A then manually approved its zero-value `mark_ready` transaction.

The receipt's stored `created_at` is `2026-09-06T08:17:28.708528+00:00`; sender is Wallet A; recipient is the v4 core; status is `FINALIZED`; execution is successful with empty stderr and no error code. Votes are four `agree` and one `idle`, not unanimous.

Exact decoded input and output:

```json
{
  "input": {
    "args": ["human-wallet-v4-20260906-01"],
    "method": "mark_ready"
  },
  "output": {
    "agreement_id": "human-wallet-v4-20260906-01",
    "party_a_ready": true,
    "party_b_ready": true,
    "status": "ready_for_resolution"
  }
}
```

The stored timestamp satisfies `1788682648 < 1788940594`: evidence closed through both ready flags, not through a local-clock deadline assumption. A separate `LATEST_FINAL` read confirmed both flags true, `ready_for_resolution`, and unchanged `evidence-001`, evidence deadline `1788940594`, and absolute resolution deadline `1789890440`. The public UI independently reported successful readiness finalization and displayed `Request consensus resolution`. No verdict or payout has occurred at this checkpoint.

## First resolution request canceled without settlement

Wallet A manually approved the zero-value `resolve` request. Its hash is `0x21a90ee9dbc6e6d79bd6f67051dee5bf77098de92e0eff603f3151770dc43612`; stored `created_timestamp` is `1788682843`; stored `created_at` is `2026-09-06T08:20:43.078864+00:00`. A read-only receipt check verified Wallet A as sender, the v4 core as recipient, zero attached value, and exact decoded input `{"args":["human-wallet-v4-20260906-01"],"method":"resolve"}`. The request was initially `PROPOSING`, with execution unknown and no output. It was not repeated while pending.

The terminal receipt subsequently reported:

```json
{
  "hash": "0x21a90ee9dbc6e6d79bd6f67051dee5bf77098de92e0eff603f3151770dc43612",
  "status": "CANCELED",
  "execution": "unknown",
  "consensus_error": "max_recovery_cycles_exceeded",
  "recovery_count": 3,
  "max_recovery_exhausted_at": 1788682997,
  "num_of_rounds": "0",
  "result_name": "NO_MAJORITY",
  "triggered_transactions": [],
  "value_wei": 0
}
```

`max_recovery_exhausted_at` is the stored network Unix timestamp `2026-09-06T08:23:17Z`, `154` seconds after the stored request timestamp. There was no leader receipt or decoded contract output. `NO_MAJORITY` and `max_recovery_cycles_exceeded` are network receipt metadata, not a performance finding or contract reason code. The receipt alone does not establish the underlying recovery failure's cause.

Before preparing any retry, read-only checks confirmed all of the following:

- The existing hash remained terminal `CANCELED`, and Activity labeled it `Cancelled by the network`.
- `LATEST_FINAL` agreement state remained `ready_for_resolution`, with both ready flags true, the unchanged terms hash and one exhibit, `resolution_attempt_count=0`, `verdict={}`, and `resolved_at=""`.
- All four `paid` fields were `"0"`; Party A, Party B, and the fee recipient each had `credit_wei="0"`.
- Contract stats showed `agreements_resolved=0`, `payouts_emitted=0`, `fees_accrued_wei="0"`, and `value_resolved_wei="0"`.
- An independent `eth_getBalance` returned the v4 core's native balance as exactly `1000 wei`; no escrow value was withdrawn or lost.

This canceled request is preserved as a failed network attempt, not included among the successful finalized transactions. Only after these checks was one fresh zero-value retry prepared with the same `resolve` method and agreement ID. Its actual successful finalization is verified separately below; no cooperative settlement was substituted.

## Resolution retry finalized with the expected verdict

Wallet A manually approved the fresh retry, hash `0xeb31b1e2ca0e9a41a18b5e21ac3b5974b99d0c6ff1b4368a55fa753c933dc106`. The stored `created_at` is `2026-09-06T08:29:31.847907+00:00`; sender is Wallet A; recipient is the v4 core; attached value is `0 wei`; status is `FINALIZED`; execution is successful with result-status byte `0`, empty stderr, and no error code. Votes are three `agree` and two `idle`, not unanimous. The stored request timestamp satisfies `1788683371 < 1789890440`, before the absolute resolution deadline.

Exact decoded input and output:

```json
{
  "input": {
    "args": ["human-wallet-v4-20260906-01"],
    "method": "resolve"
  },
  "output": {
    "agreement_id": "human-wallet-v4-20260906-01",
    "paid": {
      "conservation_wei": "1000",
      "fee_wei": "20",
      "party_a_wei": "0",
      "party_b_wei": "980"
    },
    "status": "resolved",
    "verdict": {
      "evidence_refs": ["evidence-001"],
      "party_a_pct": 0,
      "party_b_pct": 100,
      "party_b_performance_pct": 100,
      "performance_level": "full",
      "reason_code": "PARTY_B_FULL_PERFORMANCE",
      "reasoning": "The technical note in evidence-001 satisfies all four criteria: (1) Defines Party A as funder/refund and Party B as performer/payment; (2) Lists all five performance levels (none to full) with the specific 0% to 100% Party B share mapping; (3) States that the contract derives the payout percentages and reason codes from the performance level; (4) Identifies two v4 contract addresses (0xC49... and 0x4E1...) along with their respective source SHA-256 hashes.",
      "reasoning_provenance": "leader_output_non_authoritative",
      "resolution_type": "ai_adjudication"
    }
  }
}
```

Independent `LATEST_FINAL` reads of the agreement and resolution attempt confirmed the same verdict, paid fields, stored resolution timestamp, and one successful contract resolution attempt with no evidence reopen. The canceled network request did not increment this contract counter. Exact saved resolution attempt:

```json
{
  "attempt": 1,
  "evidence_refs": ["evidence-001"],
  "id": "human-wallet-v4-20260906-01:resolution:1",
  "outcome": "decision",
  "party_a_pct": 0,
  "party_b_pct": 100,
  "party_b_performance_pct": 100,
  "performance_level": "full",
  "reason_code": "PARTY_B_FULL_PERFORMANCE",
  "reasoning": "The technical note in evidence-001 satisfies all four criteria: (1) Defines Party A as funder/refund and Party B as performer/payment; (2) Lists all five performance levels (none to full) with the specific 0% to 100% Party B share mapping; (3) States that the contract derives the payout percentages and reason codes from the performance level; (4) Identifies two v4 contract addresses (0xC49... and 0x4E1...) along with their respective source SHA-256 hashes.",
  "reasoning_provenance": "leader_output_non_authoritative",
  "resolved_at": "2026-09-06T08:29:31.847907+00:00",
  "source_digest_bundle": "68945a26dd0a2a9b218f50a01f24bf0ef3e1bb606ec2d8b51d9b35e5ddbda777",
  "source_observations": [
    {
      "digest": "a975f4a13230baa1fa581a453e7fbfaa3b1c86985bfae6520cdb2cb6129abee7",
      "id": "evidence-001",
      "status": "verified"
    }
  ]
}
```

The source observation's digest matches the committed digest and helper capture. Its bundle is the SHA-256 of the compact, sorted-key JSON observation list, independently recomputed. The agreed documentation checks are reflected in the leader explanation; the monetary result uses the authoritative performance enum and contract-derived percentages and reason code, not that prose.

Separate `get_credit` reads returned Party A `"0"`, Party B `"980"`, and the fee recipient `"20"`. Stats returned `agreements_resolved=1`, `value_resolved_wei="1000"`, `fees_accrued_wei="20"`, and `payouts_emitted=0`. The public UI independently showed `resolved`, performance `full`, reason code `PARTY_B_FULL_PERFORMANCE`, Party B allocation `0.00000000000000098 GEN`, and fee `0.00000000000000002 GEN`; Wallet A's withdrawal control remained disabled because A has no credit.

## Verdict and withdrawal delivery verified

The real live adjudication returned the expected `performance_level=full`, `party_b_performance_pct=100`, `party_a_pct=0`, `party_b_pct=100`, and `reason_code=PARTY_B_FULL_PERFORMANCE`. Verified allocation is Party B `980 wei`, Party A `0 wei`, fee `20 wei`, total `1000 wei`. This is an observed live result, not a mocked result or a claim that the full product is submission-ready.

After resolution and before withdrawal, independent native balance reads returned the core's balance as `1000 wei` and Wallet B's native balance as `0 wei`. These distinguish allocated contract credit from delivered funds. No withdrawal had been emitted (`payouts_emitted=0`).

After switching to Wallet B, the user manually approved a fresh login signature. The public UI showed Wallet B signed in, with `0.00000000000000098 GEN` withdrawable credit. Before opening withdrawal, separate finalized contract reads verified the exact `980 wei` credit, the successful full-performance verdict, and `payouts_emitted=0`. Wallet B then manually approved the withdrawal.

The withdrawal parent `0x5e07397308a2df20c52d89d414b8e50ee004dd292b856ad2d4fd3031d4148ef6` finalized with successful GenVM execution, result-status byte `0`, empty stderr, and no error code. Sender is Wallet B; recipient is the v4 core; attached value is `0 wei`; all five votes are `agree`. Stored `created_at` is `2026-09-06T08:37:58.531375+00:00`; stored finalized Unix time is `1788683912.1066222`.

Exact decoded input and output (the zero-argument call omits the optional `args` key):

```json
{
  "input": {"method": "withdraw"},
  "output": {
    "amount_wei": "980",
    "delivery_note": "Emission is not confirmation; verify the finalized child transaction.",
    "emitted_at": "2026-09-06T08:37:58.531375+00:00",
    "id": "payout-00000001",
    "recipient": "0xe6e7bffa242d2900fad7067012564d441f735c43",
    "status": "emitted_for_finalization"
  }
}
```

The parent listed exactly one triggered transaction. A separate read of that child verified the following delivery fields:

```json
{
  "hash": "0x7387a20e8a8c33eb907fb8b95d41d152bf957b6f08a6a335b8831af7047324cc",
  "status": "FINALIZED",
  "type": 0,
  "sender": "0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5",
  "recipient": "0xE6E7bfFA242d2900fad7067012564d441F735c43",
  "value_wei": "980",
  "value_credited": true,
  "triggered_by": "0x5e07397308a2df20c52d89d414b8e50ee004dd292b856ad2d4fd3031d4148ef6",
  "triggered_on": "finalized",
  "triggered_transactions": [],
  "created_timestamp": "1788683912",
  "created_at": "2026-09-06T08:38:32.119545+00:00"
}
```

The native child has no GenVM leader receipt or separate stored finalized timestamp exposed by this RPC. Its generic `result_name` is `NO_MAJORITY`, and the contract-execution helper returns `unknown`; neither is relabeled as GenVM execution success. Delivery is instead established by the native-specific checks: type `0`, finalized status, `value_credited=true`, exact core sender, Wallet B recipient and `980 wei`, explicit parent linkage, and independently verified balance movement. This is the same delivery distinction enforced by `frontend/lib/payout.ts` and the Activity journal.

Independent post-withdrawal reads confirmed:

```json
{
  "core_native_balance_wei": "20",
  "wallet_b_native_balance_wei": "980",
  "wallet_b_contract_credit_wei": "0",
  "fee_recipient_contract_credit_wei": "20",
  "payouts_emitted": 1,
  "agreements_resolved": 1,
  "fees_accrued_wei": "20",
  "value_resolved_wei": "1000"
}
```

Thus Wallet B's native balance moved from `0` to `980 wei`, the core's balance from `1000` to `20 wei`, and B's contract credit from `980` to `0 wei`. `get_payout("payout-00000001")` returned the exact parent output above; that immutable emission record remains `emitted_for_finalization` and is not misrepresented as independent delivery proof. The public Activity page separately displayed `Payout delivered`, `Credited & finalized`, the exact recipient/amount, and both parent and child hashes. No fee withdrawal or second payout was initiated.

## Authentication observations

An earlier login challenge was requested at `2026-09-06T07:03:57.049Z`; signature verification reached the server at `2026-09-06T07:13:28.457Z` and returned HTTP `401`. This exceeded the five-minute challenge lifetime. Its error message did not remain visible after the signed-out session refresh.

A fresh challenge at `2026-09-06T07:15:49.489Z` was followed by verification at `2026-09-06T07:16:04.978Z`. The public UI then displayed `Signed in · 0xab99…bad4`, loaded zero v4 contract credit, and enabled the agreement builder. These are server-request timestamps and UI observations, not chain timestamps.

Switching to Wallet B correctly cleared Wallet A's UI/session and displayed `Wallet or network changed. Sign in again to continue.` Wallet B's challenge at `2026-09-06T07:22:03.999Z` and verify at `2026-09-06T07:22:09.605Z` both returned HTTP `200`. The app then displayed `Signed in · 0xe6e7…5c43`, the exact named Party B address, zero v4 credit, and the counterparty-only acceptance control. Wallet B's current v4 Activity was empty before attempting to open its acceptance request. Initial browser-control clicks did not complete; the later same-focus retry produced the verified acceptance recorded above.

## Follow-up UX findings

Wallet B also received an emergency-outbox warning. Its recovery request for saved intent `7515161e-8f46-4350-8d86-1e45feb7c102` returned HTTP `404` from the v4 journal at `2026-09-06T07:22:10.929Z`. No hash was resent on-chain or deleted. Code inspection confirms that the local outbox key scopes by product and wallet but not by deployed core, whereas the server journal now scopes by v4 core. The warning must distinguish unresolved historical entries from current-deployment requests and provide a safe visible recovery path; do not silently migrate or discard old entries. The live agreement was still awaiting acceptance and Wallet B had no current v4 saved requests before the new acceptance operation, so this was not treated as an already-submitted v4 acceptance.

The acceptance review checkbox was observed checked, then reset to unchecked during the next browser-control click. Both acceptance-click attempts timed out; subsequent DOM reads showed an idle app, unchecked review, and disabled acceptance button, not a submitted transaction. `ProductHome.tsx` currently clears review confirmations whenever `protocol.revision` changes, and the session hook increments that revision on page focus. Preserve the reviewed identity only when the wallet, immutable terms and applicable action state remain unchanged; do not bypass review or suppress wallet/network validation. A manual same-focus acceptance is the immediate human-test continuation.

After the user clarified that no agreement had actually been accepted and requested a resend, the same-focus browser interaction successfully checked the visible review control and clicked the enabled acceptance button. The app displayed `Accept agreement: request saved. Review the wallet confirmation. Never repeat a pending request.` Wallet B remained signed in; no review, identity, or contract checks were bypassed. The user manually approved the resulting request, and its successful finalized receipt is recorded above.
