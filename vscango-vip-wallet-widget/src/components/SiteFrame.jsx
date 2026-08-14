// SiteFrame.jsx — COMPLETE COPY/PASTE REPLACEMENT
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ConnectWalletButton from "./wallet/ConnectWalletButton.jsx";

export const HEADER_BG = "#132422";
export const HEADER_HEIGHT_DESKTOP = 76;
export const HEADER_HEIGHT_MOBILE = 58;
export const SHOW_PRO_AUTH_BUTTONS = true;

// ✅ Footer is fixed again; keep height constant for layout padding
export const FOOTER_HEIGHT = 28;

/**
 * Global z-index layers (single source of truth)
 */
export const Z = {
  BG: 0,
  CONTENT: 1,
  HEADER: 1000,
  FOOTER: 1000,
  OVERLAY: 9000,
  MODAL: 9100,
  POPOVER: 9200,
};

/** Shared header button look so all header buttons match exactly. */
export const HEADER_BUTTON_STYLE = {
  cursor: "pointer",
  color: "#ffffff",
  fontWeight: 900,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  position: "relative",
  overflow: "hidden",
  userSelect: "none",
};

/**
 * Reusable mobile "scroll left/right" hint overlay for horizontally scrollable areas.
 */
export function ScrollHintArrows({
  targetRef,
  enabled = true,
  isMobile = false,
  zIndex = 60,
  edgeFadeWidth = 46,
  arrowSize = 22,
  scrollByPx = 260,
}) {
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    if (!enabled || !isMobile) return;
    const el = targetRef?.current;
    if (!el) return;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 2;
      setHasOverflow(overflow);
      if (!overflow) {
        setCanLeft(false);
        setCanRight(false);
        return;
      }
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft < max - 2);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const t = setTimeout(update, 50);

    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [enabled, isMobile, targetRef]);

  if (!enabled || !isMobile || !hasOverflow) return null;

  const baseEdge = {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: edgeFadeWidth,
    zIndex,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  };

  const arrowBtn = (active) => ({
    pointerEvents: active ? "auto" : "none",
    opacity: active ? 0.95 : 0.35,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))",
    width: arrowSize + 10,
    height: arrowSize + 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(233,255,245,0.98)",
    fontWeight: 950,
    lineHeight: 1,
    boxShadow: "0 10px 22px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  });

  return (
    <>
      <div
        style={{
          ...baseEdge,
          left: 0,
          background: "linear-gradient(90deg, rgba(0,0,0,0.60), rgba(0,0,0,0))",
        }}
      >
        <div
          style={arrowBtn(canLeft)}
          onClick={() => {
            const el = targetRef?.current;
            if (!el || !canLeft) return;
            el.scrollBy({ left: -scrollByPx, behavior: "smooth" });
          }}
          aria-hidden="true"
        >
          ‹
        </div>
      </div>

      <div
        style={{
          ...baseEdge,
          right: 0,
          background: "linear-gradient(270deg, rgba(0,0,0,0.60), rgba(0,0,0,0))",
        }}
      >
        <div
          style={arrowBtn(canRight)}
          onClick={() => {
            const el = targetRef?.current;
            if (!el || !canRight) return;
            el.scrollBy({ left: scrollByPx, behavior: "smooth" });
          }}
          aria-hidden="true"
        >
          ›
        </div>
      </div>
    </>
  );
}

function ClearableSearch({ value, onChange, placeholder, inputStyle }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingRight: 34 }} />
      {value ? (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          title="Clear"
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            width: 22,
            height: 22,
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.90)",
            fontWeight: 950,
            cursor: "pointer",
            lineHeight: "22px",
            padding: 0,
          }}
          type="button"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function HomeIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path
        d="M4 10.5L12 4l8 6.5v9a1.5 1.5 0 0 1-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 0 1 4 19.5v-9z"
        fill="none"
        stroke="rgba(233,255,245,0.95)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ===================== Historical VIP Picker Helpers ===================== */
const HISTORICAL_VIP_2024_ENDPOINT = "https://cache.vscango.com/api/2024vipPResults";
const HISTORICAL_VIP_2025_ENDPOINT = "https://cache.vscango.com/api/2025vipPResults";

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
  return { vipMembers: vipMembers || "—", vippMembers: vippMembers || "—", pctClaimed: pctClaimed || "—" };
}
async function fetchYearSummary(url, signal) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const json = await res.json();
  const tiles = Array.isArray(json?.tiles) ? json.tiles : [];
  return extractHistoricalSummaryFromTiles(tiles);
}

