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
//  - "WalletConnect" path: the user's mobile wallet app holds the key and
//    signs after the user approves in that app; this code only ever sees
//    the resulting signature, relayed through WalletConnect's relay.
//  - Both paths are equally non-custodial. Do not add a third path that
//    accepts a raw key/mnemonic in a text input.

import {
  VITREUS_WC_CHAIN_ID,
  VITREUS_GENESIS_HASH,
} from "./vitreusChain.js";

// From cloud.reown.com (formerly cloud.walletconnect.com). Not secret —
// safe to ship in client-side code, same as any other WalletConnect dApp.
export const WALLETCONNECT_PROJECT_ID = "5d0eeb125924ce8472868790da4669b1";

const LAST_SOURCE_KEY = "vscan_wallet_last_source_v1";

// vApp isn't listed in WalletConnect's official Explorer, so it has to be
// registered manually so the modal shows a direct "Connect with vApp"
// deep-link button on mobile instead of a QR code to scan with a camera.
// Both links pulled directly from vApp's own AndroidManifest.xml
// <intent-filter> entries (confirmed 2026-08-15), and confirmed live in use
// by marketplace.vtrs.io and dao.vtrs.io's own bundled JS.
const VAPP_WALLET_ENTRY = {
  id: "vapp-vitreus",
  name: "vApp",
  links: {
    native: "vtrs://app/mobile",
    universal: "https://deeplink-dev.pages.dev/mobile",
  },
};

const listeners = new Set();

let state = {
  status: "disconnected", // 'disconnected' | 'connecting' | 'connected'
  source: null, // 'extension' | 'walletconnect'
  address: null,
  accounts: [], // [{ address, name? }]
  error: null,
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

// ---------------- WalletConnect ----------------

let wcProvider = null;
let wcSession = null;

async function getWcProvider() {
  if (wcProvider) return wcProvider;
  const { default: UniversalProvider } = await import("@walletconnect/universal-provider");
  wcProvider = await UniversalProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    relayUrl: "wss://relay.walletconnect.com",
    metadata: {
      name: "vScan",
      description: "Vitreus VIP/VIPP rewards, wallet balances, and explorer",
      url: "https://vscango.com",
      icons: ["https://vscango.com/favicon.png"],
    },
  });
  return wcProvider;
}

/**
 * Opens the WalletConnect QR modal and resolves once the user approves in
 * their wallet app. NOTE: WalletConnect signing only works if the wallet
 * app on the other end already knows about Vitreus (genesis hash
 * VITREUS_GENESIS_HASH) or lets the user add it as a custom network during
 * the session — unlike the extension path, which works for any chain out
 * of the box because the dApp (not the wallet) supplies the chain metadata.
 */
export async function connectWalletConnect() {
  setState({ status: "connecting", error: null });
  try {
    if (WALLETCONNECT_PROJECT_ID.startsWith("REPLACE_WITH")) {
      throw new Error(
        "WalletConnect is not configured yet — set WALLETCONNECT_PROJECT_ID in vitreusWalletStore.js."
      );
    }

    const provider = await getWcProvider();
    const { WalletConnectModal } = await import("@walletconnect/modal");
    const modal = new WalletConnectModal({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [VITREUS_WC_CHAIN_ID],
      mobileWallets: [VAPP_WALLET_ENTRY],
      walletImages: { "vapp-vitreus": "https://vitreus.io/favicon.ico" },
      enableExplorer: false,
    });

    const { uri, approval } = await provider.client.connect({
      requiredNamespaces: {
        polkadot: {
          methods: ["polkadot_signTransaction", "polkadot_signMessage"],
          chains: [VITREUS_WC_CHAIN_ID],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    if (uri) modal.openModal({ uri });

    let session;
    try {
      session = await approval();
    } finally {
      modal.closeModal();
    }

    wcSession = session;
    const caipAccounts = session.namespaces.polkadot.accounts; // "polkadot:<hash>:<address>"
    const addresses = caipAccounts.map((a) => a.split(":")[2]);

    localStorage.setItem(LAST_SOURCE_KEY, "walletconnect");
    setState({
      status: "connected",
      source: "walletconnect",
      accounts: addresses.map((address) => ({ address, name: null })),
      address: addresses[0],
      error: null,
    });
    return addresses;
  } catch (err) {
    setState({ status: "disconnected", error: err.message || String(err) });
    throw err;
  }
}

function getWalletConnectSigner(address) {
  if (!wcProvider || !wcSession) throw new Error("WalletConnect is not connected.");
  const client = wcProvider.client;
  const topic = wcSession.topic;

  return {
    async signPayload(payload) {
      const result = await client.request({
        chainId: VITREUS_WC_CHAIN_ID,
        topic,
        request: {
          method: "polkadot_signTransaction",
          params: { address: payload.address, transactionPayload: payload },
        },
      });
      return { id: Date.now(), signature: result.signature };
    },
    async signRaw(raw) {
      const result = await client.request({
        chainId: VITREUS_WC_CHAIN_ID,
        topic,
        request: {
          method: "polkadot_signMessage",
          params: { address: raw.address, message: raw.data },
        },
      });
      return { id: Date.now(), signature: result.signature };
    },
  };
}

// ---------------- Shared API ----------------

export function selectAccount(address) {
  setState({ address });
}

/** Returns a polkadot.js-compatible Signer regardless of connection source. */
export async function getActiveSigner(address) {
  if (state.source === "extension") return getExtensionSigner(address);
  if (state.source === "walletconnect") return getWalletConnectSigner(address);
  throw new Error("No wallet connected.");
}

export async function disconnectWallet() {
  if (state.source === "walletconnect" && wcProvider && wcSession) {
    try {
      await wcProvider.client.disconnect({
        topic: wcSession.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
    } catch {
      // ignore — we're clearing local state regardless
    }
    wcSession = null;
  }
  localStorage.removeItem(LAST_SOURCE_KEY);
  setState({ status: "disconnected", source: null, accounts: [], address: null, error: null });
}

/**
 * Call once, e.g. from ConnectWalletButton's mount effect, to silently
 * restore a previous session. Only attempts this if the user connected
 * before on this device (we never auto-prompt a first-time visitor).
 */
export async function tryRestoreWalletSession() {
  const lastSource = localStorage.getItem(LAST_SOURCE_KEY);
  if (!lastSource) return;

  if (lastSource === "extension") {
    try {
      await connectExtension();
    } catch {
      // silent — user can click Connect again
    }
    return;
  }

  if (lastSource === "walletconnect") {
    try {
      const provider = await getWcProvider();
      const sessions = provider.client.session.getAll();
      const match = sessions.find((s) =>
        Object.values(s.namespaces).some((ns) => ns.chains?.includes(VITREUS_WC_CHAIN_ID))
      );
      if (!match) return;
      wcSession = match;
      const caipAccounts = match.namespaces.polkadot.accounts;
      const addresses = caipAccounts.map((a) => a.split(":")[2]);
      setState({
        status: "connected",
        source: "walletconnect",
        accounts: addresses.map((address) => ({ address, name: null })),
        address: addresses[0],
        error: null,
      });
    } catch {
      // silent — user can reconnect
    }
  }
}

export { VITREUS_GENESIS_HASH };
