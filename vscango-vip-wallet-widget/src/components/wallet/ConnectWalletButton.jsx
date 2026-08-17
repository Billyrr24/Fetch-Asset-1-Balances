// ConnectWalletButton.jsx
// Drop-in header control. Renders "Connect Wallet" or a truncated address,
// matching the vScan header button + dropdown look already used elsewhere
// in SiteFrame.jsx. Does not require a Context Provider — it reads/writes
// the shared vitreusWalletStore singleton directly.

import React, { useEffect, useRef, useState } from "react";
import { HEADER_BUTTON_STYLE, Z } from "../SiteFrame.jsx";
import {
  subscribeWallet,
  connectExtension,
  connectVapp,
  disconnectWallet,
  tryRestoreWalletSession,
} from "../../vitreusWalletStore.js";
import { truncateAddress } from "../../vitreusChain.js";
import { isMobileBrowser } from "../../vitreusVappSession.js";

function VappQrModal({ qrValue, onOpenDeepLink, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(qrValue, {
        margin: 1,
        width: 280,
        color: { dark: "#0b0b0b", light: "#ffffff" },
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [qrValue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z.MODAL,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(8,8,8,0.98))",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06) inset",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 4 }}>Connect with vApp</div>
        <div style={{ color: "#9fb0ab", fontSize: 12, marginBottom: 14 }}>
          Scan with vApp's connect scanner.
        </div>

        <div
          style={{
            width: 280,
            height: 280,
            maxWidth: "100%",
            margin: "0 auto 14px",
            borderRadius: 12,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="vApp connect QR code" width={280} height={280} />
          ) : (
            <div style={{ color: "#888", fontSize: 12 }}>Generating QR…</div>
          )}
        </div>

        {isMobileBrowser() ? (
          <button
            type="button"
            className="btnPop"
            onClick={onOpenDeepLink}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(109,242,178,0.55)",
              background: "rgba(109,242,178,0.14)",
              color: "#fff",
              fontWeight: 900,
              marginBottom: 10,
            }}
          >
            Open vApp
          </button>
        ) : null}

        <button
          type="button"
          className="btnPop"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(0,0,0,0.25)",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ConnectWalletButton() {
  const [wallet, setWallet] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy Address");
  const rootRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeWallet(setWallet);
    tryRestoreWalletSession();
    return unsub;
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPickerOpen(false);
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!wallet) return null;

  const connected = wallet.status === "connected" && wallet.address;
  const connecting = wallet.status === "connecting";
  const showVappModal = connecting && !!wallet.vappQrValue;

  async function handleConnect(method) {
    setPickerOpen(false);
    try {
      if (method === "extension") await connectExtension();
      if (method === "vapp") await connectVapp();
    } catch {
      // error is already surfaced via wallet.error from the store
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Address"), 1500);
    } catch {
      // clipboard may be unavailable; no-op
    }
  }

  const dropdownStyle = {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    minWidth: 220,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(8,8,8,0.98))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.06) inset",
    padding: 8,
    zIndex: Z.POPOVER,
  };

  const dropdownItemStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 6,
  };

  const mobile = isMobileBrowser();

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {!connected ? (
        mobile ? (
          <button
            type="button"
            className="btnPop"
            style={{ ...HEADER_BUTTON_STYLE, opacity: connecting ? 0.7 : 1 }}
            disabled={connecting}
            onClick={() => handleConnect("vapp")}
            title="Connect with the Vitreus vApp"
          >
            {connecting ? "Connecting…" : "Connect with vApp"}
          </button>
        ) : (
          <button
            type="button"
            className="btnPop"
            style={{ ...HEADER_BUTTON_STYLE, opacity: connecting ? 0.7 : 1 }}
            disabled={connecting}
            onClick={() => setPickerOpen((v) => !v)}
            title="Connect a Substrate wallet to view and claim VIP/VIPP rewards"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )
      ) : (
        <button
          type="button"
          className="btnPop"
          style={HEADER_BUTTON_STYLE}
          onClick={() => setAccountMenuOpen((v) => !v)}
          title={wallet.address}
        >
          {truncateAddress(wallet.address)}
        </button>
      )}

      {pickerOpen && !connected ? (
        <div style={dropdownStyle}>
          <div style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 900, padding: "4px 6px 8px" }}>
            CHOOSE HOW TO CONNECT
          </div>
          <button
            type="button"
            className="btnPop"
            style={dropdownItemStyle}
            onClick={() => handleConnect("extension")}
          >
            Browser Extension
            <div style={{ color: "#9fb0ab", fontWeight: 600, fontSize: 11, marginTop: 2 }}>
              Polkadot.js, Talisman, SubWallet
            </div>
          </button>
          <button
            type="button"
            className="btnPop"
            style={{ ...dropdownItemStyle, marginBottom: 0 }}
            onClick={() => handleConnect("vapp")}
          >
            Connect with vApp
            <div style={{ color: "#9fb0ab", fontWeight: 600, fontSize: 11, marginTop: 2 }}>
              Scan a QR code — no extension needed
            </div>
          </button>
        </div>
      ) : null}

      {!connected && wallet.error ? (
        <div
          style={{
            marginTop: 6,
            maxWidth: 260,
            color: "#ffb4b4",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {wallet.error}
        </div>
      ) : null}

      {accountMenuOpen && connected ? (
        <div style={dropdownStyle}>
          <button type="button" className="btnPop" style={dropdownItemStyle} onClick={handleCopy}>
            {copyLabel}
          </button>
          <div style={{ color: "#9fb0ab", fontSize: 11, fontWeight: 700, padding: "0 6px 8px" }}>
            Connected via {wallet.source === "extension" ? "browser extension" : "vApp"}
          </div>
          <button
            type="button"
            className="btnPop"
            style={{ ...dropdownItemStyle, marginBottom: 0, borderColor: "rgba(255,120,120,0.35)" }}
            onClick={async () => {
              setAccountMenuOpen(false);
              await disconnectWallet();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}

      {showVappModal ? (
        <VappQrModal
          qrValue={wallet.vappQrValue}
          onOpenDeepLink={() => wallet.vappOpenDeepLink?.()}
          onClose={() => disconnectWallet()}
        />
      ) : null}
    </div>
  );
}
