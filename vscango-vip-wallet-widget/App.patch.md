# Integrating the claim page into App.jsx

Two small additive edits to your real `App.jsx` (the one you sent).

## 1. Add the import, next to your other page imports

```jsx
import VipPResults2025 from "./VipPResults2025.jsx";
import VipClaim from "./VipClaim.jsx";   // ➕ ADD THIS LINE
```

## 2. Add the route, next to your existing Historical VIP routes

```jsx
{/* ✅ Historical VIP pages */}
<Route path="/historical-vip/2024" element={<VipPResults2024 />} />
<Route path="/historical-vip/2025" element={<VipPResults2025 />} />

{/* Optional: if anything ever lands on /historical-vip, send them somewhere valid */}
<Route path="/historical-vip" element={<Navigate to="/historical-vip/2025" replace />} />

{/* ✅ VIP/VIPP rewards claim */}
<Route path="/vip-claim" element={<VipClaim />} />
```

That's it — `VipClaim.jsx` already imports `SiteFrame` the same way your
other pages do, so it'll pick up your header/footer automatically. Once
this route exists and the `SiteFrame.patch.md` header edit is in place,
`/vip-claim` and both `/historical-vip/*` pages will show the Connect
Wallet button; every other route is untouched.
