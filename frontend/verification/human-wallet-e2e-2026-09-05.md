# Human two-wallet E2E — 2026-09-05

Result: transaction transport and payout delivery passed, but the release failed the semantic-correctness gate. Do not cite this v3 run as a clean submission pass.

## Environment and exact inputs

- UI: `https://dispute-court-studionet.vercel.app/`, Chrome with MetaMask
- Network: GenLayer Studionet, chain ID `61999`, canonical RPC `https://studio.genlayer.com/api`
- Core v3: `0x49CE252a7b8a085Ef9B859F82bD55Af1eC601BEe`
- EvidenceCaptureV3: `0x66cF318eb3C2276689BAe995b554104995485940`
- Wallet A / funder: `0xAb99c741494bEF91FAE66144dda31Be93180baD4`
- Wallet B / counterparty: `0xE6E7bfFA242d2900fad7067012564d441F735c43`
- Agreement: `human-wallet-e2e-20260905-01`
- Escrow: `1000 wei`; fee: `200 bps`; windows: acceptance 3d, funding 3d, performance 14d, response 3d, evidence 3d
- Summary: `Wallet B will verify that the immutable Dispute Court steward response is publicly accessible and contains the stated CI and deployed-source evidence.`
- Criteria: `Full performance: the immutable STEWARD-RESPONSE.md at commit 60d5c2511c4ed55a35234a8af28b3d5420bcc1e0 loads publicly and identifies the passing public CI run, both deployed contract addresses, and both matching source hashes. Partial performance should be proportional to the number of these four checks satisfied. Evidence must be a public URL and contain no secrets.`
- Opening claim: `Party A requests a formal test evaluation of whether the immutable steward response satisfies all four agreed public-evidence checks. No misconduct is alleged. Resolve only from the agreed criteria and public evidence, with payout proportional to verified completion.`
- Response: `Wallet B confirms full performance. The immutable steward response is publicly accessible and contains the passing public CI run, both deployed contract addresses, and both matching source hashes. The exact immutable URL will be submitted as the public exhibit.`
- Exhibit note: `This immutable exhibit verifies the public steward response, passing CI run, both deployed contract addresses, and both matching source hashes.`
- Exhibit URL: `https://raw.githubusercontent.com/sanity456/dispute-court/faff8a0dd5e2a50885768d17574df44e46f22969/evidence/HUMAN-WALLET-E2E-EVIDENCE.md`
- Captured normalized bytes: `1957`; digest: `6de54f943b46860ae9e0dc49076c1e94ac3a2c9607fbd7510640ea90c2fc5636`

All times below are stored chain transaction timestamps, not the browser clock.

## Finalized transaction trail

| Action | Sender | Value | Created Unix | Finalized Unix | Execution | Hash |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Create | A | 0 | 1788635628 | 1788635661.70342 | success | `0x5a0355c74d2920b10054f5b88c2bfd8377f88d798ebc5f194a412db1e41ce18f` |
| Accept | B | 0 | 1788636167 | 1788636204.04802 | success | `0x9f1855449f825aa046e6aa2e3970654c4d30b06d88bd95f7fd13fb6dda77131f` |
| Fund | A | 1000 | 1788639613 | 1788639648.09028 | success | `0xd0c859a7bfae0ee7e33dfd3db6b5581330d6e9af3464e8b4f1958b6a30e397ed` |
| Open dispute | A | 0 | 1788639848 | 1788639882.93582 | success | `0x3c32600916711ffcdcdbd2b3087a14e34070fe384b7e996db49bed0ebbbc1e5e` |
| Respond | B | 0 | 1788640166 | 1788640202.05882 | success | `0xafc6dc627e9a530bfa2740dcd73fdec62a49888e39aa565f87e9fe1359ff42a2` |
| Oversize capture | B | 0 | 1788640246 | 1788640292.14945 | error | `0xf9df4a3b745e85e00f7cb4429087069989b96f22f7fe80155f99f82072dcd175` |
| Compact capture | B | 0 | 1788641080 | 1788641119.34733 | success | `0xff1b2ecb0d21e99f52cb044dcaad5857f52ddfecbdc2b6cbbc4583e42e47a500` |
| Commit evidence | B | 0 | 1788641280 | 1788641315.13592 | success | `0xcaea180e5077ff4991148009180d536fb0bf2d659eb691088addbed373d7e191` |
| B ready | B | 0 | 1788641412 | 1788641446.77320 | success | `0xa97582b49aa1a385ee78fb10441e026a664af59afc35c1c3d1365a99f32eb135` |
| A ready | A | 0 | 1788641846 | 1788641880.66118 | success | `0x2e327bb541f1782d394f745acf92666417c53f528365d69701c103e980153f29` |
| AI resolution | A | 0 | 1788642401 | 1788642444.74941 | success | `0x21542e03ecca26a73c8ecd0436f59fd04932d27be78c98b5a70e32c655f07401` |
| Withdraw credit | A | 0 | 1788642673 | 1788642708.47573 | success | `0x1a32ec6ef6b110b6dc3ded0288fed071d68658bfbbd75251a2a2ec2ca8c9ca38` |
| Native payout child | core | 980 | 1788642708 | finalized | credited | `0xfe9ecd410ee4e0b8af1b7cabf94cdb2397d4153f157771df89b02dfdf7f0eee1` |

