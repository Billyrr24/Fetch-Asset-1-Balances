// VipPResults2025.jsx — COMPLETE COPY/PASTE REPLACEMENT
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFrame, { FOOTER_HEIGHT, HEADER_BG, ScrollHintArrows } from "./components/SiteFrame.jsx";
import { readCachedJson, writeCachedJson } from "./utils/sessionJsonCache";

const ENDPOINT = "https://cache.vscango.com/api/2025vipPResults";

const PAGE_SIZE = 50;

const TABLE_HEADER_ROW_HEIGHT = 34;
const TABLE_BODY_ROW_HEIGHT = 30;

// ✅ Desktop defaults
const DEFAULT_COL_WIDTH = 140;
const FIRST_COL_WIDTH_DESKTOP_MIN = 240; // minimum
const FIRST_COL_WIDTH_DESKTOP_MAX = 640; // cap to avoid absurd widths

// ✅ Mobile defaults
const FIRST_COL_WIDTH_MOBILE = 160;

/* ===================== Focus row styling (same logic/style as your other pages) ===================== */
// ✅ FIX: keep sticky first column opaque by using a non-transparent overlay, not a translucent backgroundColor.
const FOCUS_ROW_OVERLAY = "rgba(255,255,255,0.10)"; // used as background-image overlay

function focusEdgeStyle({ isFirst, isLast }) {
  const edge = "rgba(255,255,255,0.48)";
  const soft = "rgba(255,255,255,0.35)";

  let boxShadow = `
    0 -1px 0 ${edge},
    0  1px 0 ${edge},
    0  0 18px ${soft}
  `;

  if (isFirst) boxShadow += `, -1px 0 0 ${edge}`;
  if (isLast) boxShadow += `,  1px 0 0 ${edge}`;

  return {
    boxShadow,
    animation: "focusPulse 2.8s ease-in-out infinite",
  };
}

function applyWordFixes(text) {
  return String(text || "")
    .replace(/\bGvolt\b/g, "gVolt")
    .replace(/\bGVolt\b/g, "gVolt")
    .replace(/\bVtrs\b/g, "VTRS")
    .replace(/\bVip\b/g, "VIP")
    .replace(/\bVipp\b/g, "VIPP");
}

function prettyHeader(key) {
  const base = String(key)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return applyWordFixes(base);
}

function isHexAddressLike(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return /^0x[0-9a-fA-F]+$/.test(t);
}

function asNumber(value) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isHexAddressLike(trimmed)) return null;

    const cleaned = trimmed.replace(/,/g, "").replace(/%/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function shouldBlank(value) {
  if (value === null || value === undefined || value === "") return true;
  if (value === "-") return true;

  if (typeof value === "number") return value === 0;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "-") return true;
    if (isHexAddressLike(trimmed)) return false;

    const cleaned = trimmed.replace(/,/g, "").replace(/%/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n === 0) return true;
  }

  return false;
}

/**
 * ✅ FIX: Percent handling that respects whether RAW value already contained '%'
 * - If raw string contained '%', numeric is already percent units (0.56% => 0.56)
 * - If no '%', and value is 0..1, treat as fraction and multiply by 100 (0.0056 => 0.56%)
 * - Otherwise treat as already percent units
 */
function hasPercentSign(rawValue) {
  return typeof rawValue === "string" && rawValue.includes("%");
}

function toPercentValue(rawValue) {
  const n = asNumber(rawValue);
  if (n === null) return null;

  // If the original raw value explicitly had a percent sign, it is already percent units.
  if (hasPercentSign(rawValue)) return n;

  // Otherwise, interpret 0..1 as a fraction (e.g. 0.0056 => 0.56%)
  if (n >= 0 && n <= 1) return n * 100;

  // Already percent units (e.g. 12.34)
  return n;
}

function isPercentColumn(colName) {
  const colStr = String(colName || "");
  const colLower = colStr.toLowerCase();

  return (
    colStr.includes("%") ||
    colLower.includes("%") ||
    colLower.includes("pct") ||
    colLower.includes("percent") ||
    colLower.includes("share")
  );
}

function formatOneDecimal(n) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatZeroDecimals(n) {
  if (!Number.isFinite(n)) return "";
  return Math.round(n).toLocaleString();
}

