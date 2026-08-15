// vitreusWalletStore.js
// A tiny framework-agnostic pub/sub store for the connected wallet, shared
// between the header ConnectWalletButton and the VipClaim page without
// needing a React Context Provider wired into your app root.
//
// Security model (read before changing):
//  - Never handle, request, or store a seed phrase / private key here.
//  - "Extension" path: @polkadot/extension-dapp talks to the user's
//    installed extension (Polkadot.js / Talisman / SubWallet). The
//    extension holds the key and signs in its own UI; this code only
//    ever sees the resulting signature.
//  - "vApp" path: Vitreus's own custom pairing protocol (see
//    vitreusVappSession.js) — vApp holds the key and signs internally.
//    This code only ever sends a named action + arguments and receives
//    back a pass/fail result.
//  - Both paths are equally non-custodial. Do not add a third path that
//    accepts a raw key/mnemonic in a text input.
//
// NOTE: an earlier version of this file used WalletConnect for the mobile
// path. That turned out to be the wrong protocol entirely — vApp doesn't
// speak WalletConnect. It uses its own Socket.IO-based pairing service,
// implemented in vitreusVappSession.js. See that file for the full writeup
// of what's confirmed vs. inferred about the protocol.

import { startVappPairing, requestActionCallSignature, disconnectVapp } from "./vitreusVappSession.js";

const LAST_SOURCE_KEY = "vscan_wallet_last_source_v1";

const listeners = new Set();

let state = {
  status: "disconnected", // 'disconnected' | 'connecting' | 'connected'
  source: null, // 'extension' | 'vapp'
  address: null,
  accounts: [], // [{ address, name? }]
  error: null,
  vappQrValue: null, // set while a vApp pairing QR is being shown
};

function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function getWalletState() {
  return state;
}

export function subscribeWallet(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

// ---------------- Browser extension ----------------

export async function connectExtension(appName = "vScan") {
  setState({ status: "connecting", error: null });
  try {
    const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
    const extensions = await web3Enable(appName);
    if (!extensions.length) {
      throw new Error(
        "No wallet extension found. Install Polkadot.js, Talisman, or SubWallet, then reload."
      );
    }
    const accounts = await web3Accounts();
    if (!accounts.length) {
      throw new Error("Your extension is installed but has no accounts. Add one and reload.");
    }
    const mapped = accounts.map((a) => ({ address: a.address, name: a.meta?.name || null }));
    localStorage.setItem(LAST_SOURCE_KEY, "extension");
    setState({
      status: "connected",
      source: "extension",
      accounts: mapped,
      address: mapped[0].address,
      error: null,
    });
    return mapped;
  } catch (err) {
    setState({ status: "disconnected", error: err.message || String(err) });
    throw err;
  }
}

async function getExtensionSigner(address) {
  const { web3FromAddress } = await import("@polkadot/extension-dapp");
  const injector = await web3FromAddress(address);
  return injector.signer;
}

// ---------------- vApp (Vitreus's own custom protocol) ----------------

/**
 * Starts a vApp pairing session. Sets state.vappQrValue so the UI can
 * render it as a QR code (and/or offer a "Open vApp" deep-link button on
 * mobile), then resolves once the user approves inside vApp.
 */
export async function connectVapp() {
  setState({ status: "connecting", error: null, vappQrValue: null });
  try {
    const { qrValue, waitForConnection, openDeepLink } = await startVappPairing();
    setState({ vappQrValue: qrValue, vappOpenDeepLink: openDeepLink });

    const { address } = await waitForConnection();

    localStorage.setItem(LAST_SOURCE_KEY, "vapp");
    setState({
      status: "connected",
      source: "vapp",
      accounts: [{ address, name: null }],
      address,
      error: null,
      vappQrValue: null,
    });
    return [{ address }];
  } catch (err) {
    setState({ status: "disconnected", error: err.message || String(err), vappQrValue: null });
    throw err;
  }
}

/**
 * Asks vApp to sign + submit a named pallet call for the connected
 * account. Unlike the extension path, vApp builds the actual extrinsic
 * itself — this never touches @polkadot/api's tx-building/signing.
 */
export async function requestVappActionCall({ callName, data }) {
  if (state.source !== "vapp" || !state.address) {
    throw new Error("vApp is not connected.");
  }
  return requestActionCallSignature({ address: state.address, callName, data });
}

// ---------------- Shared API ----------------

export function selectAccount(address) {
  setState({ address });
}

/**
 * Returns a polkadot.js-compatible Signer for the extension path only.
 * The vApp path doesn't produce a generic signer — see
 * requestVappActionCall() and claimVipRewardsViaVapp() instead, and branch
 * on wallet.source in calling code.
 */
export async function getActiveSigner(address) {
  if (state.source === "extension") return getExtensionSigner(address);
  throw new Error("No extension-based signer available for this connection source.");
}

export async function disconnectWallet() {
  if (state.source === "vapp") {
    disconnectVapp();
  }
  localStorage.removeItem(LAST_SOURCE_KEY);
  setState({
    status: "disconnected",
    source: null,
    accounts: [],
    address: null,
    error: null,
    vappQrValue: null,
  });
}

/**
 * Call once, e.g. from ConnectWalletButton's mount effect, to silently
 * restore a previous session. Only attempts this if the user connected
 * before on this device (we never auto-prompt a first-time visitor).
 *
 * NOTE: vApp pairing sessions live in the Socket.IO connection itself and
 * don't survive a page reload, so there's nothing to silently restore for
 * that path — the user reconnects via a fresh QR each time, same as on
 * marketplace.vtrs.io / dao.vtrs.io.
 */
export async function tryRestoreWalletSession() {
  const lastSource = localStorage.getItem(LAST_SOURCE_KEY);
  if (lastSource !== "extension") return;

  try {
    await connectExtension();
  } catch {
    // silent — user can click Connect again
  }
}