/* ===================== Active Route Helpers ===================== */
function getPathnameSafe() {
  try {
    return typeof window !== "undefined" ? window.location.pathname || "/" : "/";
  } catch {
    return "/";
  }
}
function isActiveHref(currentPath, href) {
  if (!href) return false;
  const a = String(currentPath || "/");
  const b = String(href || "/");
  if (a === b) return true;
  if (b !== "/" && a.startsWith(b + "/")) return true;
  return false;
}
function getSearchSafe() {
  try {
    return typeof window !== "undefined" ? window.location.search || "" : "";
  } catch {
    return "";
  }
}
function hasQueryParam(search, key, value = null) {
  try {
    const s = String(search || "");
    const params = new URLSearchParams(s.startsWith("?") ? s : `?${s}`);
    if (!params.has(key)) return false;
    if (value === null) return true;
    return params.get(key) === String(value);
  } catch {
    return false;
  }
}

/* ===================== Disclaimer (Landing-only) ===================== */
const LANDING_DISCLAIMER =
  "*Disclaimer: This content is not an official product or service of Vitreus. The information provided herein is based on publicly accessible data and is intended for general informational purposes only. While efforts are made to ensure its accuracy, the data may not be complete, current, or error-free. Use of this information is at your own discretion, and Vitreus nor the creator assumes responsibility for any consequences resulting from its use.*";

/* ===================== SiteFrame ===================== */
function ProAuthButtons({ onAnyClick, onOpenAccountModal, hideAccountButton = false, hideGetProButton = false } = {}) {
  const API_BASE = (import.meta?.env?.VITE_INDEX_API_BASE || "https://index.vscango.com").replace(/\/+$/, "");

  // No-flicker: default to Login, cache logged-in hint for a few minutes
  const CACHE_KEY = "vscan_auth_me_v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;

  const readCache = () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      if (!obj.ts || Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.me || null;
    } catch {
      return null;
    }
  };

  const writeCache = (me) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), me: me || null }));
    } catch {}
  };

  const [me, setMe] = useState(() => readCache());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!alive) return;
        if (r.ok) {
          const j = await r.json().catch(() => null);
          setMe(j || {});
          writeCache(j || {});
        } else {
          setMe(null);
          writeCache(null);
        }
      } catch {
        // keep cached state
      }
    })();
    return () => {
      alive = false;
    };
  }, [API_BASE]);

  const isLoggedIn = !!me;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {hideGetProButton ? null : (
        <a className="btnPop" href="/register" style={HEADER_BUTTON_STYLE} title="Get Pro" onClick={() => onAnyClick?.()}>
          Get Pro
        </a>
      )}

      {isLoggedIn ? (
        hideAccountButton ? null : (
          <button
            className="btnPop"
            type="button"
            style={HEADER_BUTTON_STYLE}
            title="Account"
            onClick={() => {
              onAnyClick?.();
              onOpenAccountModal?.();
            }}
          >
            Account
          </button>
        )
      ) : (
        <a className="btnPop" href="/login" style={HEADER_BUTTON_STYLE} title="Login" onClick={() => onAnyClick?.()}>
          Login
        </a>
      )}
    </div>
  );
}

