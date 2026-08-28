# Dispute Court wallet release — 2026-08-28

## Deployment

- Account: `sanity456`; workspace: `sanity3`.
- [Verified wallet-only deployment](https://dispute-court-studionet-ngjkyl6s6-sanity3.vercel.app)
- Deployment ID: `dpl_9cJHHRdbWc83UJXvujK56C75Yqfa`; state: `READY`.
- Independent product database; existing contracts and published Sites version unchanged.
- The two automatic production aliases were removed and anonymously verified as 404. This generated deployment URL still returns a Vercel Authentication redirect to anonymous visitors. Alias removal is reversible; no deployment or data was deleted.

## Executed checks

| Check                                  | Result                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| Application suite                      | 78 passed, including 20 wallet authentication/client tests            |
| Type checking and zero-warning lint    | Passed                                                                |
| Native Next.js and Sites/Vinext builds | Passed locally                                                        |
| Vercel frozen install and build        | Passed                                                                |
| Live Neon verification                 | 13 check groups passed in a disposable schema                         |
| Local wallet HTTP flow                 | 26 checks passed on localhost                                         |
| Hosted release verification            | 36 checks passed, including 26 wallet checks                          |
| Compiled browser assets                | 44 scanned; no matches for 10 private values or retired provider code |
| Anonymous access after alias removal   | Four workspace aliases 404; both generated test URLs gated            |

Wallet checks cover challenge binding, origin/product/chain checks, forged identities, invalid signatures, replay rejection, signed-session restoration, rotation/logout, cross-wallet isolation, retired email routes, and separation from owner authorization. Client tests cover canonical messages, signing/network/account changes and state isolation.

Only synthetic test wallet signatures were used. Hosted checks create short-lived authentication rows and log out; they do not create user content, send funds or call an intelligent contract. Database checks remove only their randomly named test schema.

The full dependency scan still reports two known `image-size` development-tool advisories. The existing reproducible parser patch and regression tests are retained. Do not represent this as a clean independent audit.

## Human acceptance still required

Use an actual supported browser-wallet EOA to approve/reject login, switch accounts and networks, sign out, restore a session, and verify no prior-wallet drafts or support/history appear. Complete a two-person product journey and mobile wallet/focus checks. Smart-contract wallets and WalletConnect/mobile deep-link onboarding are not implemented.

Legacy account records are retained but never attached to a wallet based on an unverified address. See [wallet authentication](../docs/WALLET_AUTH.md), [hosting protection](../docs/VERCEL.md), and [the release status](../../RELEASE_STATUS.md).
