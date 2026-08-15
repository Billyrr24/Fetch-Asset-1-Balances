// vitreusVappSession.js
// Vitreus's own custom wallet-pairing protocol — NOT WalletConnect.
// Reverse engineered from marketplace.vtrs.io / dao.vtrs.io's bundled JS
// and cross-checked against literal strings found in vApp's own compiled
// code (2026-08-15). Facts below are marked [CONFIRMED] where I directly
// observed them in live traffic/config/bundled source, and [INFERRED]
// where I'm following the most sensible pattern but haven't seen it proven
// against a real vApp session yet.
//
// Protocol summary:
//  [CONFIRMED] Socket.IO connection to wss://wallet-prod-be.vtrs.io.
//  [CONFIRMED] Handshake needs an "api-key" HTTP header (extraHeaders —
//    only reaches the server on the polling transport, since browsers
//    strip custom headers from raw WebSocket upgrades) plus a
//    `query: {session_id, mobile_socket}` pair. session_id here is a
//    *persistent per-browser* id, unrelated to the pairing session id
//    below.
//  [CONFIRMED] Client emits "initSession" with a `web3Settings`-shaped
//    payload — traced through the *actual* prop chain (useSocketService ->
//    useWsConnection -> ConnectWalletBtn's `web3Settings` prop) to the
//    literal object literal marketplace.vtrs.io passes it:
//    { chainInfo: [<EIP-3085-style Vitreus chain descriptor>],
//      webSessionInfo: { activeChain: "vitreus", supportedChains: ["vitreus"],
//                         autoSwitch: false, autoConnect: true },
//      dAppMeta: {...} }
//    An earlier version of this file sent only {dAppMeta} and the server
//    rejected it outright with "object has wrong interface" — this is the
//    fix, read directly out of their bundle, not guessed.
//  [CONFIRMED] The server does NOT hand back a session id synchronously —
//    almost everything the server sends arrives through a single generic
//    "message" event, shaped like {action: "<name>", data: {...}}, routed
//    client-side by a handler table keyed on `action`:
//      connection, sessionId, approveConnection, disconnect,
//      signingActionCall, signingActionCallResult
//    (found the literal dispatch table + every handler body in
//    marketplace/dao's bundled JS.)
//  [CONFIRMED] sessionId handler reads data.sessionId — this is the value
//    that becomes the QR/deep-link string "wallet_connect:<sessionId>".
//    So the real flow is: emit initSession → wait for a "message" with
//    action:"sessionId" → *then* show the QR.
//  [CONFIRMED] connection handler reads
//    data.session.connectedWallet (address),
//    data.session.sessionData.chainInfo,
//    data.session.sessionData.webSessionInfo.supportedChains.
//  [CONFIRMED] approveConnection handler just takes `data` as-is as the
//    wallet info (so data itself is expected to carry the address).
//  [CONFIRMED] "error" is a distinct, separate socket.io event (not part
//    of the message/action system) — this is almost certainly what
//    surfaced as "object has wrong interface": a payload-shape mismatch
//    on an earlier version of this file that included a client-generated
//    sessionId inside the initSession payload, which the server didn't
//    expect.
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
//  [CONFIRMED] signingActionCallResult handler reads
//    data.txId, data.result.isCompleted, data.result.address — no
//    separate explicit error field was found; "not completed" is treated
//    as failure/pending in the reference implementation, which is the
//    best signal available here too.
//  [CONFIRMED] On mobile, after emitting a signing request, the site
//    redirects to vApp's own deep link
//    (https://deeplink-dev.pages.dev/mobile, native vtrs://app/mobile)
//    with "?callName=<callName>" appended, to bring the app to the
//    foreground. For the *pairing* deep link specifically (not signing),
//    the param is "?session=<sessionId>" — confirmed from the same
//    ConnectWalletBtn component, not "?sessionId=" as an earlier version
//    of this file guessed.
//
// Security model: identical in spirit to the extension path — vApp holds
// the key and signs internally. This code only ever sends a named action +
// plain-language arguments (e.g. "claim VIP rewards for year 2025") and
// receives back a pass/fail result; it never sees or handles a private key.

const WALLET_BACKEND_URL = "wss://wallet-prod-be.vtrs.io";

// From vApp's own .env (API_KEY_WALLET_CONNECT) — not secret, it's shipped
// in vApp's client-side config and every dApp integrating with this
// backend uses the same value.
const WALLET_BACKEND_API_KEY = "72f97304-574a-4c2a-9d5f-0cbb20c5e8a7";

const SOCKET_SESSION_ID_KEY = "vscan_vapp_socket_session_id";

const DAPP_META = {
  name: "vScan",
  url: "https://vscango.com",
  description: "Vitreus VIP/VIPP rewards, wallet balances, and explorer",
  logoUrl: "https://vscango.com/favicon.png",
};

// [CONFIRMED] The standard EVM chain-descriptor object (chainlist.org /
// EIP-3085 shape) that marketplace.vtrs.io and dao.vtrs.io both use for
// Vitreus, found verbatim as `VitreusChain` in their bundled JS.
const VITREUS_CHAIN_DESCRIPTOR = {
  name: "Vitreus",
  chain: "ETH",
  icon: {
    url: "https://i.seadn.io/gcs/files/f782e6e31691feb96741245b6376b98a.png?auto=format&dpr=1&w=256",
    height: 512,
    width: 512,
    format: "png",
  },
  rpc: ["https://rpc-mainnet.vtrs.io"],
  features: [{ name: "EIP1559" }, { name: "EIP155" }],
  redFlags: [],
  nativeCurrency: { name: "Vitreus", symbol: "VTRS", decimals: 18 },
  shortName: "vtrs",
  chainId: 1943,
  networkId: 1943,
  slip44: 60,
  explorers: [{ name: "Vitreus Explorer", url: "https://explorer.vtrs.io/", standard: "EIP3091" }],
  testnet: false,
  slug: "vitreus",
};

