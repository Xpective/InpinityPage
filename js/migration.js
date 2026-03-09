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

function getErrorMessage(e) {
  return (
    e?.reason ||
    e?.error?.message ||
    e?.data?.message ||
    e?.message ||
    String(e)
  );
}

function isUserRejectedError(e) {
  const msg = getErrorMessage(e).toLowerCase();
  return (
    e?.code === 4001 ||
    msg.includes("user rejected") ||
    msg.includes("denied transaction signature") ||
    msg.includes("user denied transaction signature") ||
    msg.includes("action_rejected")
  );
}

function isNonceError(e) {
  const msg = getErrorMessage(e).toLowerCase();
  return (
    msg.includes("nonce too high") ||
    msg.includes("nonce has already been used") ||
    msg.includes("replacement transaction underpriced") ||
    msg.includes("already known")
  );
}

function bn0() {
  return ethers.BigNumber.from(0);
}

export function setupLegacyMigrationContracts() {
  if (!state.signer) throw new Error("Wallet not connected");

  farmingV5Contract = new ethers.Contract(
    FARMING_V5_ADDRESS,
    FARMING_V5_ABI,
    state.signer
  );

  debugLog("Legacy migration contracts initialized", {
    farmingV5: FARMING_V5_ADDRESS
  });
}

export function clearLegacyMigrationContracts() {
  farmingV5Contract = null;
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
      error: getErrorMessage(e)
    };
  }
}

export async function getV6FarmState(tokenId) {
  try {
    if (!state.farmingV6Contract) {
      throw new Error("FarmingV6 contract not initialized");
    }

    const farm = await state.farmingV6Contract.getFarmState(tokenId);

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
      error: getErrorMessage(e)
    };
  }
}

export async function isTokenActiveOnV5(tokenId) {
  const farm = await getV5FarmState(tokenId);
  return !!(farm.ok && farm.isActive);
}

export async function isTokenActiveOnV6(tokenId) {
  const farm = await getV6FarmState(tokenId);
  return !!(farm.ok && farm.isActive);
}

export async function isTokenRevealedOnNFT(tokenId) {
  if (!state.nftContract) {
    throw new Error("NFT contract not initialized");
  }

  const data = await state.nftContract.blockData(tokenId);
  return !!data.revealed;
}

export async function getV5PendingTotal(tokenId) {
  try {
    const c = getFarmingV5Contract();
    const pending = await c.getAllPending(tokenId);
    return pending.reduce((acc, v) => acc.add(v), bn0());
  } catch {
    return bn0();
  }
}

