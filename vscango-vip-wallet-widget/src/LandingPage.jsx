// LandingPage.jsx — COMPLETE COPY/PASTE REPLACEMENT (disclaimer removed)
import React, { useEffect, useMemo, useState } from "react";
import SiteFrame, { FOOTER_HEIGHT, HEADER_BG, Z } from "./components/SiteFrame.jsx";

import { warmSessionCache, readCachedJson } from "./utils/sessionJsonCache.js";
import { useCachedJson } from "./hooks/useCachedJson.js";

// ✅ Local QR generation (no network)
import QRCode from "qrcode";

const DYNAMIC_ENERGY_ENDPOINT = "https://cache.vscango.com/api/dynamicEnergy";
const HISTORICAL_VIP_2024_ENDPOINT = "https://cache.vscango.com/api/2024vipPResults";
const HISTORICAL_VIP_2025_ENDPOINT = "https://cache.vscango.com/api/2025vipPResults";

// ✅ Token price now comes from YOUR Pi cache API (last-known-good price)
const WVTRS_PRICE_ENDPOINT = "https://cache.vscango.com/api/wvtrsPrice";

// ✅ Keep token price updated in session cache every minute
const TOKEN_PRICE_REFRESH_MS = 60_000;

/** Extract the first number-looking token; ensure ".123" becomes "0.123". */
function numberOnly(value) {
  const s = String(value ?? "").trim();

  // Supports: -12, 12.34, .34, 1,234.56
  const m = s.match(/-?(?:\d{1,3}(?:,\d{3})+|\d+|\d*\.\d+)(?:\.\d+)?/);
  if (!m) return "—";

  let out = m[0];

  // normalize leading "."
  if (out.startsWith(".")) out = `0${out}`;
  if (out.startsWith("-.")) out = out.replace("-.", "-0.");

  return out;
}

