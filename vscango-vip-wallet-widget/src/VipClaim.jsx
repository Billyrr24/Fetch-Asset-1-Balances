// VipClaim.jsx
// New page: lets a connected wallet see and claim its unclaimed VIP/VIPP
// rewards for every year the privileges pallet has opened for claiming.
// Styled to match VipPResults2024.jsx / VipPResults2025.jsx.

import React, { useCallback, useEffect, useState } from "react";
import SiteFrame, { FOOTER_HEIGHT } from "./components/SiteFrame.jsx"; // adjust path if needed
import { subscribeWallet, getActiveSigner, requestVappActionCall } from "./vitreusWalletStore.js";
import {
  getClaimableRewards,
  getVipVippStatus,
  submitClaim,
  formatTokenAmount,
  truncateAddress,
  getClaimHistory,
  recordClaim,
} from "./vitreusChain.js";

function Card({ children, style }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatusCard({ status, symbol, decimals }) {
  const { vip, vipp, nac } = status;

  const boxStyle = {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    padding: "10px 12px",
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 10 }}>VIP / VIPP Status</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={boxStyle}>
          <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900, marginBottom: 4 }}>VIP</div>
          {vip.isMember ? (
            <>
              <div style={{ color: "#bef2e0", fontWeight: 900 }}>Active member</div>
              <div style={{ color: "#9fb0ab", fontSize: 11, marginTop: 4 }}>
                Active stake: {formatTokenAmount(vip.activeStake, decimals)} {symbol}
              </div>
              <div style={{ color: "#9fb0ab", fontSize: 11 }}>
                Points accrued this year: {vip.points.toString()}
              </div>
            </>
          ) : (
            <div style={{ color: "#cfcfcf", fontSize: 13 }}>
              Not enrolled — anyone actively staking (as a validator or cooperator) can join, no
              minimum amount required.
            </div>
          )}
        </div>

        <div style={boxStyle}>
          <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900, marginBottom: 4 }}>VIPP</div>
          {nac.permanentlyLockedOut ? (
            <>
              <div style={{ color: "#ffb4b4", fontWeight: 900 }}>Permanently locked out</div>
              <div style={{ color: "#9fb0ab", fontSize: 11, marginTop: 4 }}>
                This wallet's active stake dropped below its NFT's threshold at some point.
                Per protocol rules, VIPP eligibility is lost forever once that happens — it
                cannot be re-entered with this wallet.
              </div>
            </>
          ) : vipp.isMember ? (
            <>
              <div style={{ color: "#bef2e0", fontWeight: 900 }}>Active member</div>
              <div style={{ color: "#9fb0ab", fontSize: 11, marginTop: 4 }}>
                Threshold: {formatTokenAmount(vipp.threshold, decimals)} {symbol}
              </div>
              <div style={{ color: "#9fb0ab", fontSize: 11 }}>
                Points accrued this year: {vipp.points.toString()}
              </div>
              <div style={{ color: "#ffcf8a", fontSize: 11, marginTop: 4 }}>
                Keep your active stake at or above the threshold — dropping below it risks
                permanent loss of VIPP for this wallet.
              </div>
            </>
          ) : (
            <div style={{ color: "#cfcfcf", fontSize: 13 }}>
              {nac.hasNft
                ? "Not currently VIPP-enrolled."
                : "No NAC NFT found for this wallet — VIPP was only granted to early mainnet-launch claims."}
            </div>
          )}
        </div>
      </div>

      {nac.hasNft && nac.claimedAmount != null ? (
        <div style={{ marginTop: 10, fontSize: 11, color: "#9fb0ab" }}>
          Original mainnet-launch claim: {formatTokenAmount(nac.claimedAmount, decimals)} {symbol} · NAC level{" "}
          {nac.level}
        </div>
      ) : null}
    </Card>
  );
}