export default function SiteFrame({
  children,
  isMobile,
  searchValue,
  onSearchChange,
  showSearch = true,
  searchPlaceholder = "Search",
  rightSlot = null,
  footerText = "© 2026 vScan — All rights reserved",
  enableAnimatedBackground = true,
  showMenuButton = true,
  showHeaderSearch = true,
  contentMaxWidth = 2400,
  menuItems = [
    { label: "Dynamic Energy", href: "/dynamic-energy" },
    { label: "Explorer", href: "/explorer" },
    { label: "Bridge", href: "/bridge" },
    { label: "Wallets", href: "/wallet-balances" },
    { label: "Team Vesting", href: "/team-vesting" },
    { label: "Historical VIP", action: "OPEN_HISTORICAL_VIP_PICKER" },
    { label: "Operators", href: "/operators" },
  ],
  enableHistoricalVipPicker = true,
}) {
  // ✅ ONLY show header search on these routes:
  const __pathRaw = typeof window !== "undefined" && window.location ? window.location.pathname : "";
  const __path = String(__pathRaw || "/").toLowerCase();
  const __searchAllow =
    __path === "/wallet-balances" ||
    __path.startsWith("/wallet-balances/") ||
    __path === "/team-vesting" ||
    __path.startsWith("/team-vesting/") ||
    __path === "/operators" ||
    __path.startsWith("/operators/") ||
    __path === "/historical-vip/2024" ||
    __path.startsWith("/historical-vip/2024/") ||
    __path === "/historical-vip/2025" ||
    __path.startsWith("/historical-vip/2025/");
  const __effectiveHeaderSearch = !!showHeaderSearch && __searchAllow;

  // ✅ Only show the wallet connect button on VIP/VIPP pages.
  const VIP_WALLET_PATHS = ["/historical-vip", "/vip-claim"];
  const __isVipPage = VIP_WALLET_PATHS.some((p) => __path === p || __path.startsWith(p + "/"));

  const __isAccountRoute = __path === "/account";

  // ✅ Hide Get Pro + Account/Login buttons on /account, /login, /register, /registertest
  const __isAuthRoute = __path === "/login" || __path === "/register";
  const __hideProAuthOnAccount = __isAccountRoute || __isAuthRoute;

  // ✅ If pages forget to pass isMobile, detect it here so mobile-only rules are consistent
  const [__autoMobile, set__autoMobile] = useState(() => {
    if (typeof isMobile === "boolean") return isMobile;
    try {
      return window.matchMedia("(max-width: 860px)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof isMobile === "boolean") return;
    let mq;
    try {
      mq = window.matchMedia("(max-width: 860px)");
    } catch {
      return;
    }
    const onChange = () => set__autoMobile(!!mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [isMobile]);

  const __isMobile = typeof isMobile === "boolean" ? isMobile : __autoMobile;
  const headerH = __isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
  const buttonStyle = useMemo(() => ({ ...HEADER_BUTTON_STYLE }), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showHistoricalVipPicker, setShowHistoricalVipPicker] = useState(false);
  const [vipSummary2024, setVipSummary2024] = useState({ vipMembers: "—", vippMembers: "—", pctClaimed: "—" });
  const [vipSummary2025, setVipSummary2025] = useState({ vipMembers: "—", vippMembers: "—", pctClaimed: "—" });
  const [vipSummaryLoading, setVipSummaryLoading] = useState(false);

  // Track current path so the menu can highlight the active page
  const [currentPath, setCurrentPath] = useState(() => getPathnameSafe());

  // ===================== Account Modal (iframe) =====================
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountFrameLoaded, setAccountFrameLoaded] = useState(false);
  const prevHrefRef = useRef(null);

  // ✅ IMPORTANT: modal=1 is ONLY for the IFRAME so Account.jsx can render without SiteFrame.
  const ACCOUNT_IFRAME_URL = "/account?modal=1&embed=1";

  // ✅ Modal state represented by hash (prevents refresh "no header" trap)
  const ACCOUNT_HASH = "#account";

  // ✅ Shared “never white” background
  const NEVER_WHITE_BG = useMemo(
    () =>
      "radial-gradient(800px 500px at 12% 18%, rgba(109,242,178,0.12), transparent 60%)," +
      "radial-gradient(900px 600px at 78% 28%, rgba(109,242,178,0.10), transparent 62%)," +
      "radial-gradient(900px 600px at 60% 86%, rgba(109,242,178,0.08), transparent 62%)," +
      "linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,1))",
    []
  );

  // ✅ BOOT iframe srcDoc (this is the always-visible "never white" layer)
  const bootIframeSrcDoc = useMemo(() => {
    const bg = NEVER_WHITE_BG.replace(/"/g, '\\"');
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="dark" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin:0; padding:0; height:100%; background:#000; }
    body {
      background: ${bg};
      color:#fff;
      font: 800 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      overflow:hidden;
    }
    .boot {
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      color: rgba(255,255,255,.75);
      text-shadow: 0 0 10px rgba(109,242,178,0.10);
    }
    .boot::before{
      content:"";
      position:fixed;
      inset:-20%;
      background: repeating-linear-gradient(
        115deg,
        rgba(109,242,178,0.00) 0px,
        rgba(109,242,178,0.00) 14px,
        rgba(109,242,178,0.07) 18px,
        rgba(109,242,178,0.00) 22px
      );
      opacity: 0.32;
      filter: blur(1px);
      animation: vscanFlow 16s linear infinite;
      pointer-events:none;
    }
    @keyframes vscanFlow { from { transform: translate3d(-4%, -2%, 0) } to { transform: translate3d(4%, 2%, 0) } }
  </style>
</head>
<body>
  <div class="boot">Loading account…</div>
</body>
</html>`;
  }, [NEVER_WHITE_BG]);

  // ✅ Force document background immediately (helps eliminate any residual white flash)
  useLayoutEffect(() => {
    try {
      document.documentElement.style.background = NEVER_WHITE_BG;
      document.body.style.background = NEVER_WHITE_BG;
      document.documentElement.style.backgroundColor = "#000";
      document.body.style.backgroundColor = "#000";
    } catch {}
  }, [NEVER_WHITE_BG]);

  const openAccountModal = () => {
    setAccountFrameLoaded(false);
    setAccountModalOpen(true);
    setMenuOpen(false);

    try {
      prevHrefRef.current = window.location.pathname + window.location.search + window.location.hash;
      window.requestAnimationFrame(() => {
        try {
          if (window.location.hash !== ACCOUNT_HASH) {
            window.history.pushState({ vscanModal: "account" }, "", window.location.pathname + window.location.search + ACCOUNT_HASH);
          }
        } catch {}
      });
    } catch {}
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setAccountFrameLoaded(false);

    try {
      const prev = prevHrefRef.current;
      if (typeof prev === "string" && prev.length) {
        window.history.replaceState({}, "", prev);
      } else {
        const url = new URL(window.location.href);
        if (url.hash === ACCOUNT_HASH) {
          url.hash = "";
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }
      }
    } catch {}
  };

  // ✅ Auto-open modal on direct load if URL hash is #account
  useEffect(() => {
    try {
      if (window.location.hash === ACCOUNT_HASH && !accountModalOpen) {
        setAccountFrameLoaded(false);
        setAccountModalOpen(true);
      }
      if (window.location.hash !== ACCOUNT_HASH && accountModalOpen) {
        setAccountModalOpen(false);
        setAccountFrameLoaded(false);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Close modal on back button / popstate / hashchange
  useEffect(() => {
    const onPop = () => {
      try {
        if (accountModalOpen && window.location.hash !== ACCOUNT_HASH) {
          setAccountModalOpen(false);
          setAccountFrameLoaded(false);
        }
      } catch {}
      setCurrentPath(getPathnameSafe());
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [accountModalOpen]);

  // Reset load state when opening
  useEffect(() => {
    if (!accountModalOpen) return;
    setAccountFrameLoaded(false);
  }, [accountModalOpen]);

  // ===================== Header Search Persistence (per-route) =====================
  const SEARCH_LS_PREFIX = "vscan:headerSearch:";
  const pageSearchKey = useMemo(() => {
    try {
      const p = typeof window !== "undefined" ? window.location.pathname : "";
      return `${SEARCH_LS_PREFIX}${p || "/"}`;
    } catch {
      return `${SEARCH_LS_PREFIX}/`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!showSearch) return;
    if (typeof onSearchChange !== "function") return;
    try {
      const raw = localStorage.getItem(pageSearchKey);
      if (raw !== null) onSearchChange(raw);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSearchKey, showSearch]);

  useEffect(() => {
    if (!showSearch) return;
    try {
      localStorage.setItem(pageSearchKey, String(searchValue ?? ""));
    } catch {}
  }, [pageSearchKey, searchValue, showSearch]);

  // =============================================================================

  useEffect(() => {
    if (!enableHistoricalVipPicker) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setVipSummaryLoading(true);
        const [s2024, s2025] = await Promise.allSettled([
          fetchYearSummary(HISTORICAL_VIP_2024_ENDPOINT, controller.signal),
          fetchYearSummary(HISTORICAL_VIP_2025_ENDPOINT, controller.signal),
        ]);
        if (cancelled) return;
        if (s2024.status === "fulfilled") setVipSummary2024(s2024.value);
        if (s2025.status === "fulfilled") setVipSummary2025(s2025.value);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setVipSummaryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enableHistoricalVipPicker]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const anyOpen = menuOpen || showHistoricalVipPicker || accountModalOpen;
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, showHistoricalVipPicker, accountModalOpen]);

  const headerBg = useMemo(() => "linear-gradient(180deg, rgba(19,36,34,1), rgba(10,18,17,1))", []);

  // ✅ uniform heights
  const HEADER_CTL_H = 34;
  const MENU_ITEM_H = 42;

  const menuCtlBtn = {
    ...buttonStyle,
    width: 44,
    height: HEADER_CTL_H,
    padding: 0,
  };

  // ✅ Menu item style helpers (active vs normal)
  const menuItemBase = (active) => ({
    textDecoration: "none",
    color: "#ffffff",
    fontWeight: 950,
    borderRadius: 12,
    minHeight: MENU_ITEM_H,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0 12px",
    boxSizing: "border-box",
    border: active ? "1px solid rgba(109,242,178,0.46)" : "1px solid rgba(255,255,255,0.14)",
    background: active
      ? "linear-gradient(180deg, rgba(109,242,178,0.16), rgba(255,255,255,0.06))"
      : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
    boxShadow: active
      ? "0 14px 26px rgba(0,0,0,0.35), 0 0 0 1px rgba(109,242,178,0.16) inset, 0 0 18px rgba(109,242,178,0.18)"
      : "0 10px 18px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset",
  });

  // “Historical VIP” is “active” for any /historical-vip/* route
  const historicalVipActive = useMemo(() => {
    const p = String(currentPath || "/");
    return p === "/historical-vip" || p.startsWith("/historical-vip/");
  }, [currentPath]);

  const showLandingDisclaimer = __path === "/";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        position: "relative",
        paddingBottom: FOOTER_HEIGHT,
      }}
    >
      <style>{`
        html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; background: #000; }
        *, *::before, *::after { box-sizing: border-box; }

        .btnPop { transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease;
          position: relative; overflow: hidden; isolation: isolate; -webkit-tap-highlight-color: transparent; }
        .btnPop::before { content: ""; position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.00) 55%);
          opacity: 0.25; pointer-events: none; }
        .btnPop:hover { transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 20px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 14px rgba(109,242,178,0.18);
          background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08)); }
        .btnPop:active { transform: translateY(0px) scale(0.995); }
        .btnPop:focus { outline: none; }

        .vscanHeaderBar { background: ${headerBg}; border-bottom: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 10px 18px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.05) inset; }
        .vscanFooterBar { background: ${headerBg}; border-top: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 -10px 18px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.05) inset; }

        .vscanFooterFixed {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: ${Z.FOOTER};
        }

        .vscanBg { position: fixed; inset: 0; z-index: ${Z.BG}; pointer-events: none; opacity: 0.55;
          background:
            radial-gradient(800px 500px at 12% 18%, rgba(109,242,178,0.12), transparent 60%),
            radial-gradient(900px 600px at 78% 28%, rgba(109,242,178,0.10), transparent 62%),
            radial-gradient(900px 600px at 60% 86%, rgba(109,242,178,0.08), transparent 62%),
            linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.40));
          animation: vscanPulse 10s ease-in-out infinite;
        }
        @keyframes vscanPulse {
          0% { opacity: 0.40; transform: translate3d(0,0,0) scale(1); }
          50% { opacity: 0.62; transform: translate3d(0,-6px,0) scale(1.01); }
          100% { opacity: 0.40; transform: translate3d(0,0,0) scale(1); }
        }
        .vscanBg::after {
          content: ""; position: absolute; inset: -20%;
          background: repeating-linear-gradient(
            115deg,
            rgba(109,242,178,0.00) 0px,
            rgba(109,242,178,0.00) 14px,
            rgba(109,242,178,0.07) 18px,
            rgba(109,242,178,0.00) 22px
          );
          opacity: 0.35; filter: blur(1px); animation: vscanFlow 16s linear infinite;
        }
        @keyframes vscanFlow { from { transform: translate3d(-4%, -2%, 0) } to { transform: translate3d(4%, 2%, 0) } }

        .vscanContent { position: relative; }

        @keyframes menuDrop {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0px) scale(1); }
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
          min-height: ${HEADER_CTL_H}px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .noHueFix { transform: translateZ(0); backface-visibility: hidden; }

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

        .yearMetaGrid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .yearMetaBox { border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.20); padding: 10px 8px; text-align: center; }
        .yearMetaLabel { color: #cfcfcf; font-size: 11px; font-weight: 900; margin-bottom: 6px; white-space: nowrap; }
        .yearMetaValue { color: #ffffff; font-size: 14px; font-weight: 950; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .menuHeaderAuthMobile { display: flex; gap: 8px; align-items: center; }
        @media (min-width: 861px){ .menuHeaderAuthMobile { display: none; } }

        /* Two-layer account frames */
        .frameLayer {
          position: absolute;
          inset: 0;
          border: 0;
          width: 100%;
          height: 100%;
          display: block;
          background: ${NEVER_WHITE_BG};
          background-color: #000;
        }
        .realFrame {
          opacity: 0;
          transition: opacity 180ms ease;
        }
        .realFrame.isLoaded {
          opacity: 1;
        }
      `}</style>

      {enableAnimatedBackground ? <div className="vscanBg" aria-hidden="true" /> : null}

      <header
        className="vscanHeaderBar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: headerH,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: __isMobile ? "10px 12px" : "14px 18px",
          boxSizing: "border-box",
          zIndex: Z.HEADER,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: __isMobile ? "1.35rem" : "1.65rem",
            fontWeight: 900,
            flexShrink: 0,
            textShadow: "0 0 10px rgba(109,242,178,0.10)",
          }}
        >
          vScan
        </div>

        {!!showSearch && !!__effectiveHeaderSearch ? (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
            <div style={{ width: "min(680px, 100%)", minWidth: 0 }}>
              <ClearableSearch
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                inputStyle={{
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  padding: "9px 11px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.18))",
                  color: "#ffffff",
                  outline: "none",
                  fontSize: 14,
                  boxShadow: "0 10px 18px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06) inset",
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {SHOW_PRO_AUTH_BUTTONS &&
          !__hideProAuthOnAccount &&
          (!__isMobile ? (
            <ProAuthButtons onOpenAccountModal={openAccountModal} />
          ) : __path === "/" ? (
            <ProAuthButtons onOpenAccountModal={openAccountModal} />
          ) : null)}

          {rightSlot}

          {__isVipPage ? <ConnectWalletButton /> : null}

          {showMenuButton ? (
            <button
              className="btnPop"
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              title="Menu"
              style={{
                ...buttonStyle,
                width: 44,
                height: 34,
                paddingLeft: 0,
                paddingRight: 0,
              }}
            >
              <span style={{ width: 18, height: 14, display: "inline-flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ height: 2, borderRadius: 2, background: "rgba(233,255,245,0.95)" }} />
                <span style={{ height: 2, borderRadius: 2, background: "rgba(233,255,245,0.95)" }} />
                <span style={{ height: 2, borderRadius: 2, background: "rgba(233,255,245,0.95)" }} />
              </span>
            </button>
          ) : null}
        </div>
      </header>

      {/* ===== Menu ===== */}
      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.OVERLAY,
            background: "rgba(0,0,0,0.68)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: __isMobile ? 12 : 18,
              top: headerH + 10,
              width: __isMobile ? "min(92vw, 360px)" : 320,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(8,8,8,0.98))",
              boxShadow: "0 18px 55px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07) inset",
              overflow: "hidden",
              animation: "menuDrop 170ms ease-out",
              transformOrigin: "top right",
            }}
          >
            <div
              style={{
                background: headerBg,
                padding: "10px 12px",
                fontWeight: 950,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxShadow: "0 10px 18px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
              }}
            >
              <a className="btnPop" href="/" onClick={() => setMenuOpen(false)} aria-label="Home" title="Home" style={menuCtlBtn}>
                <HomeIcon size={24} />
              </a>

              <div className="menuHeaderAuthMobile">
                {__hideProAuthOnAccount ? null : (
                  <ProAuthButtons
                    onAnyClick={() => setMenuOpen(false)}
                    onOpenAccountModal={() => {
                      setMenuOpen(false);
                      openAccountModal();
                    }}
                  />
                )}
              </div>

              <button className="btnPop" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" title="Close" style={menuCtlBtn}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>×</span>
              </button>
            </div>

            <div style={{ padding: 10, display: "grid", gap: 8 }}>
              {menuItems.map((it) => {
                const isVipPicker = enableHistoricalVipPicker && it?.action === "OPEN_HISTORICAL_VIP_PICKER";
                if (isVipPicker) {
                  const active = historicalVipActive;
                  return (
                    <button
                      key={it.label}
                      className="btnPop"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowHistoricalVipPicker(true);
                      }}
                      style={menuItemBase(active)}
                    >
                      {it.label}
                    </button>
                  );
                }
                const active = isActiveHref(currentPath, it.href);
                return (
                  <a key={it.href || it.label} className="btnPop" href={it.href} onClick={() => setMenuOpen(false)} style={menuItemBase(active)}>
                    {it.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Content wrapper */}
      <div className="vscanContent" style={{ paddingTop: headerH + 14 }}>
        <div
          style={{
            width: "100%",
            maxWidth: __isMobile ? "100%" : contentMaxWidth,
            margin: "0 auto",
            paddingLeft: __isMobile ? 12 : 18,
            paddingRight: __isMobile ? 12 : 18,
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          {children}
        </div>

        {showLandingDisclaimer ? (
          <div
            style={{
              width: "100%",
              background: "#000",
              borderTop: "1px solid rgba(255,255,255,0.10)",
              borderBottom: "1px solid rgba(255,255,255,0.10)",
              padding: "10px 14px",
              boxSizing: "border-box",

              // ✅ Push disclaimer lower on big screens
              marginTop: __isMobile ? 18 : 48,

              // ✅ Keep clear of fixed footer
              marginBottom: FOOTER_HEIGHT,
            }}
          >
            <div
              style={{
                maxWidth: __isMobile ? "100%" : contentMaxWidth,
                margin: "0 auto",
                paddingLeft: __isMobile ? 0 : 18,
                paddingRight: __isMobile ? 0 : 18,
                boxSizing: "border-box",
                color: "rgba(255,255,255,0.78)",
                fontSize: 12,
                fontWeight: 800,
                lineHeight: 1.35,
              }}
            >
              {LANDING_DISCLAIMER}
            </div>
          </div>
        ) : null}
      </div>

      {/* ✅ FIXED Footer */}
      <footer
        className="vscanFooterBar vscanFooterFixed"
        style={{
          height: FOOTER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.8rem",
          fontWeight: 700,
          width: "100%",
        }}
      >
        {footerText}
      </footer>
      {/* ===== Historical VIP Picker ===== */}
      {enableHistoricalVipPicker && showHistoricalVipPicker && (
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
              {vipSummaryLoading && <div style={{ textAlign: "center", color: "#cfcfcf", fontSize: 12, marginBottom: 10 }}>Loading summaries…</div>}

              <div style={{ display: "grid", gridTemplateColumns: __isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
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

      {/* ===== Account Modal (two-layer iframe) ===== */}
      {accountModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeAccountModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.OVERLAY,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modalShell noHueFix"
            style={{
              width: "min(1100px, 96vw)",
              height: __isMobile ? "min(86vh, 760px)" : "min(86vh, 840px)",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#000",
              backgroundImage: NEVER_WHITE_BG,
            }}
          >
            <div
              className="modalHeader"
              style={{
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 950 }}>vScan Account</div>
              <button className="btnPop modalHeaderBtn" type="button" onClick={closeAccountModal}>
                Close
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: "relative",
                backgroundColor: "#000",
                backgroundImage: NEVER_WHITE_BG,
              }}
            >
              {/* Boot layer (always visible immediately; never white) */}
              <iframe
                title="Account boot"
                className="frameLayer"
                srcDoc={bootIframeSrcDoc}
                style={{
                  border: 0,
                  backgroundColor: "#000",
                  backgroundImage: NEVER_WHITE_BG,
                }}
              />

              {/* Real account layer (fades in after onLoad) */}
              <iframe
                key={accountModalOpen ? "account-open" : "account-closed"}
                title="Account"
                className={`frameLayer realFrame ${accountFrameLoaded ? "isLoaded" : ""}`}
                src={ACCOUNT_IFRAME_URL}
                onLoad={() => setAccountFrameLoaded(true)}
                style={{
                  border: 0,
                  backgroundColor: "#000",
                  backgroundImage: NEVER_WHITE_BG,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