function MiniMetric({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        padding: "6px 10px",
        textAlign: "right",
        boxShadow: "0 10px 18px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.72)",
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 13,
          fontWeight: 980,
          letterSpacing: 0.2,
          marginTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function pickTileValue(tiles, includesAny) {
  const want = includesAny.map((x) => norm(x));
  for (const t of tiles || []) {
    const label = norm(t?.label);
    if (!label) continue;
    if (want.some((w) => label.includes(w))) return String(t?.value ?? "").trim();
  }
  return "";
}

function extractHistoricalSummaryFromTiles(tiles) {
  const vipMembers = pickTileValue(tiles, ["vip members", "vip member", "vip wallets", "vip wallet"]);
  const vippMembers = pickTileValue(tiles, ["vipp members", "vipp member", "vipp wallets", "vipp wallet"]);

  const pctClaimed =
    pickTileValue(tiles, ["% claimed", "percent claimed", "claimed %", "claiming", "vip(p) claiming"]) ||
    pickTileValue(tiles, ["claimed"]);

  return {
    vipMembers: vipMembers || "—",
    vippMembers: vippMembers || "—",
    pctClaimed: pctClaimed || "—",
  };
}

function formatUsdPrice(raw) {
  const n = Number(String(raw ?? "").trim());
  if (!isFinite(n) || n <= 0) return "—";

  // dynamic decimals: show more detail for small prices, but don’t get silly
  let decimals = 6;
  if (n >= 1) decimals = 4;
  if (n >= 10) decimals = 3;
  if (n >= 100) decimals = 2;
  if (n < 0.01) decimals = 8;

  return `$${n.toFixed(decimals)}`;
}

export default function LandingPage() {
  const sites = [
    { name: "Dynamic Energy", url: "/dynamic-energy", description: "Chain-level energy generation and exchange metrics" },
    { name: "Explorer", url: "/explorer", description: "Lookup transactional history including block, extrinsic and event data" },
    { name: "Bridge", url: "/bridge", description: "Track cross-chain bridge activity, liquidity, and transactions" },
    { name: "Wallets", url: "/wallet-balances", description: "Wallet balances, staking, VIP, and VIPP data" },
    { name: "Team Vesting", url: "/team-vesting", description: "Team vesting balances and schedules" },
    {
      name: "Historical VIP",
      url: "/historical-vip",
      description: "Historical VIP and VIPP payout information",
      isYearPicker: true,
    },
    { name: "Claim VIP/P Rewards", url: "/vip-claim", description: "Connect your wallet and claim your VIP/VIPP rewards" },
    { name: "Operators", url: "/operators", description: "Operator dashboard and chain participation data" },
  ];

  const donationAddress = "0xe31331eb27fd19a31a3f3315c48e7e2cc0857504";

  const [showDonate, setShowDonate] = useState(false);
  const [showHistoricalVipPicker, setShowHistoricalVipPicker] = useState(false);

  // ✅ Local QR (data URL) — generated once and reused (instant when modal opens)
  const [donationQrDataUrl, setDonationQrDataUrl] = useState("");

  // Detect mobile
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const onResize = () => setIsMobile(window.matchMedia("(max-width: 760px)").matches);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // ✅ Generate QR locally ASAP (no network)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // High error correction + crisp rendering; margin 1 looks clean inside your white frame
        const url = await QRCode.toDataURL(donationAddress, {
          errorCorrectionLevel: "M",
          margin: 1,
          scale: 8,
        });
        if (alive) setDonationQrDataUrl(url);
      } catch {
        // If QR generation fails for any reason, leave blank (we show a tiny fallback message)
        if (alive) setDonationQrDataUrl("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [donationAddress]);

  // Cache-first JSON (landing reads from session cache; refresh happens via warmers below)
  const { data: dynEnergyJson } = useCachedJson(DYNAMIC_ENERGY_ENDPOINT, { maxAgeMs: Infinity, refreshOnMount: true });
  const { data: vip2024Json } = useCachedJson(HISTORICAL_VIP_2024_ENDPOINT, { maxAgeMs: Infinity, refreshOnMount: true });
  const { data: vip2025Json } = useCachedJson(HISTORICAL_VIP_2025_ENDPOINT, { maxAgeMs: Infinity, refreshOnMount: true });

  // ✅ Token price (your Pi cache API) — stored & read from session cache
  const { data: wvtrsJson } = useCachedJson(WVTRS_PRICE_ENDPOINT, { maxAgeMs: Infinity, refreshOnMount: true });

  // ✅ Live copies to guarantee re-render when cache is updated silently
  const [liveDynEnergyJson, setLiveDynEnergyJson] = useState(null);
  const [liveWvtrsJson, setLiveWvtrsJson] = useState(null);

  // Prefer live copies (updated every minute), fallback to hook data
  const dynEnergyForTiles = liveDynEnergyJson ?? dynEnergyJson;
  const wvtrsForTiles = liveWvtrsJson ?? wvtrsJson;

  const genRate = numberOnly(dynEnergyForTiles?.tiles?.generationRate);
  const exRate = numberOnly(dynEnergyForTiles?.tiles?.exchangeRate);

  // ✅ Your /api/wvtrsPrice returns { priceUsd, updatedAt, ... }
  const wvtrsPrice = useMemo(() => {
    const priceUsd = wvtrsForTiles?.priceUsd;
    return formatUsdPrice(priceUsd);
  }, [wvtrsForTiles]);

  const vipSummary2024 = useMemo(() => {
    const tiles = Array.isArray(vip2024Json?.tiles) ? vip2024Json.tiles : [];
    return extractHistoricalSummaryFromTiles(tiles);
  }, [vip2024Json]);

  const vipSummary2025 = useMemo(() => {
    const tiles = Array.isArray(vip2025Json?.tiles) ? vip2025Json.tiles : [];
    return extractHistoricalSummaryFromTiles(tiles);
  }, [vip2025Json]);

  const vipSummaryLoading = false;

  // Warm session cache on landing load (and keep the top-right metrics hot every minute)
  useEffect(() => {
    const controller = new AbortController();

    const PREFETCH_URLS = [
      DYNAMIC_ENERGY_ENDPOINT,
      HISTORICAL_VIP_2024_ENDPOINT,
      HISTORICAL_VIP_2025_ENDPOINT,

      WVTRS_PRICE_ENDPOINT,

      "https://cache.vscango.com/api/walletBalances",
      "https://cache.vscango.com/api/teamVesting",
      "https://cache.vscango.com/api/Operators",
    ];

    warmSessionCache(PREFETCH_URLS, { signal: controller.signal }).catch(() => {});

    // ✅ Prime live state once on mount from whatever is already in cache
    try {
      setLiveDynEnergyJson(readCachedJson(DYNAMIC_ENERGY_ENDPOINT));
      setLiveWvtrsJson(readCachedJson(WVTRS_PRICE_ENDPOINT));
    } catch {}

    const t = setInterval(() => {
      warmSessionCache([WVTRS_PRICE_ENDPOINT, DYNAMIC_ENERGY_ENDPOINT], { signal: controller.signal })
        .then(() => {
          setLiveDynEnergyJson(readCachedJson(DYNAMIC_ENERGY_ENDPOINT));
          setLiveWvtrsJson(readCachedJson(WVTRS_PRICE_ENDPOINT));
        })
        .catch(() => {});
    }, TOKEN_PRICE_REFRESH_MS);

    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, []);

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  const buttonStyle = {
    cursor: "pointer",
    color: "#ffffff",
    fontWeight: 900,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.07)",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  };

  return (
    <SiteFrame
      isMobile={isMobile}
      searchValue=""
      onSearchChange={() => {}}
      showSearch={false}
      showMenuButton={false}
      rightSlot={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btnPop" onClick={() => setShowDonate(true)} style={buttonStyle} type="button">
            Donate
          </button>
        </div>
      }
      footerText="© 2026 vScan — All rights reserved"
    >
      <style>{`
        .pagePad {
          padding-left: clamp(12px, 4vw, 40px);
          padding-right: clamp(12px, 4vw, 40px);
        }
        .sectionTop {
          padding-top: clamp(18px, 4vw, 40px);
          padding-bottom: clamp(14px, 3vw, 26px);
        }

        .tilesGrid { align-items: stretch; }

        .tileLink {
          background-color: #6df2b2;
          border-radius: 14px;
          padding: 22px;
          color: #000;
          text-decoration: none;
          min-height: 160px;

          height: 100%;
          box-sizing: border-box;

          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          box-shadow: 0 0 25px rgba(109,242,178,0.35);
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;

          border: 0;
          cursor: pointer;

          appearance: none;
          -webkit-appearance: none;
        }
        .tileLink:hover {
          transform: translateY(-6px) scale(1.03);
          box-shadow: 0 0 35px rgba(109,242,178,0.75);
          filter: saturate(1.05);
        }
        .tileLink:active { transform: translateY(-2px) scale(1.015); }

        .yearCard {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          padding: 12px;
          cursor: pointer;
          color: #fff;
          font-weight: 950;
          text-align: left;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .yearCard:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(0,0,0,0.40); }
        .yearCard:active { transform: translateY(-1px); }

        .yearMetaGrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .yearMetaBox {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.20);
          padding: 10px 8px;
          text-align: center;
        }
        .yearMetaLabel {
          color: #cfcfcf;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
        }
        .yearMetaValue {
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .modalShell {
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(20,20,20,0.98), rgba(8,8,8,0.98));
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 18px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 22px rgba(109,242,178,0.18);
          overflow: hidden;
        }
        .modalHeader {
          background: linear-gradient(180deg, rgba(19,36,34,1), rgba(10,18,17,1));
          border-bottom: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 10px 18px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset;
        }
        .modalHeaderBtn {
          cursor: pointer;
          color: #ffffff;
          font-weight: 900;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.25);
          background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
        }

        .noHueFix { transform: translateZ(0); backface-visibility: hidden; }

        .metricGroupBreath {
          border-radius: 14px;
          padding: 6px;
          background: rgba(10,10,10,0.20);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 0 18px rgba(109,242,178,0.22);
          animation: metricBreath 2400ms ease-in-out infinite;
        }
        @keyframes metricBreath {
          0%   { box-shadow: 0 0 14px rgba(109,242,178,0.18); transform: translateZ(0); }
          50%  { box-shadow: 0 0 26px rgba(109,242,178,0.38); transform: translateZ(0); }
          100% { box-shadow: 0 0 14px rgba(109,242,178,0.18); transform: translateZ(0); }
        }

        .mobileMetricRow {
          margin-bottom: 12px;
        }

        /* ✅ Donation QR block */
        .donationQrWrap {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .donationQrImg {
          width: 180px;
          height: 180px;
          border-radius: 14px;
          background: #ffffff;
          padding: 10px;
          box-shadow: 0 14px 35px rgba(0,0,0,0.55),
                      0 0 0 1px rgba(255,255,255,0.15) inset,
                      0 0 18px rgba(109,242,178,0.18);
          image-rendering: pixelated;
        }
        .donationQrHint {
          color: rgba(255,255,255,0.70);
          font-size: 11px;
          font-weight: 900;
          text-align: center;
        }
      `}</style>

      <section className="pagePad sectionTop">
        {isMobile && (
          <div className="mobileMetricRow" style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className="metricGroupBreath" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <MiniMetric label="wVTRS" value={wvtrsPrice} />
              <MiniMetric label="Gen Rate" value={genRate} />
              <MiniMetric label="Ex Rate" value={exRate} />
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 260 }}>
            <h2 style={{ fontSize: "2.2rem", marginBottom: 10 }}>Welcome to vScan</h2>
            <p style={{ fontSize: "1.1rem", color: "#cfcfcf", maxWidth: 700, margin: 0 }}>
              Your central hub for Vitreus chain data, wallet analytics, operator dashboards, and network metrics.
            </p>
          </div>

          {!isMobile && (
            <div style={{ marginLeft: "auto", display: "flex", justifyContent: "flex-end" }}>
              <div className="metricGroupBreath" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <MiniMetric label="wVTRS" value={wvtrsPrice} />
                <MiniMetric label="Gen Rate" value={genRate} />
                <MiniMetric label="Ex Rate" value={exRate} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ✅ No disclaimer -> no extra bottom padding needed */}
      <section className="pagePad" style={{ flexGrow: 1, paddingBottom: 18 }}>
        <div
          className="tilesGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          {sites.map((site) => {
            if (site.isYearPicker) {
              return (
                <button key={site.name} className="tileLink" type="button" onClick={() => setShowHistoricalVipPicker(true)}>
                  <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>{site.name}</h3>
                  <p style={{ marginTop: 12, fontSize: "0.95rem", lineHeight: 1.4, opacity: 0.9 }}>{site.description}</p>
                </button>
              );
            }

            return (
              <a key={site.name} href={site.url} className="tileLink">
                <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>{site.name}</h3>
                <p style={{ marginTop: 12, fontSize: "0.95rem", lineHeight: 1.4, opacity: 0.9 }}>{site.description}</p>
              </a>
            );
          })}
        </div>
      </section>

      {/* Donate Modal */}
      {showDonate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDonate(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.OVERLAY,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
            boxSizing: "border-box",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="modalShell noHueFix" style={{ width: "100%", maxWidth: 560 }}>
            <div className="modalHeader" style={{ padding: "12px 12px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <button onClick={() => setShowDonate(false)} className="btnPop modalHeaderBtn" type="button">
                Close
              </button>
            </div>

            <div style={{ padding: 14 }}>
              <div style={{ color: "#cfcfcf", fontSize: 13, lineHeight: 1.4, textAlign: "center", marginBottom: 12 }}>
                If you find this information useful, please consider donating to support my efforts. Thank you!
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontWeight: 950, color: "#e9fff5", textAlign: "center" }}>VTRS or gVolts</div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => copyToClipboard(donationAddress)}
                    title="Copy address"
                    aria-label="Copy address"
                    type="button"
                    className="btnPop"
                    style={{
                      cursor: "pointer",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#ffffff",
                      padding: "8px 10px",
                      lineHeight: 1,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    ⧉
                  </button>

                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      color: "#ffffff",
                      fontWeight: 900,
                      fontSize: 12,
                      wordBreak: "break-all",
                      textAlign: "center",
                    }}
                  >
                    {donationAddress}
                  </span>
                </div>

                {/* ✅ QR code always visible under the address (LOCAL, instant) */}
                <div className="donationQrWrap">
                  {donationQrDataUrl ? (
                    <img className="donationQrImg" src={donationQrDataUrl} alt="Donation address QR code" decoding="sync" />
                  ) : (
                    <div className="donationQrHint">Generating QR…</div>
                  )}
                  <div className="donationQrHint">Scan to copy the address</div>
                </div>
              </div>

              <div style={{ height: 6 }} />
            </div>
          </div>
        </div>
      )}

      {/* Historical VIP Picker Modal */}
      {showHistoricalVipPicker && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowHistoricalVipPicker(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.OVERLAY,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
            boxSizing: "border-box",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="modalShell noHueFix" style={{ width: "100%", maxWidth: 720 }}>
            <div className="modalHeader" style={{ padding: "12px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 950 }}>Historical VIP</div>
              <button onClick={() => setShowHistoricalVipPicker(false)} className="btnPop modalHeaderBtn" type="button">
                Close
              </button>
            </div>

            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  className="yearCard btnPop"
                  onClick={() => {
                    setShowHistoricalVipPicker(false);
                    window.location.href = "/historical-vip/2025";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 16 }}>2025</div>
                    <div style={{ color: "#cfcfcf", fontSize: 12, fontWeight: 900 }}>Open →</div>
                  </div>

                  <div className="yearMetaGrid">
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">VIP Members</div>
                      <div className="yearMetaValue">{vipSummary2025.vipMembers}</div>
                    </div>
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">VIPP Members</div>
                      <div className="yearMetaValue">{vipSummary2025.vippMembers}</div>
                    </div>
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">% Claimed</div>
                      <div className="yearMetaValue">{vipSummary2025.pctClaimed}</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="yearCard btnPop"
                  onClick={() => {
                    setShowHistoricalVipPicker(false);
                    window.location.href = "/historical-vip/2024";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 16 }}>2024</div>
                    <div style={{ color: "#cfcfcf", fontSize: 12, fontWeight: 900 }}>Open →</div>
                  </div>

                  <div className="yearMetaGrid">
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">VIP Members</div>
                      <div className="yearMetaValue">{vipSummary2024.vipMembers}</div>
                    </div>
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">VIPP Members</div>
                      <div className="yearMetaValue">{vipSummary2024.vippMembers}</div>
                    </div>
                    <div className="yearMetaBox">
                      <div className="yearMetaLabel">% Claimed</div>
                      <div className="yearMetaValue">{vipSummary2024.pctClaimed}</div>
                    </div>
                  </div>
                </button>
              </div>

              <div style={{ height: 4 }} />
            </div>
          </div>
        </div>
      )}
    </SiteFrame>
  );
}