function formatCell(colName, rawValue) {
  if (shouldBlank(rawValue)) return "";

  if (typeof rawValue === "string" && isHexAddressLike(rawValue)) return rawValue;

  const colLower = String(colName || "").toLowerCase();

  // ✅ Percent columns
  if (isPercentColumn(colName)) {
    const pct = toPercentValue(rawValue);
    if (pct === null) return String(rawValue);
    return `${pct.toFixed(2)}%`;
  }

  if (colLower.includes("points") || colLower.includes("stake") || colLower.includes("count") || colLower.includes("wallet")) {
    const n = asNumber(rawValue);
    if (n === null) return String(rawValue);
    return formatZeroDecimals(n);
  }

  if (colLower.includes("gvolt")) {
    const n = asNumber(rawValue);
    if (n === null) return String(rawValue);
    return formatOneDecimal(n);
  }

  const n = asNumber(rawValue);
  if (n !== null) return n.toLocaleString();

  return String(rawValue);
}

function normalizeForSort(value, colName) {
  if (value === null || value === undefined || value === "") return { type: "blank", v: "" };

  // ✅ Sort percent columns by the true displayed percent value
  if (isPercentColumn(colName)) {
    const pct = toPercentValue(value);
    if (pct !== null) return { type: "number", v: pct };
  }

  const n = asNumber(value);
  if (n !== null) return { type: "number", v: n };

  return { type: "text", v: String(value).toLowerCase() };
}

