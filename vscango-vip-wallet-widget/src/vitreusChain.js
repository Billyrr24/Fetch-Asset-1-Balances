// vitreusChain.js
// Low-level chain access for the VIP/VIPP rewards claim widget.
// All @polkadot/api usage is lazy-loaded so pages that never mount the
// wallet widget never pay for it.

export const VITREUS_RPC = "wss://rpc-mainnet.vtrs.io";

// Confirmed live on mainnet via system_properties (2026-08-14).
export const VITREUS_FALLBACK_DECIMALS = 18;
export const VITREUS_FALLBACK_SYMBOL = "VTRS";

// Confirmed live on mainnet via chain_getBlockHash(0) (2026-08-14).
export const VITREUS_GENESIS_HASH =
  "0x4f27ff2e1c714c78b718d11a999774b2f639da713b9481337942997140185cfc";

// CAIP-13 chain reference = first 16 bytes (32 hex chars) of the genesis hash.
export const VITREUS_WC_CHAIN_ID = `polkadot:${VITREUS_GENESIS_HASH.slice(2, 34)}`;

let apiPromise = null;

/** Returns a shared, lazily-created ApiPromise connected to Vitreus mainnet. */
export function getVitreusApi() {
  if (!apiPromise) {
    apiPromise = (async () => {
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      const provider = new WsProvider(VITREUS_RPC);
      return ApiPromise.create({ provider });
    })();
  }
  return apiPromise;
}

export function truncateAddress(address, lead = 6, tail = 6) {
  const a = String(address || "");
  if (a.length <= lead + tail + 1) return a;
  return `${a.slice(0, lead)}…${a.slice(-tail)}`;
}

export function formatTokenAmount(rawValue, decimals = VITREUS_FALLBACK_DECIMALS) {
  let value;
  try {
    value = typeof rawValue === "bigint" ? rawValue : BigInt(rawValue?.toString?.() ?? rawValue ?? 0);
  } catch {
    return "0";
  }
  if (value < 0n) value = 0n;

  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;

  const wholeStr = whole.toLocaleString("en-US");
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, 4)
    .replace(/0+$/, "");

  return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
}

function unwrapOption(codec) {
  if (codec && typeof codec.isSome === "boolean") {
    return codec.isSome ? codec.unwrap() : null;
  }
  return codec ?? null;
}

function toBigIntSafe(codec) {
  if (codec == null) return 0n;
  if (typeof codec.toBigInt === "function") return codec.toBigInt();
  try {
    return BigInt(codec.toString());
  } catch {
    return 0n;
  }
}

/**
 * Finds every year for which this address has unclaimed VIP and/or VIPP
 * points, and estimates the payout using the same
 * (my points / total points) * pool formula the pallet uses on-chain.
 * The estimate is informational only — the runtime computes the real
 * payout atomically at claim time.
 */
export async function getClaimableRewards(address) {
  const api = await getVitreusApi();
  const decimals = api.registry.chainDecimals?.[0] ?? VITREUS_FALLBACK_DECIMALS;
  const symbol = api.registry.chainTokens?.[0] ?? VITREUS_FALLBACK_SYMBOL;

  const rewardsEntries = await api.query.privileges.rewards.entries();

  const years = rewardsEntries
    .map(([storageKey, value]) => ({
      year: storageKey.args[0].toNumber(),
      info: unwrapOption(value),
    }))
    .filter((y) => y.info)
    .sort((a, b) => b.year - a.year);

  const claimable = [];

  for (const { year, info } of years) {
    const [vipPointsOpt, vippPointsOpt] = await Promise.all([
      api.query.privileges.vipPoints(year, address),
      api.query.privileges.vippPoints(year, address),
    ]);

    const myVipPoints = unwrapOption(vipPointsOpt);
    const myVippPoints = unwrapOption(vippPointsOpt);

    if (myVipPoints == null && myVippPoints == null) continue;

    const totalVipPoints = toBigIntSafe(info.vipPoints);
    const totalVipRewards = toBigIntSafe(info.vipRewards);
    const totalVippPoints = toBigIntSafe(info.vippPoints);
    const totalVippRewards = toBigIntSafe(info.vippRewards);

    const myVipPointsBn = myVipPoints != null ? toBigIntSafe(myVipPoints) : 0n;
    const myVippPointsBn = myVippPoints != null ? toBigIntSafe(myVippPoints) : 0n;

    const estVipReward =
      myVipPoints != null && totalVipPoints > 0n
        ? (myVipPointsBn * totalVipRewards) / totalVipPoints
        : 0n;
    const estVippReward =
      myVippPoints != null && totalVippPoints > 0n
        ? (myVippPointsBn * totalVippRewards) / totalVippPoints
        : 0n;

    claimable.push({
      year,
      hasVip: myVipPoints != null,
      hasVipp: myVippPoints != null,
      myVipPoints: myVipPointsBn,
      myVippPoints: myVippPointsBn,
      estVipReward,
      estVippReward,
      estTotalReward: estVipReward + estVippReward,
    });
  }

  return { claimable, decimals, symbol };
}

export async function buildClaimTx(year) {
  const api = await getVitreusApi();
  return api.tx.privileges.claimRewards(year);
}

function decodeDispatchError(api, dispatchError) {
  if (dispatchError.isModule) {
    try {
      const decoded = api.registry.findMetaError(dispatchError.asModule);
      return new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`);
    } catch {
      // fall through to generic message
    }
  }
  return new Error(dispatchError.toString());
}

/**
 * Signs and submits privileges.claimRewards(year) using whichever Signer
 * is passed in (works identically for a browser-extension signer and the
 * WalletConnect signer built in vitreusWalletStore.js — both implement
 * the same polkadot.js Signer#signPayload interface).
 */
export async function submitClaim(address, year, signer, { onStatus } = {}) {
  const api = await getVitreusApi();
  const tx = await buildClaimTx(year);

  return new Promise((resolve, reject) => {
    tx.signAndSend(address, { signer }, (result) => {
      try {
        onStatus?.(result);
      } catch {
        // ignore status-callback errors
      }

      if (result.dispatchError) {
        reject(decodeDispatchError(api, result.dispatchError));
        return;
      }

      if (result.status.isFinalized || result.status.isInBlock) {
        resolve({
          txHash: tx.hash.toHex(),
          blockHash: result.status.isFinalized
            ? result.status.asFinalized.toHex()
            : result.status.asInBlock.toHex(),
          finalized: result.status.isFinalized,
        });
      }
    }).catch(reject);
  });
}

// ---- Local claim history (this browser / this app only — not a full
// on-chain audit trail; see README for why) ----

const CLAIM_HISTORY_KEY = "vscan_vip_claim_history_v1";

export function getClaimHistory(address) {
  try {
    const raw = localStorage.getItem(CLAIM_HISTORY_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[address] || [];
  } catch {
    return [];
  }
}

export function recordClaim(address, entry) {
  try {
    const raw = localStorage.getItem(CLAIM_HISTORY_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const list = all[address] || [];
    list.unshift({ ...entry, at: Date.now() });
    all[address] = list.slice(0, 50);
    localStorage.setItem(CLAIM_HISTORY_KEY, JSON.stringify(all));
  } catch {
    // best-effort only
  }
}
