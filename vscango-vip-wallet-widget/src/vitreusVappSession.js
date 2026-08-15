// vitreusVappSession.js
// Vitreus's own custom wallet-pairing protocol — NOT WalletConnect.
// Reverse engineered from marketplace.vtrs.io / dao.vtrs.io's bundled JS
// and cross-checked against literal strings found in vApp's own compiled
// code (2026-08-15). Facts below are marked [CONFIRMED] where I directly
// observed them in live traffic/config or in vApp's binary, and [INFERRED]
// where I'm following the most sensible pattern but haven't seen it proven.
//
// Protocol summary:
//  [CONFIRMED] Socket.IO connection to wss://wallet-prod-be.vtrs.io.
//  [CONFIRMED] Client emits "initSession" with dApp metadata + a locally
//    generated session id.
//  [CONFIRMED] QR / deep link value is the literal string
//    "wallet_connect:<sessionId>".
//  [INFERRED]  Server emits "connected" back once vApp pairs, carrying the
//    account address (exact payload shape not directly observed).
//  [CONFIRMED] To request a signature for a specific action, client emits
//    "initSigningActionCall" with
//    {address, network, dAppMeta, txId, callName, data}.
//  [CONFIRMED] "claimRewards" is a real callName recognized by vApp's own
//    compiled code (found as a literal string). callName:"Claim" is a
//    *different*, already-observed action (energy-generation staking
//    payouts triggered by operators) — do not confuse the two.
//  [INFERRED]  data for claimRewards is {year: <number>} — the pallet call
//    only takes one u32 parameter, so this is the natural shape, but it
//    isn't textually confirmed.
//  [CONFIRMED] Result comes back via "sendSigningActionCallResult" (name
//    confirmed in vApp's binary); exact payload shape not directly
//    observed, so parsing below is defensive.
//  [CONFIRMED] On mobile, after emitting a signing request, the site
//    redirects to vApp's own deep link
//    (https://deeplink-dev.pages.dev/mobile, native vtrs://app/mobile)
//    with "?callName=<callName>" appended, to bring the app to the
//    foreground.
//
// Security model: identical in spirit to the extension path — vApp holds
// the key and signs internally. This code only ever sends a named action +
// plain-language arguments (e.g. "claim VIP rewards for year 2025") and
// receives back a pass/fail result; it never sees or handles a private key.

const WALLET_BACKEND_URL = "wss://wallet-prod-be.vtrs.io";

const DAPP_META = {
  name: "vScan",
  url: "https://vscango.com",
  description: "Vitreus VIP/VIPP rewards, wallet balances, and explorer",
  logoUrl: "https://vscango.com/favicon.png",
};

// [CONFIRMED] both from vApp's AndroidManifest.xml <intent-filter> entries,
// and actively used by marketplace.vtrs.io / dao.vtrs.io.
const VAPP_DEEP_LINK_BASE = {
  ios: "https://deeplink-dev.pages.dev/mobile",
  android: "https://deeplink-dev.pages.dev/mobile",
};

const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000; // vApp interactions are user-paced

function generateRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function getOS() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /iPhone|iPad|iPod/i.test(ua) ? "iOS" : "Android";
}

export function isMobileBrowser() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/** Opens vApp directly via its own deep link (no QR needed). */
export function openVappDeepLink(extraParams = {}) {
  const base = getOS() === "iOS" ? VAPP_DEEP_LINK_BASE.ios : VAPP_DEEP_LINK_BASE.android;
  const params = new URLSearchParams(extraParams).toString();
  window.location.href = params ? `${base}?${params}` : base;
}

let socket = null;
let currentSessionId = null;

async function getSocket() {
  if (socket && socket.connected) return socket;
  const { io } = await import("socket.io-client");
  socket = io(WALLET_BACKEND_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  return socket;
}

function safeParse(payload) {
  if (payload == null) return {};
  if (typeof payload !== "string") return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}

/**
 * Starts a new pairing session against vApp's backend.
 * Returns { qrValue, sessionId, waitForConnection, openDeepLink }.
 */
export async function startVappPairing() {
  const s = await getSocket();

  if (!s.connected) {
    await new Promise((resolve, reject) => {
      const onConnect = () => {
        s.off("connect_error", onError);
        resolve();
      };
      const onError = (err) => {
        s.off("connect", onConnect);
        reject(new Error(err?.message || "Could not reach vApp's connection service."));
      };
      s.once("connect", onConnect);
      s.once("connect_error", onError);
    });
  }

  currentSessionId = generateRandomId();
  s.emit("initSession", JSON.stringify({ ...DAPP_META, sessionId: currentSessionId }));

  const qrValue = `wallet_connect:${currentSessionId}`;

  const waitForConnection = () =>
    new Promise((resolve, reject) => {
      const cleanup = () => {
        s.off("connected", onConnected);
        s.off("error", onError);
        clearTimeout(timer);
      };
      const onConnected = (payload) => {
        const data = safeParse(payload);
        const address = data.address || data.walletInfo?.address || data.account;
        cleanup();
        if (!address) {
          reject(new Error("vApp connected but didn't return an address."));
          return;
        }
        resolve({ address, raw: data });
      };
      const onError = (payload) => {
        cleanup();
        const data = safeParse(payload);
        reject(new Error(data.message || data.raw || "vApp connection failed."));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for vApp to connect."));
      }, RESPONSE_TIMEOUT_MS);

      s.on("connected", onConnected);
      s.on("error", onError);
    });

  return {
    qrValue,
    sessionId: currentSessionId,
    waitForConnection,
    openDeepLink: () => openVappDeepLink({ sessionId: currentSessionId }),
  };
}

/**
 * Requests vApp sign + submit a named pallet call. vApp constructs the
 * actual extrinsic itself from callName+data; this code never builds or
 * signs anything — only sends the request and reads back the result.
 */
export async function requestActionCallSignature({ address, callName, data }) {
  const s = await getSocket();
  const txId = generateRandomId();

  const resultPromise = new Promise((resolve, reject) => {
    const onResult = (payload) => {
      const result = safeParse(payload);
      if (result.txId && result.txId !== txId) return; // a different in-flight request
      cleanup();
      if (result.status === "error" || result.error) {
        reject(new Error(result.error || result.message || "vApp rejected the request."));
      } else {
        resolve(result);
      }
    };
    const cleanup = () => {
      s.off("sendSigningActionCallResult", onResult);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for vApp to respond. Check the app for a pending request."));
    }, RESPONSE_TIMEOUT_MS);

    s.on("sendSigningActionCallResult", onResult);
  });

  s.emit(
    "initSigningActionCall",
    JSON.stringify({
      address,
      network: "vitreus",
      dAppMeta: DAPP_META,
      txId,
      callName,
      data,
    })
  );

  if (isMobileBrowser()) {
    // Bring vApp to the foreground so the user notices the pending request.
    queueMicrotask(() => openVappDeepLink({ callName }));
  }

  return resultPromise;
}

/** Requests vApp claim VIP/VIPP rewards for a given year. */
export function claimVipRewardsViaVapp(address, year) {
  return requestActionCallSignature({
    address,
    callName: "claimRewards",
    data: { year },
  });
}

export function disconnectVapp() {
  if (socket) {
    try {
      socket.emit("disconnectSession", JSON.stringify({ sessionId: currentSessionId }));
      socket.disconnect();
    } catch {
      // ignore — clearing local state regardless
    }
  }
  socket = null;
  currentSessionId = null;
}
