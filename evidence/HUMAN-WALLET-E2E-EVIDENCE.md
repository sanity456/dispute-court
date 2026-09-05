# Dispute Court — human-wallet E2E evidence

This is a compact public exhibit for agreement `human-wallet-e2e-20260905-01`. It summarizes the four checks in the accepted criteria and links to the immutable records. The complete steward response remains authoritative.

## 1. Immutable steward response is public

The complete [`STEWARD-RESPONSE.md` at commit `60d5c2511c4ed55a35234a8af28b3d5420bcc1e0`](https://github.com/sanity456/dispute-court/blob/60d5c2511c4ed55a35234a8af28b3d5420bcc1e0/STEWARD-RESPONSE.md) is publicly accessible without repository credentials.

## 2. Public CI passed

Public GitHub Actions run [`33984294179`](https://github.com/sanity456/dispute-court/actions/runs/33984294179) passed the complete clean Ubuntu suite for tested source commit [`66867e359d50afdeb36dca317b2e1af116a05452`](https://github.com/sanity456/dispute-court/commit/66867e359d50afdeb36dca317b2e1af116a05452). The complete steward response records the runner, dependency, test, and completion details.

## 3. Both deployed addresses are identified

- DisputeCourtV3: `0x49CE252a7b8a085Ef9B859F82bD55Af1eC601BEe`
- EvidenceCaptureV3: `0x66cF318eb3C2276689BAe995b554104995485940`

Both are Studionet deployments on chain `61999`.

## 4. Both deployed-source hashes match

The public CI deployment check fetched the finalized Studionet deployment source bytes and matched them to the tested repository source:

- [`contracts/dispute_court_v3.py`](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/contracts/dispute_court_v3.py): `1718a9ef8b3668599cf98d26207a611d9eb22d655ef6c5c0332f7c534bf8b66b`
- [`contracts/evidence_capture_v3.py`](https://github.com/sanity456/dispute-court/blob/66867e359d50afdeb36dca317b2e1af116a05452/contracts/evidence_capture_v3.py): `8eaa893c58927830a307763138dba45a5f77e4d31ead90e8d3688e0c7a6b123c`

This exhibit is intentionally below the contract's 6,000-byte complete-source limit. It contains no secrets.