/* ===================== Pagination ===================== */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function PaginationBar({ page, totalPages, onPrev, onNext, showingText, onSetPage }) {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(page));
      return;
    }
    const p = clamp(Math.trunc(n), 1, totalPages);
    onSetPage(p);
  };

  return (
    <div
      className="vscanCard"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 8px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 11, color: "#cfcfcf", fontWeight: 800, whiteSpace: "nowrap" }}>{showingText}</div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="btnPop"
          style={{
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.45 : 1,
            color: "#ffffff",
            fontWeight: 950,
            padding: "4px 8px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(0,0,0,0.25)",
            fontSize: 12,
            position: "relative",
          }}
          type="button"
        >
          Prev
        </button>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setDraft(String(page));
            }}
            inputMode="numeric"
            style={{
              width: 26,
              textAlign: "center",
              fontSize: 11,
              fontWeight: 950,
              color: "#e9fff5",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 8,
              padding: "3px 4px",
              outline: "none",
            }}
            aria-label="Page number"
            title="Type page and press Enter"
          />
          <div style={{ fontSize: 11, color: "#e9fff5", fontWeight: 950, minWidth: 34, textAlign: "center" }}>
            / {totalPages}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="btnPop"
          style={{
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.45 : 1,
            color: "#ffffff",
            fontWeight: 950,
            padding: "4px 8px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(0,0,0,0.25)",
            fontSize: 12,
            position: "relative",
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ===================== Tiles ===================== */
function TileGrid({ tiles, isMobile }) {
  if (!tiles || tiles.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 10,
        marginTop: 10,
        marginBottom: 12,
      }}
    >
      {tiles.map((t, i) => {
        const label = applyWordFixes(t?.label || `Metric ${i + 1}`);
        const value = String(t?.value ?? "");

        return (
          <div
            key={`${label}-${i}`}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: "12px 10px",
              textAlign: "center",
              opacity: 0.98,
            }}
          >
            <div style={{ color: "#cfcfcf", fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{label}</div>
            <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 950 }}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}

function YearSwitcher({ currentYear, isMobile }) {
  const btn = (year) => {
    const active = String(year) === String(currentYear);
    return (
      <button
        key={year}
        type="button"
        className="btnPop"
        onClick={() => (window.location.href = `/historical-vip/${year}`)}
        style={{
          cursor: "pointer",
          padding: "8px 12px",
          borderRadius: 12,
          border: active ? "1px solid rgba(109,242,178,0.70)" : "1px solid rgba(255,255,255,0.18)",
          background: active ? "rgba(109,242,178,0.14)" : "rgba(255,255,255,0.06)",
          color: "#ffffff",
          fontWeight: 950,
          minWidth: 82,
          position: "relative",
        }}
        title={active ? `${year} (current)` : `Go to ${year}`}
      >
        {year}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 10,
        flexWrap: "wrap",
        marginTop: isMobile ? 10 : 0,
      }}
    >
      {btn(2025)}
      {btn(2024)}
    </div>
  );
}

/* ===================== Best-match (keep ALL rows, find the best one) ===================== */
function findBestMatchIndex(rows, columns, search, firstColKey) {
  const s = String(search || "").trim().toLowerCase();
  if (!s) return -1;
  if (!rows || rows.length === 0) return -1;

  let bestIdx = -1;
  let bestScore = -1;

  const scoreText = (text) => {
    const t = String(text || "").toLowerCase();
    if (!t) return -1;
    if (t === s) return 1000;
    if (t.startsWith(s)) return 800 - Math.min(250, t.length - s.length);
    const pos = t.indexOf(s);
    if (pos >= 0) return 600 - Math.min(300, pos);
    return -1;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (firstColKey) {
      const sc = scoreText(row?.[firstColKey]);
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = i;
      }
      if (bestScore >= 1000) break;
    } else {
      let localBest = -1;
      for (const c of columns || []) {
        const sc = scoreText(row?.[c]);
        if (sc > localBest) localBest = sc;
      }
      if (localBest > bestScore) {
        bestScore = localBest;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}

export default function VipPResults2025() {
  const navigate = useNavigate();

  const cachedInit = useMemo(() => readCachedJson(ENDPOINT, Infinity), []);
  const hasCached = !!cachedInit;

  const [rowsRaw, setRowsRaw] = useState(() => (Array.isArray(cachedInit?.table?.rows) ? cachedInit.table.rows : []));
  const [headersRaw, setHeadersRaw] = useState(() =>
    Array.isArray(cachedInit?.table?.headers) ? cachedInit.table.headers : []
  );
  const [tiles, setTiles] = useState(() => (Array.isArray(cachedInit?.tiles) ? cachedInit.tiles : []));

  const [loading, setLoading] = useState(() => !hasCached);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);

  const tableCardRef = useRef(null);
  const scrollBoxRef = useRef(null);

  const [boxHeight, setBoxHeight] = useState(420);
  const [page, setPage] = useState(1);

  // ✅ Mobile tap-vs-scroll suppression for first column (prevents “scroll then release navigates”)
  const touchStartXYRef = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const MOVE_CANCEL_PX = 10;

  function goToWallet(addr) {
    const a = String(addr || "").trim();
    if (!isHexAddressLike(a)) return;
    navigate(`/wallet?addr=${encodeURIComponent(a)}`);
  }

  useEffect(() => {
    const onResize = () => {
      setViewportH(window.innerHeight);
      setIsMobile(window.matchMedia("(max-width: 760px)").matches);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!hasCached) {
          setLoading(true);
          setError("");
        } else {
          setError("");
        }

        const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

        const json = await res.json();
        if (cancelled) return;

        writeCachedJson(ENDPOINT, json);

        const h = Array.isArray(json?.table?.headers) ? json.table.headers : [];
        const r = Array.isArray(json?.table?.rows) ? json.table.rows : [];
        const t = Array.isArray(json?.tiles) ? json.tiles : [];

        setHeadersRaw(h);
        setRowsRaw(r);
        setTiles(t);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Unknown error");
      } finally {
        if (!cancelled && !hasCached) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hasCached]);

  const columns = useMemo(() => {
    const keySet = new Set();

    const headerList = headersRaw
      .map((h, idx) => (String(h || "").trim() ? String(h).trim() : `col_${idx + 1}`))
      .filter(Boolean);

    for (const h of headerList) keySet.add(h);

    for (const row of rowsRaw || []) {
      if (!row || typeof row !== "object") continue;
      for (const k of Object.keys(row)) keySet.add(k);
    }

    return Array.from(keySet);
  }, [rowsRaw, headersRaw]);

  const sortedRows = useMemo(() => {
    if (!rowsRaw || rowsRaw.length === 0) return [];
    if (!sortKey) return rowsRaw;

    const dirMul = sortDir === "asc" ? 1 : -1;
    const withIndex = rowsRaw.map((row, idx) => ({ row, idx }));

    withIndex.sort((a, b) => {
      const av = normalizeForSort(a.row?.[sortKey], sortKey);
      const bv = normalizeForSort(b.row?.[sortKey], sortKey);

      if (av.type === "blank" && bv.type !== "blank") return 1;
      if (bv.type === "blank" && av.type !== "blank") return -1;

      if (av.type === "number" && bv.type === "number") {
        if (av.v < bv.v) return -1 * dirMul;
        if (av.v > bv.v) return 1 * dirMul;
      } else {
        const cmp = String(av.v).localeCompare(String(bv.v));
        if (cmp !== 0) return cmp * dirMul;
      }

      return a.idx - b.idx;
    });

    return withIndex.map((x) => x.row);
  }, [rowsRaw, sortKey, sortDir]);

  const firstColKey = columns?.[0] || null;

  const firstColWidthDesktop = useMemo(() => {
    if (!firstColKey) return FIRST_COL_WIDTH_DESKTOP_MIN;

    let maxLen = 0;
    for (const r of sortedRows || []) {
      const v = String(r?.[firstColKey] ?? "");
      if (v.length > maxLen) maxLen = v.length;
    }

    const approx = Math.round(maxLen * 8.2 + 46);
    return clamp(approx, FIRST_COL_WIDTH_DESKTOP_MIN, FIRST_COL_WIDTH_DESKTOP_MAX);
  }, [sortedRows, firstColKey]);

  const bestMatchIdx = useMemo(() => {
    return findBestMatchIndex(sortedRows, columns, search, firstColKey);
  }, [sortedRows, columns, search, firstColKey]);

  useEffect(() => {
    const s = search.trim();
    const el = scrollBoxRef.current;
    if (!s) {
      setPage(1);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        });
      }
    }
  }, [search]);

  useEffect(() => {
    const s = search.trim();
    if (!s) return;
    if (bestMatchIdx < 0) return;

    const targetPage = Math.floor(bestMatchIdx / PAGE_SIZE) + 1;
    setPage(targetPage);
  }, [bestMatchIdx, search]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const pageSafe = clamp(page, 1, totalPages);

  useEffect(() => {
    if (pageSafe !== page) setPage(pageSafe);
  }, [pageSafe, page]);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, pageSafe]);

  useEffect(() => {
    const s = search.trim();
    const el = scrollBoxRef.current;
    if (!el) return;
    if (!s) return;
    if (bestMatchIdx < 0) return;

    const targetPage = Math.floor(bestMatchIdx / PAGE_SIZE) + 1;
    if (targetPage !== pageSafe) return;

    let cancelled = false;

    const centerOnce = () => {
      if (cancelled) return;
      const rowEl = el.querySelector(`[data-focus-row="1"]`);
      if (!rowEl) return;

      const elRect = el.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();

      const elCenterY = elRect.top + elRect.height / 2;
      const rowCenterY = rowRect.top + rowRect.height / 2;

      const deltaY = rowCenterY - elCenterY;
      if (Math.abs(deltaY) < Math.max(14, rowRect.height * 0.25)) return;

      let targetTop = el.scrollTop + deltaY;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      targetTop = Math.max(0, Math.min(targetTop, maxTop));

      el.scrollTo({ top: targetTop, left: el.scrollLeft, behavior: "smooth" });
    };

    requestAnimationFrame(centerOnce);

    let t1 = null;
    let t2 = null;
    let t3 = null;
    if (!isMobile) {
      t1 = setTimeout(() => requestAnimationFrame(centerOnce), 90);
      t2 = setTimeout(() => requestAnimationFrame(centerOnce), 180);
      t3 = setTimeout(() => requestAnimationFrame(centerOnce), 320);
    }

    return () => {
      cancelled = true;
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
    };
  }, [bestMatchIdx, pageSafe, search, isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const compute = () => {
      const el = tableCardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = rect.top;
      const safetyBottomPad = 12;
      const avail = window.innerHeight - FOOTER_HEIGHT - safetyBottomPad - top;
      setBoxHeight(Math.max(260, Math.floor(avail)));
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    const t = setTimeout(compute, 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, [isMobile, pageSafe, columns.length, loading, error]);

  function onHeaderClick(col) {
    if (sortKey !== col) {
      setSortKey(col);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

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

  const firstColWidth = isMobile ? FIRST_COL_WIDTH_MOBILE : firstColWidthDesktop;

  const isStickyFirstCol = !isMobile;

  const tableLayoutMode = "auto";

  const MOBILE_MIN_COL = 88;
  const mobileColWidth = (colIdx) => {
    if (colIdx === 0) return FIRST_COL_WIDTH_MOBILE;
    return MOBILE_MIN_COL;
  };

  const focusedLocalIdx = bestMatchIdx >= 0 && search.trim() ? bestMatchIdx - (pageSafe - 1) * PAGE_SIZE : -1;

  // ✅ FIX: helper to keep focused rows opaque (no see-through under sticky col)
  const cellBgStyle = (baseBg, isFocused) => ({
    backgroundColor: baseBg,
    backgroundImage: isFocused ? `linear-gradient(0deg, ${FOCUS_ROW_OVERLAY}, ${FOCUS_ROW_OVERLAY})` : "none",
  });

  return (
    <SiteFrame
      isMobile={isMobile}
      searchValue={search}
      onSearchChange={setSearch}
      showSearch={true}
      searchPlaceholder="Search Results"
      footerText="© 2026 vScan — All rights reserved"
    >
      <style>{`
        .scrollBox { overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-x pan-y; }
        .scrollBox::-webkit-scrollbar { width: 10px; height: 10px; }
        .scrollBox::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 10px; }
        .scrollBox::-webkit-scrollbar-track { background: rgba(255,255,255,0.06); }

        @keyframes focusPulse {
          0% {
            box-shadow:
              0 -1px 0 rgba(255,255,255,0.36),
              0  1px 0 rgba(255,255,255,0.36),
              0  0 14px rgba(255,255,255,0.22);
          }
          50% {
            box-shadow:
              0 -1px 0 rgba(255,255,255,0.56),
              0  1px 0 rgba(255,255,255,0.56),
              0  0 24px rgba(255,255,255,0.42);
          }
          100% {
            box-shadow:
              0 -1px 0 rgba(255,255,255,0.36),
              0  1px 0 rgba(255,255,255,0.36),
              0  0 14px rgba(255,255,255,0.22);
          }
        }
      `}</style>

      <div
        style={{
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: FOOTER_HEIGHT + 16,
          boxSizing: "border-box",
        }}
      >
        {/* ✅ FULL-WIDTH wrapper (no maxWidth cap) */}
        <div style={{ width: "100%", maxWidth: "none", margin: "0 auto" }}>
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <h1 style={{ margin: 0, fontSize: "1.6rem" }}>2025 VIP(P) Results</h1>

              {/* ✅ Claim tile */}
              <button
                type="button"
                className="btnPop"
                onClick={() => navigate("/vip-claim")}
                title="Connect your wallet and claim VIP/VIPP rewards"
                style={{
                  cursor: "pointer",
                  padding: "9px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(109,242,178,0.55)",
                  background: "rgba(109,242,178,0.14)",
                  color: "#ffffff",
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                  position: "relative",
                }}
              >
                Claim Rewards →
              </button>
            </div>

            <div style={{ marginTop: 2, marginBottom: 16 }}>
              <YearSwitcher currentYear={2025} isMobile={isMobile} />
            </div>

            {loading && <div style={{ padding: "10px 0", color: "#cfcfcf" }}>Loading…</div>}

            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: "#2a1111",
                  border: "1px solid #7a2a2a",
                  color: "#ffd1d1",
                  maxWidth: 900,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Failed to load results</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
              </div>
            )}
          </div>

          {!loading && !error && <TileGrid tiles={tiles} isMobile={isMobile} />}

          {!loading && !error && totalRows > 0 && (
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
              <PaginationBar
                page={pageSafe}
                totalPages={totalPages}
                onPrev={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                onNext={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                onSetPage={(p) => setPage(p)}
                showingText={`Showing ${(pageSafe - 1) * PAGE_SIZE + 1}-${Math.min(
                  pageSafe * PAGE_SIZE,
                  totalRows
                )} of ${totalRows.toLocaleString()}`}
              />
            </div>
          )}

          {!loading && !error && pageRows.length > 0 && (
            <div
              ref={tableCardRef}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                backgroundColor: "#0b0b0b",
                boxShadow:
                  "0 14px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(109,242,178,0.10) inset, 0 0 18px rgba(109,242,178,0.12)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ScrollHintArrows targetRef={scrollBoxRef} enabled={true} isMobile={isMobile} zIndex={75} />

              <div
                ref={scrollBoxRef}
                className="scrollBox"
                style={{
                  height: isMobile ? `${Math.max(360, viewportH - (FOOTER_HEIGHT + 260))}px` : `${boxHeight}px`,
                  paddingBottom: !isMobile ? 6 : 0,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    minWidth: isMobile
                      ? Math.max(720, firstColWidth + (columns.length - 1) * MOBILE_MIN_COL)
                      : Math.max(1200, firstColWidth + (columns.length - 1) * DEFAULT_COL_WIDTH),
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      minWidth: "100%",
                      borderCollapse: "collapse",
                      tableLayout: tableLayoutMode,
                    }}
                  >
                    <colgroup>
                      {columns.map((col, idx) => {
                        if (!isMobile) {
                          if (idx === 0) return <col key={col} style={{ width: firstColWidth }} />;
                          return <col key={col} style={{ width: DEFAULT_COL_WIDTH }} />;
                        }
                        return <col key={col} style={{ width: mobileColWidth(idx) }} />;
                      })}
                    </colgroup>

                    <thead>
                      <tr style={{ backgroundColor: HEADER_BG, height: TABLE_HEADER_ROW_HEIGHT }}>
                        {columns.map((col, idx) => {
                          const headerLabel = applyWordFixes(prettyHeader(col));

                          const baseStyle = {
                            position: "sticky",
                            top: 0,
                            zIndex: 60,
                            height: TABLE_HEADER_ROW_HEIGHT,
                            lineHeight: `${TABLE_HEADER_ROW_HEIGHT}px`,
                            padding: "0px 6px",
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            color: "#e9fff5",
                            borderBottom: "1px solid rgba(255,255,255,0.10)",
                            backgroundColor: HEADER_BG,
                            cursor: "pointer",
                            userSelect: "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          };

                          const stickyFirst =
                            !isStickyFirstCol || idx !== 0
                              ? {}
                              : {
                                  position: "sticky",
                                  top: 0,
                                  left: 0,
                                  zIndex: 140,
                                  backgroundColor: HEADER_BG,
                                  boxShadow: "3px 0 10px rgba(0,0,0,0.45), 2px 0 0 rgba(255,255,255,0.08)",
                                };

                          return (
                            <th
                              key={col}
                              onClick={() => onHeaderClick(col)}
                              title="Click to sort"
                              style={{ ...baseStyle, ...stickyFirst }}
                            >
                              {headerLabel}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {pageRows.map((row, rowIdx) => {
                        const baseBg = rowIdx % 2 === 0 ? "#0f0f0f" : "#151515";
                        const isFocused = search.trim() && rowIdx === focusedLocalIdx;
                        const isFocusRow = !!isFocused;

                        return (
                          <tr key={rowIdx} data-focus-row={isFocusRow ? "1" : undefined} style={{ height: TABLE_BODY_ROW_HEIGHT }}>
                            {columns.map((col, idx) => {
                              const raw = row?.[col];
                              const display = formatCell(col, raw);
                              const isAddr = typeof display === "string" && isHexAddressLike(display);

                              const isFirstCol = idx === 0;

                              const baseTd = {
                                height: TABLE_BODY_ROW_HEIGHT,
                                lineHeight: `${TABLE_BODY_ROW_HEIGHT}px`,
                                padding: "0px 6px",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                fontSize: 12,
                                color: "#f2f2f2",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: isFirstCol ? "clip" : "ellipsis",

                                // ✅ FIX: opaque base + optional overlay highlight
                                ...cellBgStyle(baseBg, isFocusRow),

                                ...(isFocusRow
                                  ? focusEdgeStyle({ isFirst: idx === 0, isLast: idx === columns.length - 1 })
                                  : {}),

                                ...(isFirstCol
                                  ? { WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }
                                  : {}),
                              };

                              const stickyFirst =
                                !isStickyFirstCol || idx !== 0
                                  ? {}
                                  : {
                                      position: "sticky",
                                      left: 0,
                                      zIndex: 110,
                                      // ✅ FIX: sticky cell stays opaque too
                                      ...cellBgStyle(baseBg, isFocusRow),
                                      boxShadow: "3px 0 10px rgba(0,0,0,0.45), 2px 0 0 rgba(255,255,255,0.08)",
                                    };

                              // ✅ Mobile first-column tap navigates to wallet; scroll gesture does NOT navigate
                              const mobileFirstColTapHandlers =
                                isMobile && isFirstCol && isAddr
                                  ? {
                                      onTouchStart: (e) => {
                                        const t = e.touches?.[0];
                                        if (!t) return;
                                        touchMovedRef.current = false;
                                        ignoreNextClickRef.current = false;
                                        touchStartXYRef.current = { x: t.clientX, y: t.clientY };
                                      },
                                      onTouchMove: (e) => {
                                        const t = e.touches?.[0];
                                        if (!t) return;
                                        const dx = Math.abs(t.clientX - touchStartXYRef.current.x);
                                        const dy = Math.abs(t.clientY - touchStartXYRef.current.y);
                                        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
                                          touchMovedRef.current = true;
                                          ignoreNextClickRef.current = true;
                                        }
                                      },
                                      onTouchEnd: () => {
                                        if (touchMovedRef.current) return;
                                        goToWallet(display);
                                      },
                                      onTouchCancel: () => {
                                        ignoreNextClickRef.current = true;
                                      },
                                      onClick: (e) => {
                                        if (ignoreNextClickRef.current) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          ignoreNextClickRef.current = false;
                                        }
                                      },
                                      style: { cursor: "pointer" },
                                    }
                                  : {};

                              // ✅ Desktop first-column click navigates to wallet
                              const desktopFirstColClickHandlers =
                                !isMobile && isFirstCol && isAddr
                                  ? {
                                      onClick: () => {
                                        goToWallet(display);
                                      },
                                      onKeyDown: (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          goToWallet(display);
                                        }
                                      },
                                      role: "button",
                                      tabIndex: 0,
                                      style: { cursor: "pointer" },
                                    }
                                  : {};

                              return (
                                <td
                                  key={`${col}-${idx}`}
                                  style={{
                                    ...baseTd,
                                    ...stickyFirst,
                                    ...(mobileFirstColTapHandlers.style || {}),
                                    ...(desktopFirstColClickHandlers.style || {}),
                                  }}
                                  {...(mobileFirstColTapHandlers.onTouchStart ? { onTouchStart: mobileFirstColTapHandlers.onTouchStart } : {})}
                                  {...(mobileFirstColTapHandlers.onTouchMove ? { onTouchMove: mobileFirstColTapHandlers.onTouchMove } : {})}
                                  {...(mobileFirstColTapHandlers.onTouchEnd ? { onTouchEnd: mobileFirstColTapHandlers.onTouchEnd } : {})}
                                  {...(mobileFirstColTapHandlers.onTouchCancel ? { onTouchCancel: mobileFirstColTapHandlers.onTouchCancel } : {})}
                                  {...(mobileFirstColTapHandlers.onClick ? { onClick: mobileFirstColTapHandlers.onClick } : {})}
                                  {...(!mobileFirstColTapHandlers.onClick && desktopFirstColClickHandlers.onClick
                                    ? { onClick: desktopFirstColClickHandlers.onClick }
                                    : {})}
                                  {...(desktopFirstColClickHandlers.onKeyDown ? { onKeyDown: desktopFirstColClickHandlers.onKeyDown } : {})}
                                  {...(desktopFirstColClickHandlers.role ? { role: desktopFirstColClickHandlers.role } : {})}
                                  {...(desktopFirstColClickHandlers.tabIndex !== undefined
                                    ? { tabIndex: desktopFirstColClickHandlers.tabIndex }
                                    : {})}
                                >
                                  {isAddr ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                      <button
                                        className="btnPop"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          await copyToClipboard(display);
                                        }}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        title="Copy"
                                        aria-label="Copy"
                                        type="button"
                                        style={{
                                          cursor: "pointer",
                                          borderRadius: 8,
                                          border: "1px solid rgba(255,255,255,0.22)",
                                          background: "rgba(255,255,255,0.08)",
                                          color: "#ffffff",
                                          padding: "4px 7px",
                                          lineHeight: 1,
                                          fontWeight: 900,
                                          flexShrink: 0,
                                          position: "relative",
                                        }}
                                      >
                                        ⧉
                                      </button>
                                      <span
                                        style={{
                                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                          color: "rgba(190,255,232,0.92)",
                                        }}
                                      >
                                        {display}
                                      </span>
                                    </span>
                                  ) : (
                                    display
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && totalRows === 0 && <div style={{ marginTop: 14, color: "#cfcfcf" }}>No results.</div>}
        </div>
      </div>
    </SiteFrame>
  );
}