export async function migrateSingleFarmV5ToV6(tokenId, options = {}) {
  const {
    claimIfPossible = false,
    stopOnV5 = true,
    startOnV6 = true,
    gasLimitClaim = 700000,
    gasLimitStop = 500000,
    gasLimitStart = 500000
  } = options;

  const result = {
    tokenId: String(tokenId),
    v5WasActive: false,
    v6WasActive: false,
    claimedOnV5: false,
    stoppedOnV5: false,
    startedOnV6: false,
    skippedClaim: false,
    skippedStop: false,
    skippedStart: false,
    needsRevealOnV6: false
  };

  const v5 = getFarmingV5Contract();
  const v6 = state.farmingV6Contract;

  if (!v6) throw new Error("FarmingV6 contract not initialized");

  debugLog("Migration begin", { tokenId: String(tokenId) });

  const v5Farm = await getV5FarmState(tokenId);
  const v6FarmBefore = await getV6FarmState(tokenId);

  result.v5WasActive = !!(v5Farm.ok && v5Farm.isActive);
  result.v6WasActive = !!(v6FarmBefore.ok && v6FarmBefore.isActive);

  if (!v5Farm.ok) {
    throw new Error(`Could not read V5 farm state for ${tokenId}: ${v5Farm.error}`);
  }

  if (!v5Farm.isActive) {
    debugLog("Migration skip: token not active on V5", { tokenId: String(tokenId) });
    result.skippedStop = true;
    result.skippedClaim = true;
    if (v6FarmBefore.isActive) result.skippedStart = true;
    return result;
  }

  if (claimIfPossible) {
    try {
      debugLog("V5 claim preview - reading", { tokenId: String(tokenId) });

      const preview = await v5.previewClaim(tokenId);
      const totalPending = await getV5PendingTotal(tokenId);

      debugLog("V5 claim preview - result", {
        tokenId: String(tokenId),
        allowed: !!preview.allowed,
        code: Number(preview.code || 0),
        pendingAmount: preview.pendingAmount?.toString?.() || "0",
        totalPending: totalPending.toString()
      });

      if (preview.allowed && totalPending.gt(0)) {
        debugLog("V5 claim before migration - sending tx", {
          tokenId: String(tokenId),
          totalPending: totalPending.toString()
        });

        const claimTx = await v5.claimResources(tokenId, { gasLimit: gasLimitClaim });

        debugLog("V5 claim before migration - tx sent", {
          tokenId: String(tokenId),
          hash: claimTx.hash
        });

        const claimReceipt = await claimTx.wait();

        debugLog("V5 claim before migration - tx confirmed", {
          tokenId: String(tokenId),
          hash: claimTx.hash,
          status: claimReceipt.status,
          blockNumber: claimReceipt.blockNumber
        });

        if (claimReceipt.status !== 1) {
          throw new Error(`V5 claim tx failed onchain for ${tokenId}`);
        }

        result.claimedOnV5 = true;
      } else {
        result.skippedClaim = true;
        debugLog("V5 claim skipped", {
          tokenId: String(tokenId),
          allowed: !!preview.allowed,
          totalPending: totalPending.toString()
        });
      }
    } catch (e) {
      const errMsg = getErrorMessage(e);

      debugLog("V5 claim failed before migration", {
        tokenId: String(tokenId),
        error: errMsg
      });

      if (isUserRejectedError(e)) {
        throw new Error("Migration cancelled by user during V5 claim.");
      }

      if (isNonceError(e)) {
        throw new Error(`V5 claim failed due to nonce/pending transaction issue: ${errMsg}`);
      }

      result.skippedClaim = true;
    }
  } else {
    result.skippedClaim = true;
    debugLog("V5 claim disabled by options", { tokenId: String(tokenId) });
  }

  if (stopOnV5) {
    try {
      debugLog("Stopping V5 farm - sending tx", { tokenId: String(tokenId) });

      const stopTx = await v5.stopFarming(tokenId, { gasLimit: gasLimitStop });

      debugLog("Stopping V5 farm - tx sent", {
        tokenId: String(tokenId),
        hash: stopTx.hash
      });

      const stopReceipt = await stopTx.wait();

      debugLog("Stopping V5 farm - receipt", {
        tokenId: String(tokenId),
        hash: stopTx.hash,
        status: stopReceipt.status,
        blockNumber: stopReceipt.blockNumber
      });

      if (stopReceipt.status !== 1) {
        throw new Error(`V5 stop tx failed onchain for ${tokenId}`);
      }

      result.stoppedOnV5 = true;
    } catch (e) {
      const errMsg = getErrorMessage(e);

      debugLog("Stopping V5 farm - FAILED", {
        tokenId: String(tokenId),
        error: errMsg
      });

      if (isUserRejectedError(e)) {
        throw new Error("Migration cancelled by user during V5 stop.");
      }

      if (isNonceError(e)) {
        throw new Error(`V5 stop failed due to nonce/pending transaction issue: ${errMsg}`);
      }

      throw new Error(`V5 stop failed for ${tokenId}: ${errMsg}`);
    }
  } else {
    result.skippedStop = true;
    debugLog("V5 stop disabled by options", { tokenId: String(tokenId) });
  }

  if (startOnV6) {
    const revealed = await isTokenRevealedOnNFT(tokenId).catch(() => false);

    if (!revealed) {
      result.skippedStart = true;
      result.needsRevealOnV6 = true;

      debugLog("Starting V6 farm skipped - token not revealed", {
        tokenId: String(tokenId)
      });

      return result;
    }

    const v6FarmAfterStopCheck = await getV6FarmState(tokenId);

    if (v6FarmAfterStopCheck.ok && v6FarmAfterStopCheck.isActive) {
      result.skippedStart = true;

      debugLog("Starting V6 farm skipped - already active on V6", {
        tokenId: String(tokenId)
      });

      return result;
    }

    try {
      debugLog("Starting V6 farm - sending tx", { tokenId: String(tokenId) });

      const startTx = await v6.startFarming(tokenId, { gasLimit: gasLimitStart });

      debugLog("Starting V6 farm - tx sent", {
        tokenId: String(tokenId),
        hash: startTx.hash
      });

      const startReceipt = await startTx.wait();

      debugLog("Starting V6 farm - receipt", {
        tokenId: String(tokenId),
        hash: startTx.hash,
        status: startReceipt.status,
        blockNumber: startReceipt.blockNumber
      });

      if (startReceipt.status !== 1) {
        throw new Error(`V6 start tx failed onchain for ${tokenId}`);
      }

      result.startedOnV6 = true;
    } catch (e) {
      const errMsg = getErrorMessage(e);

      debugLog("Starting V6 farm - FAILED", {
        tokenId: String(tokenId),
        error: errMsg
      });

      if (isUserRejectedError(e)) {
        throw new Error("Migration cancelled by user during V6 start.");
      }

      if (isNonceError(e)) {
        throw new Error(`V6 start failed due to nonce/pending transaction issue: ${errMsg}`);
      }

      throw new Error(`V6 start failed for ${tokenId}: ${errMsg}`);
    }
  } else {
    result.skippedStart = true;
  }

  debugLog("Migration complete", result);
  return result;
}

export async function migrateManyFarmsV5ToV6(tokenIds = [], options = {}) {
  const results = [];

  for (const tokenId of tokenIds) {
    try {
      debugLog("Batch migration - next token", { tokenId: String(tokenId) });
      const res = await migrateSingleFarmV5ToV6(tokenId, options);
      results.push({ ok: true, ...res });
    } catch (e) {
      results.push({
        ok: false,
        tokenId: String(tokenId),
        error: getErrorMessage(e)
      });

      debugLog("Batch migration - token failed", {
        tokenId: String(tokenId),
        error: getErrorMessage(e)
      });
    }
  }

  debugLog("Batch migration finished", {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length
  });

  return results;
}