function YearClaimCard({ item, symbol, decimals, onClaim, claiming, claimResult }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 950 }}>{item.year}</div>
        <div style={{ fontSize: 18, fontWeight: 950, color: "#bef2e0" }}>
          ≈ {formatTokenAmount(item.estTotalReward, decimals)} {symbol}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        {item.hasVip ? (
          <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: "8px 10px" }}>
            <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900 }}>VIP</div>
            <div style={{ fontWeight: 900 }}>{formatTokenAmount(item.estVipReward, decimals)} {symbol}</div>
            <div style={{ color: "#9fb0ab", fontSize: 11 }}>{item.myVipPoints.toString()} points</div>
          </div>
        ) : null}
        {item.hasVipp ? (
          <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", padding: "8px 10px" }}>
            <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900 }}>VIPP</div>
            <div style={{ fontWeight: 900 }}>{formatTokenAmount(item.estVippReward, decimals)} {symbol}</div>
            <div style={{ color: "#9fb0ab", fontSize: 11 }}>{item.myVippPoints.toString()} points</div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btnPop"
          disabled={claiming}
          onClick={() => onClaim(item.year)}
          style={{
            cursor: claiming ? "not-allowed" : "pointer",
            opacity: claiming ? 0.6 : 1,
            padding: "9px 16px",
            borderRadius: 10,
            border: "1px solid rgba(109,242,178,0.55)",
            background: "rgba(109,242,178,0.14)",
            color: "#ffffff",
            fontWeight: 950,
          }}
        >
          {claiming ? "Claiming…" : `Claim ${item.year} Rewards`}
        </button>
        {claimResult?.status ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: claimResult.status === "error" ? "#ffb4b4" : "#bef2e0",
            }}
          >
            {claimResult.message}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export default function VipClaim() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claimable, setClaimable] = useState([]);
  const [tokenMeta, setTokenMeta] = useState({ decimals: 18, symbol: "VTRS" });
  const [claimingYear, setClaimingYear] = useState(null);
  const [claimResults, setClaimResults] = useState({}); // { [year]: { status, message } }
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => subscribeWallet(setWallet), []);

  const address = wallet?.status === "connected" ? wallet.address : null;

  const refresh = useCallback(async () => {
    if (!address) {
      setClaimable([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [{ claimable: list, decimals, symbol }, statusResult] = await Promise.all([
        getClaimableRewards(address),
        getVipVippStatus(address),
      ]);
      setClaimable(list);
      setTokenMeta({ decimals, symbol });
      setStatus(statusResult);
      setHistory(getClaimHistory(address));
    } catch (e) {
      setError(e?.message || "Failed to load rewards from chain.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleClaim(year) {
    if (!address) return;
    setClaimingYear(year);

    if (wallet.source === "vapp") {
      // vApp builds, signs, and submits the extrinsic itself — we only
      // send the request and wait for its result over the socket.
      setClaimResults((r) => ({
        ...r,
        [year]: { status: "pending", message: "Check vApp to approve the claim…" },
      }));
      try {
        const result = await requestVappActionCall({ callName: "claimRewards", data: { year } });
        recordClaim(address, { year, txHash: result?.txHash || result?.hash || "vApp-submitted" });
        setHistory(getClaimHistory(address));
        setClaimResults((r) => ({ ...r, [year]: { status: "success", message: "Claimed ✓" } }));
        setClaimable((list) => list.filter((item) => item.year !== year));
      } catch (e) {
        setClaimResults((r) => ({ ...r, [year]: { status: "error", message: e?.message || "Claim failed." } }));
      } finally {
        setClaimingYear(null);
      }
      return;
    }

    // Browser-extension path: we build the extrinsic and ask the extension
    // to sign it directly.
    setClaimResults((r) => ({ ...r, [year]: { status: "pending", message: "Waiting for signature…" } }));
    try {
      const signer = await getActiveSigner(address);
      const result = await submitClaim(address, year, signer, {
        onStatus: (r) => {
          if (r.status.isBroadcast) {
            setClaimResults((prev) => ({ ...prev, [year]: { status: "pending", message: "Broadcasting…" } }));
          } else if (r.status.isInBlock) {
            setClaimResults((prev) => ({ ...prev, [year]: { status: "pending", message: "In block, waiting for finality…" } }));
          }
        },
      });

      recordClaim(address, { year, txHash: result.txHash, blockHash: result.blockHash });
      setHistory(getClaimHistory(address));
      setClaimResults((r) => ({ ...r, [year]: { status: "success", message: "Claimed ✓" } }));
      setClaimable((list) => list.filter((item) => item.year !== year));
    } catch (e) {
      setClaimResults((r) => ({ ...r, [year]: { status: "error", message: e?.message || "Claim failed." } }));
    } finally {
      setClaimingYear(null);
    }
  }

  return (
    <SiteFrame showSearch={false} footerText="© 2026 vScan — All rights reserved">
      <div style={{ paddingBottom: FOOTER_HEIGHT + 16, maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem" }}>VIP / VIPP Rewards Claim</h1>
        <p style={{ color: "#cfcfcf", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Connect your wallet with the button at the top of the page to view and claim any
          unclaimed VIP/VIPP rewards. This page never asks for a seed phrase or private key —
          you approve every claim inside your own wallet.
        </p>

        {!address ? (
          <Card>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>No wallet connected</div>
            <div style={{ color: "#cfcfcf", fontSize: 13 }}>
              Use the “Connect Wallet” button at the top of the page to get started.
            </div>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900 }}>CONNECTED WALLET</div>
                <div style={{ fontWeight: 950, fontFamily: "ui-monospace, monospace" }}>{truncateAddress(address, 10, 10)}</div>
              </div>
              <button type="button" className="btnPop" onClick={refresh} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(0,0,0,0.25)", color: "#fff", fontWeight: 900 }}>
                Refresh
              </button>
            </Card>

            {status ? <StatusCard status={status} symbol={tokenMeta.symbol} decimals={tokenMeta.decimals} /> : null}

            {loading ? <div style={{ color: "#cfcfcf", padding: "10px 0" }}>Checking on-chain rewards…</div> : null}

            {error ? (
              <Card style={{ borderColor: "#7a2a2a", background: "#2a1111", marginBottom: 16 }}>
                <div style={{ color: "#ffd1d1", fontWeight: 800 }}>{error}</div>
              </Card>
            ) : null}

            {!loading && !error && claimable.length === 0 ? (
              <Card>
                <div style={{ color: "#cfcfcf" }}>No unclaimed VIP/VIPP rewards found for this wallet.</div>
              </Card>
            ) : null}

            {claimable.map((item) => (
              <YearClaimCard
                key={item.year}
                item={item}
                symbol={tokenMeta.symbol}
                decimals={tokenMeta.decimals}
                claiming={claimingYear === item.year}
                claimResult={claimResults[item.year]}
                onClaim={handleClaim}
              />
            ))}

            {history.length > 0 ? (
              <div style={{ marginTop: 28 }}>
                <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>Claim History (this device)</h2>
                <Card>
                  {history.map((h, i) => (
                    <div
                      key={`${h.year}-${h.txHash}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: i === history.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{h.year}</div>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9fb0ab" }}>
                        {truncateAddress(h.txHash, 10, 8)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9fb0ab" }}>{new Date(h.at).toLocaleString()}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 11, color: "#9fb0ab" }}>
                    This list is stored only in this browser and only tracks claims made through
                    this page. It is not a full on-chain history — verify a transaction on{" "}
                    <a href="https://explorer.vtrs.io/" target="_blank" rel="noreferrer" style={{ color: "#bef2e0" }}>
                      explorer.vtrs.io
                    </a>{" "}
                    using its hash.
                  </div>
                </Card>
              </div>
            ) : null}
          </>
        )}
      </div>
    </SiteFrame>
  );
}