The oversize capture's exact decoded contract reason was `[EXTERNAL] Source exceeds 6000 UTF-8 bytes; use a smaller dedicated page`. It applied no state change. The replacement raw GitHub source returned anonymous HTTP 200 and its locally normalized byte count and SHA-256 matched the on-chain capture exactly.

## Exact resolution output and blocker

- Outcome: `decision`
- Resolution type: `ai_adjudication`
- Evidence observation: `evidence-001`, `verified`, digest `6de54f943b46860ae9e0dc49076c1e94ac3a2c9607fbd7510640ea90c2fc5636`
- Reasoning: `Evidence-001 confirms all four performance criteria defined in the trusted terms: 1) The steward response at the specified commit is public. 2) A passing public CI run is identified. 3) Both deployed contract addresses (DisputeCourtV3 and EvidenceCaptureV3) are identified. 4) Both matching source hashes are provided. As all four checks are satisfied, full performance is verified.`
- Authoritative allocation: Party A `980 wei`; Party B `0 wei`; fee `20 wei`; conservation `1000 wei`
- Reasoning provenance: `leader_output_non_authoritative`

The displayed reasoning found full Party B performance, but the model-selected `party_a_pct` was 100. The criteria did not explicitly map full performance to Party B, and v3 asked the model for a directional Party A percentage. This ambiguity is unacceptable for a consumer escrow product even though validator agreement and arithmetic conservation succeeded.

The withdrawal parent finalized successfully and emitted exactly one child. The child finalized from the core to Wallet A for `980 wei`, referenced the parent, and reported `value_credited=true`. Wallet A's canonical post-test balance was `999999999999999980 wei`, exactly 1 GEN minus the 20-wei fee.

## Human-path observations

- Login-message rejection safely left the user signed out, but the UI did not preserve a useful rejection message.
- Wallet-account switching correctly invalidated the previous wallet session and isolated wallet-specific data.
- A wrong-network switch did not produce a sufficiently prompt, durable warning.
- Create rejection preserved the draft and displayed a useful transaction-path error.
- Evidence capture was labeled like a fetch even though it opens an on-chain transaction.
- The generic failure notice hid the helper's exact 6,000-byte rejection reason.
- Commit evidence appeared actionable before a verified capture was reviewed, although client validation prevented broadcast.
- The invitation displayed a stale preview origin instead of the canonical evaluator URL.
- Receipt finality, state transitions, credit accounting, and separate payout-child verification worked.

## Required remediation

Ship a new immutable core that asks validators for a named Party B performance level and deterministically maps it to both payouts and a reason code. Show the fixed payout direction during creation and acceptance. Decode safe contract errors, make evidence-capture transactionality explicit, disable commit until review, preserve wallet/network messages, and use the canonical invitation origin. Re-run the complete clean suite, deploy and source-match the new core/helper, then repeat the critical human resolution and withdrawal path before submission.
