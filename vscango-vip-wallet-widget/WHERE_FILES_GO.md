# Where each file goes

Based on your `App.jsx`, `VipPResults2025.jsx`, and `SiteFrame.jsx`, your
project looks like this (page components sit next to `App.jsx`; shared UI
lives in `components/`):

```
your-project-src/
  App.jsx
  VipPResults2024.jsx
  VipPResults2025.jsx
  components/
    SiteFrame.jsx
    ...
  utils/
    sessionJsonCache.js
```

Drop the new files in like this:

```
your-project-src/
  App.jsx                              ← EDIT (see App.patch.md) — don't replace
  VipPResults2024.jsx
  VipPResults2025.jsx
  VipClaim.jsx                         ← NEW — put here, next to VipPResults2025.jsx
  vitreusChain.js                      ← NEW — put here, next to App.jsx
  vitreusWalletStore.js                ← NEW — put here, next to App.jsx
  components/
    SiteFrame.jsx                      ← EDIT in place (see SiteFrame.patch.md) — don't replace/rename
    wallet/                            ← NEW folder
      ConnectWalletButton.jsx          ← NEW — put here
```

So: the two `.js` files (`vitreusChain.js`, `vitreusWalletStore.js`) are
plain logic modules, not pages or components — they go at the **same
level as `App.jsx`**, not inside `components/`. `ConnectWalletButton.jsx`
is the one nested one, in a new `components/wallet/` folder.

**`SiteFrame.jsx` and `App.jsx` are never replaced.** You already have
both — `SiteFrame.patch.md` and `App.patch.md` each describe a couple of
lines to add to your existing files by hand. Everything else (`README.md`,
`SiteFrame.patch.md`, `App.patch.md`, this file) is instructions, not code
to place anywhere.

Once the files are in place: `npm install` the packages listed in
`README.md`, apply the two patches, and `/vip-claim` should work with your
WalletConnect project ID already wired in.
