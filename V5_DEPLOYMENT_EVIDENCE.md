# Dispute Court v5 — candidate deployment evidence

Verified on Studionet on 2026-09-20. **Candidate only; not a production rollout or a completed human-wallet test.**

Source checkpoint (local, not yet pushed): `51cbb8805887167cbe4b435fcdb705b01e1c7387`.
Network: Studionet, chain ID `61999`, RPC `https://studio.genlayer.com/api`.
CLI: GenLayer `0.39.2`. Both sources pin runner `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.

## Core

- Address: `0x369D8f95744C8eaBcF50E8De009Eb162248D1504`
- Deployment transaction: `0x38525d640fc22bc79be1f57726f62ce2f1295a9f956a4ffd1fa0dfe5a76de2dd`
- Constructor input: `[200]` (2% adjudication fee; negotiated settlements are fee-free).
- Owner: `0x91B1b2D1f2De66400fcbeAEbadB8a5330eB28DC0`
- Source: `contracts/dispute_court_v5.py`
- SHA-256: `29a8184b3050bc1cfb434d319ad8631e0d75f61a915248abece1a2a4c9c4d7c7`
- Observed lifecycle: `FINALIZED`; execution: `success`.

## Evidence helper

- Address: `0x7547521fA84Df53f0C02BCdb9A60C323819F00b3`
- Deployment transaction: `0x098b3482e6dd59d3c6a14eeef3ca890f4d43c9b2e2315d8e0a92d02e9a133434`
- Constructor input: Address `0x369D8f95744C8eaBcF50E8De009Eb162248D1504`.
- Source: `contracts/evidence_capture_v5.py`
- SHA-256: `77f9f8572016015395df28daaa6f419441d0d7cc632e2f603a19d16a7398622a`
- Observed lifecycle: `FINALIZED`; execution: `success`.

## Verification performed

The existing read-only verifier passed with candidate manifests staged in `artifacts/milestone-v1/v5-candidate`:

```text
node scripts/verify-security-release.mjs --expected-fee-bps 200 --manifest-dir ../artifacts/milestone-v1/v5-candidate
```

It verified successful finalized deployments, exact deployed source bytes, both source hashes, chain ID, owner, fee, protocol 5, source limits, directional decision policy, negotiation policy and limits, and the evidence helper's binding to this core. The helper rejects funds. Separately, hashing both source blobs directly from the checkpoint commit produced the same hashes above; this is not merely a comparison against mutable working files.

Raw RPC errors, node configuration and private keys are not retained in this evidence.

## Scope and outstanding proof

The primary checkout's default v4 manifests and accepted v4 sources are unchanged. A separate local preview checkout at `work/v5-preview` uses these v5 manifests and retains v4 access. Its only candidate configuration changes are the two default manifests and the retained-release registry. It is not a second product or a public deployment.

This document proves deployment only. The later funded negotiation/counteroffer and both native withdrawals passed; see [V5_HUMAN_WALLET_EVIDENCE.md](V5_HUMAN_WALLET_EVIDENCE.md) for their separate evidence and remaining guard/expiry tests. Public Ubuntu CI, immutable public evidence links, signed-out access checks, Vercel rollout and final milestone submission remain pending. The local verification observation time is not used as a contract eligibility timestamp.
