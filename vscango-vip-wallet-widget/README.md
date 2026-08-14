# VIP/VIPP Rewards Claim Widget for vScan

Drop-in files that add a "Connect Wallet" button to your `SiteFrame` header
(shown only on VIP pages) and a new page where a connected wallet can see
and claim its unclaimed `privileges.claim_rewards(year)` VIP/VIPP rewards
on Vitreus mainnet.

## What this talks to

- **RPC:** `wss://rpc-mainnet.vtrs.io` (same endpoint your existing
  `api/index.js` asset-balance fetcher uses).
- **Pallet:** `privileges` — confirmed live on mainnet by pulling
  `state_getMetadata` directly (not just reading the `power-plant` repo
  source), so the call/storage names below are what's actually deployed:
  - `api.query.privileges.rewards(year)` — the reward pool for a year.
  - `api.query.privileges.vipPoints(year, address)` /
    `api.query.privileges.vippPoints(year, address)` — this account's
    unclaimed points for that year (removed once claimed).
  - `api.tx.privileges.claimRewards(year)` — the actual claim extrinsic.
- **Token:** VTRS, 18 decimals (from `system_properties`).
- **WalletConnect chain ID:** `polkadot:4f27ff2e1c714c78b718d11a999774b2`
  (CAIP-13 reference derived from the live genesis hash).

## Files

```
src/vitreusChain.js                          on-chain reads + claim tx + local claim history
src/vitreusWalletStore.js                     shared connect/disconnect state (extension + WalletConnect)
src/components/wallet/ConnectWalletButton.jsx header button + connect-method picker
src/VipClaim.jsx                              the claim page itself
SiteFrame.patch.md                            exact 3-step diff for your SiteFrame.jsx
```

Copy the `src/` contents into your project (adjust the relative import
paths at the top of `ConnectWalletButton.jsx` and `VipClaim.jsx` to match
wherever you actually place `SiteFrame.jsx`), then follow
`SiteFrame.patch.md`.

## 1. Install dependencies

```bash
npm install @polkadot/api @polkadot/extension-dapp @walletconnect/universal-provider @walletconnect/modal
```

## 2. Get a WalletConnect project ID

WalletConnect (the QR-code, no-extension option) requires a free project ID:

1. Go to https://cloud.reown.com (this is WalletConnect's current name/site).
2. Create a project, copy its Project ID.
3. Paste it into `WALLETCONNECT_PROJECT_ID` at the top of
   `src/vitreusWalletStore.js`.

Until you do this, the "Browser Extension" option works fully; the
"WalletConnect" option will show a clear error instead of silently failing.

## 3. Add the route

Wherever your router is defined (I don't have that file — you mentioned
this project doesn't live in a repo I can see), add:

```jsx
import VipClaim from "./VipClaim.jsx";
// ...
<Route path="/vip-claim" element={<VipClaim />} />
```

If you'd rather use a different path, update it here and in
`VIP_WALLET_PATHS` inside `SiteFrame.patch.md`'s step 2.

## 4. Wire up the header (SiteFrame.jsx)

Follow `SiteFrame.patch.md` — three small additive edits, nothing removed.

## Security notes (please don't change these without thinking hard first)

- **No seed phrase / private key input anywhere.** Both connection methods
  are non-custodial: the extension or the mobile wallet app holds the key
  and signs; this code only ever receives a signature. Keep it that way.
- **Extension vs. WalletConnect are equally secure** for this use case —
  same signing model, key never leaves the wallet either way. The
  meaningful difference is *reach*, not safety:
  - The browser extension works for Vitreus out of the box, because the
    **dApp** (this code) supplies the chain metadata to the extension —
    the extension just signs whatever payload it's given.
  - WalletConnect only works if the **wallet app** on the other end
    already knows about Vitreus (by genesis hash) or lets the user add it
    as a custom network mid-session. I could not confirm Vitreus is
    pre-registered in Nova Wallet or SubWallet's WalletConnect chain
    lists — test this path yourself with your actual mobile wallet before
    relying on it, and expect to tell users "add Vitreus as a custom
    network first" if it doesn't just work.
- **Estimated reward amounts are informational.** They're computed
  client-side with the same `(my points / total points) × pool` formula
  the pallet uses, but the runtime computes the real payout atomically at
  claim time — always let the user's own wallet UI be the source of truth
  for what they're actually signing.
- **Claim history is local-only** (per-browser `localStorage`), not a real
  on-chain audit trail — it only remembers claims made through this exact
  page in this exact browser. That's flagged in the UI copy; don't
  silently upgrade the wording to imply it's authoritative.
- **Mainnet only, hardcoded RPC.** There's intentionally no user-editable
  RPC endpoint field, to avoid a malicious-RPC injection vector.

## What I couldn't verify

- I don't have access to your actual router/App entry point, so the route
  wiring in step 3 is a generic React Router v6 example — adapt it to
  however your project actually registers routes.
- I don't have a running copy of vscango.com to test against, so please
  test the full flow (connect → see claimable years → claim → history)
  in a dev/staging build before shipping, ideally against an account with
  a small real claim first.
