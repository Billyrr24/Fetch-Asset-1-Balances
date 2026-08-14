# Integrating the wallet button into SiteFrame.jsx

Three small, additive edits to your existing `SiteFrame.jsx`. Nothing existing
is removed — every other page keeps behaving exactly as before, since the
button only renders when `__isVipPage` is true.

## 1. Add the import (near the top, with your other imports)

```jsx
import ConnectWalletButton from "./wallet/ConnectWalletButton.jsx";
```

(Path assumes you drop `ConnectWalletButton.jsx` in `src/components/wallet/`,
next to `SiteFrame.jsx` in `src/components/`. Adjust if you place it
elsewhere — and update the two relative imports *inside*
`ConnectWalletButton.jsx` to match: it currently imports
`../../../SiteFrame.jsx` for `HEADER_BUTTON_STYLE`/`Z`, and
`../../vitreusWalletStore.js` / `../../vitreusChain.js`.)

## 2. Add VIP-page path detection

This mirrors the pattern you already use for `__searchAllow` a few lines
above it. Add it right after that block (around where `__effectiveHeaderSearch`
is computed):

```jsx
// ✅ Only show the wallet connect button on VIP/VIPP pages.
const VIP_WALLET_PATHS = ["/historical-vip", "/vip-claim"];
const __isVipPage = VIP_WALLET_PATHS.some(
  (p) => __path === p || __path.startsWith(p + "/")
);
```

Adjust `VIP_WALLET_PATHS` to match whatever routes you actually consider
"VIP pages" — e.g. add `/vip` if you have a live current-status page too.
`/historical-vip` as a prefix already covers `/historical-vip/2024` and
`/historical-vip/2025`.

## 3. Render the button in the header

In the header's right-hand control group, where `rightSlot` and the menu
button are rendered (around line 945-978 in your current file):

```jsx
<div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
  {SHOW_PRO_AUTH_BUTTONS &&
  !__hideProAuthOnAccount &&
  (!__isMobile ? (
    <ProAuthButtons onOpenAccountModal={openAccountModal} />
  ) : __path === "/" ? (
    <ProAuthButtons onOpenAccountModal={openAccountModal} />
  ) : null)}

  {rightSlot}

  {/* ➕ ADD THIS LINE */}
  {__isVipPage ? <ConnectWalletButton /> : null}

  {showMenuButton ? (
    <button ...>
```

That's the whole integration — no router changes needed for the header
itself. You still need to add a route for the new `VipClaim.jsx` page
wherever your routes are defined (see the main README).