// [CONFIRMED] This is the *actual* initSession payload — found via the
// full destructuring chain useSocketService -> useWsConnection ->
// ConnectWalletBtn's `web3Settings` prop, with the literal object literal
// passed to it in marketplace.vtrs.io's own source. Nothing here was
// guessed; every field below was read directly out of their bundle.
const INIT_SESSION_PAYLOAD = {
  chainInfo: [VITREUS_CHAIN_DESCRIPTOR],
  webSessionInfo: {
    activeChain: "vitreus",
    supportedChains: ["vitreus"],
    autoSwitch: false,
    autoConnect: true,
  },
  dAppMeta: DAPP_META,
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

function getPersistedSocketSessionId() {
  try {
    let id = localStorage.getItem(SOCKET_SESSION_ID_KEY);
    if (!id) {
      id = generateRandomId();
      localStorage.setItem(SOCKET_SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return generateRandomId();
  }
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

function safeParse(payload) {
  if (payload == null) return {};
  if (typeof payload !== "string") return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}

// ---------------- Socket + generic "message" action bus ----------------

let socket = null;
let currentPairingSessionId = null;
const actionListeners = new Map(); // action name -> Set<fn(data)>

function onAction(action, fn) {
  if (!actionListeners.has(action)) actionListeners.set(action, new Set());
  actionListeners.get(action).add(fn);
  return () => actionListeners.get(action)?.delete(fn);
}

function dispatchMessage(payload) {
  const msg = safeParse(payload);
  const handlers = actionListeners.get(msg.action);
  if (handlers) {
    for (const fn of handlers) fn(msg.data || {});
  }
}

async function getSocket() {
  if (socket && socket.connected) return socket;
  const { io } = await import("socket.io-client");
  socket = io(WALLET_BACKEND_URL, {
    // Polling must run first so the "api-key" header actually reaches the
    // server — browsers drop custom headers on raw WebSocket upgrades, so
    // a websocket-first connection would silently omit it.
    transports: ["polling", "websocket"],
    extraHeaders: { "api-key": WALLET_BACKEND_API_KEY },
    query: {
      session_id: getPersistedSocketSessionId(),
      mobile_socket: false,
    },
    reconnection: true,
  });
  socket.on("message", dispatchMessage);
  return socket;
}

/**
 * Starts a new pairing session against vApp's backend. The server assigns
 * the pairing session id asynchronously (via a "sessionId" message), so
 * this returns { getQrValue, waitForConnection } — getQrValue() resolves
 * once that id arrives.
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

  let connectionErrorMessage = null;
  const offSocketError = (() => {
    const handler = (payload) => {
      const data = safeParse(payload);
      connectionErrorMessage = data.message || data.raw || (typeof payload === "string" ? payload : "vApp reported an error.");
    };
    s.on("error", handler);
    return () => s.off("error", handler);
  })();

  s.emit("initSession", JSON.stringify(INIT_SESSION_PAYLOAD));

  const getQrValue = () =>
    new Promise((resolve, reject) => {
      const off = onAction("sessionId", (data) => {
        if (!data.sessionId) return;
        currentPairingSessionId = data.sessionId;
        cleanup();
        resolve(`wallet_connect:${data.sessionId}`);
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(connectionErrorMessage || "Timed out starting a vApp session."));
      }, 20000);
      function cleanup() {
        off();
        clearTimeout(timer);
      }
    });

  const waitForConnection = () =>
    new Promise((resolve, reject) => {
      const offConnection = onAction("connection", (data) => {
        const address = data?.session?.connectedWallet;
        if (!address) return;
        cleanup();
        resolve({ address, raw: data });
      });
      const offApprove = onAction("approveConnection", (data) => {
        const address = data?.address;
        if (!address) return;
        cleanup();
        resolve({ address, raw: data });
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for vApp to connect."));
      }, RESPONSE_TIMEOUT_MS);
      function cleanup() {
        offConnection();
        offApprove();
        offSocketError();
        clearTimeout(timer);
      }
    });

  return {
    getQrValue,
    waitForConnection,
    // [CONFIRMED] param name is "session", not "sessionId" — verified from
    // the literal deep-link construction in the paired ConnectWalletBtn
    // component: `${deepLinks.ios/android}?session=${sessionId}`.
    openDeepLink: () => openVappDeepLink({ session: currentPairingSessionId || "" }),
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
    const off = onAction("signingActionCallResult", (payload) => {
      if (payload.txId && String(payload.txId) !== String(txId)) return; // a different in-flight request
      cleanup();
      const result = payload.result || {};
      if (result.isCompleted) {
        resolve({ txId: payload.txId, address: result.address, raw: payload });
      } else {
        reject(new Error("vApp did not complete the request. Check the app for a pending or failed transaction."));
      }
    });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for vApp to respond. Check the app for a pending request."));
    }, RESPONSE_TIMEOUT_MS);
    function cleanup() {
      off();
      clearTimeout(timer);
    }
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
      socket.emit("disconnectSession", JSON.stringify({ sessionId: currentPairingSessionId }));
      socket.off("message", dispatchMessage);
      socket.disconnect();
    } catch {
      // ignore — clearing local state regardless
    }
  }
  socket = null;
  currentPairingSessionId = null;
  actionListeners.clear();
}
