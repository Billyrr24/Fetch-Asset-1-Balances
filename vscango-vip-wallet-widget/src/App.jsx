import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./LandingPage.jsx";
import WalletBalances from "./WalletBalances.jsx";
import TeamVesting from "./TeamVesting.jsx";
import VipPResults2024 from "./VipPResults2024.jsx";
import VipPResults2025 from "./VipPResults2025.jsx";
import VipClaim from "./VipClaim.jsx";
import Operators from "./Operators.jsx";
import DynamicEnergy from "./DynamicEnergy.jsx";
import Bridge from "./Bridge.jsx";

import Explorer from "./Explorer.jsx";
import Account from "./Account.jsx";
import Login from "./Login.jsx";
import Recover from "./Recover.jsx";
import Wallet from "./Wallet.jsx";
import Extrinsic from "./Extrinsic.jsx";
import Block from "./Block.jsx";
import Event from "./Event.jsx";
import Register from "./Register.jsx";
import Admin from "./Admin.jsx";
import Democracy from "./Democracy.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/wallet-balances" element={<WalletBalances />} />
        <Route path="/team-vesting" element={<TeamVesting />} />
        <Route path="/dynamic-energy" element={<DynamicEnergy />} />
        <Route path="/operators" element={<Operators />} />

        {/* ✅ Bridge tracker (unlisted for now, no nav link) */}
        <Route path="/bridge" element={<Bridge />} />

        {/* ✅ Historical VIP pages */}
        <Route path="/historical-vip/2024" element={<VipPResults2024 />} />
        <Route path="/historical-vip/2025" element={<VipPResults2025 />} />

        {/* Optional: if anything ever lands on /historical-vip, send them somewhere valid */}
        <Route path="/historical-vip" element={<Navigate to="/historical-vip/2025" replace />} />

        {/* ✅ VIP/VIPP rewards claim */}
        <Route path="/vip-claim" element={<VipClaim />} />

        {/* ✅ Explorer (React) */}
        <Route path="/explorer" element={<Explorer />} />

        {/* ✅ Auth (React) */}
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Login />} />

        {/* placeholders until we convert them */}
	<Route path="/register" element={<Register />} />
        <Route path="/recover" element={<Recover />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/block" element={<Block />} />
        <Route path="/extrinsic" element={<Extrinsic />} />
        <Route path="/event" element={<Event />} />
	<Route path="/democracy" element={<Democracy />} />


        <Route path="/wallet.html" element={<Navigate to="/wallet" replace />} />
        <Route path="/block.html" element={<Navigate to="/block" replace />} />
        <Route path="/extrinsic.html" element={<Navigate to="/extrinsic" replace />} />
        <Route path="/event.html" element={<Navigate to="/event" replace />} />
        <Route path="/account.html" element={<Navigate to="/account" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/register.html" element={<Navigate to="/register" replace />} />
        <Route path="/recover.html" element={<Navigate to="/recover" replace />} />
        <Route path="/admin.html" element={<Navigate to="/admin" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#ffffff",
        padding: 24,
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function ComingSoon({ title }) {
  return (
    <PageShell>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p style={{ color: "#cfcfcf" }}>Coming soon…</p>
      <a href="/" style={{ color: "#6df2b2" }}>
        ← Back to home
      </a>
    </PageShell>
  );
}

function NotFound() {
  return (
    <PageShell>
      <h1 style={{ marginTop: 0 }}>Not found</h1>
      <p style={{ color: "#cfcfcf" }}>That page doesn’t exist (yet).</p>
      <a href="/" style={{ color: "#6df2b2" }}>
        ← Back to home
      </a>
    </PageShell>
  );
}
