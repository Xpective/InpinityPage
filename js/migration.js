// js/migration.js
import { state } from "./state.js";
import { debugLog } from "./utils.js";

export const FARMING_V5_ADDRESS = "0xe0246dC9c553E9cD741013C21BD217912a9DA0B2";
export const PIRATES_V5_ADDRESS = "0xe76b03A848dE22DdbbF34994e650d2E887426879";

export const FARMING_V5_ABI = [
  "function getFarmState(uint256 tokenId) view returns ((uint256 startTime,uint256 lastAccrualTime,uint256 lastClaimTime,uint256 boostExpiry,uint256 stopTime,bool isActive))",
  "function previewClaim(uint256 tokenId) view returns ((uint8 code,bool allowed,uint256 pendingAmount,uint256 stealAmount,uint256 travelTime,uint256 remainingAttacksToday,uint256 protectionLevel,uint256 effectiveStealPercent,uint256 secondsRemaining))",
  "function claimResources(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])"
];

let farmingV5Contract = null;

export function setupLegacyMigrationContracts() {
  if (!state.signer) throw new Error("Wallet not connected");
  farmingV5Contract = new ethers.Contract(FARMING_V5_ADDRESS, FARMING_V5_ABI, state.signer);
}

export function getFarmingV5Contract() {
  if (!farmingV5Contract) setupLegacyMigrationContracts();
  return farmingV5Contract;
}

export async function getV5FarmState(tokenId) {
  try {
    const c = getFarmingV5Contract();
    const farm = await c.getFarmState(tokenId);
    return {
      ok: true,
      tokenId: String(tokenId),
      startTime: Number(farm.startTime || 0),
      lastAccrualTime: Number(farm.lastAccrualTime || 0),
      lastClaimTime: Number(farm.lastClaimTime || 0),
      boostExpiry: Number(farm.boostExpiry || 0),
      stopTime: Number(farm.stopTime || 0),
      isActive: !!farm.isActive
    };
  } catch (e) {
    return {
      ok: false,
      tokenId: String(tokenId),
      startTime: 0,
      lastAccrualTime: 0,
      lastClaimTime: 0,
      boostExpiry: 0,
      stopTime: 0,
      isActive: false,
      error: e
    };
  }
}

export async function isTokenActiveOnV5(tokenId) {
  const farm = await getV5FarmState(tokenId);
  return !!(farm.ok && farm.isActive);
}

export async function previewV5Claim(tokenId) {
  const c = getFarmingV5Contract();
  return c.previewClaim(tokenId);
}

export async function getV5PendingTotal(tokenId) {
  try {
    const c = getFarmingV5Contract();
    const pending = await c.getAllPending(tokenId);
    return pending.reduce(
      (acc, v) => acc.add(v),
      ethers.BigNumber.from(0)
    );
  } catch {
    return ethers.BigNumber.from(0);
  }
}

export async function migrateSingleFarmV5ToV6(tokenId, options = {}) {
  const {
    claimIfPossible = true,
    stopOnV5 = true,
    startOnV6 = true,
    gasLimitClaim = 700000,
    gasLimitStop = 500000,
    gasLimitStart = 500000
  } = options;

  const result = {
    tokenId: String(tokenId),
    v5WasActive: false,
    claimedOnV5: false,
    stoppedOnV5: false,
    startedOnV6: false
  };

  const v5 = getFarmingV5Contract();
  const v6 = state.farmingV6Contract;

  if (!v6) throw new Error("FarmingV6 contract not initialized");

  const v5Farm = await getV5FarmState(tokenId);
  if (!v5Farm.ok || !v5Farm.isActive) {
    debugLog(`Migration skip: token ${tokenId} not active on V5`);
    return result;
  }

  result.v5WasActive = true;

  if (claimIfPossible) {
    try {
      const preview = await v5.previewClaim(tokenId);
      const totalPending = await getV5PendingTotal(tokenId);

      if (preview.allowed && totalPending.gt(0)) {
        debugLog(`V5 claim before migration`, { tokenId, totalPending: totalPending.toString() });
        const tx = await v5.claimResources(tokenId, { gasLimit: gasLimitClaim });
        await tx.wait();
        result.claimedOnV5 = true;
      }
    } catch (e) {
      debugLog(`V5 claim failed before migration`, { tokenId, error: e.message });
    }
  }

  if (stopOnV5) {
    debugLog(`Stopping V5 farm`, { tokenId });
    const tx = await v5.stopFarming(tokenId, { gasLimit: gasLimitStop });
    await tx.wait();
    result.stoppedOnV5 = true;
  }

  if (startOnV6) {
    debugLog(`Starting V6 farm`, { tokenId });
    const tx = await v6.startFarming(tokenId, { gasLimit: gasLimitStart });
    await tx.wait();
    result.startedOnV6 = true;
  }

  return result;
}

export async function migrateManyFarmsV5ToV6(tokenIds = [], options = {}) {
  const results = [];

  for (const tokenId of tokenIds) {
    try {
      const res = await migrateSingleFarmV5ToV6(tokenId, options);
      results.push({ ok: true, ...res });
    } catch (e) {
      results.push({
        ok: false,
        tokenId: String(tokenId),
        error: e.reason || e.message || String(e)
      });
    }
  }

  return results;
}