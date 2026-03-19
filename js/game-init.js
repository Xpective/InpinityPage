/* =========================================================
   GAME INIT / ORCHESTRATOR
   HARDENED VERSION
   - Attack flow on game page reduced
   - Heavy attack execution moved to map.html
   - Optional attacker select only if present in HTML
   - guarded reconnect / polling / event binding
   ========================================================= */

   import {
    STORAGE_WALLET_FLAG
  } from "./config.js";
  
  import {
    state
  } from "./state.js";
  
  import { byId, debugLog } from "./utils.js";
  import { clearContracts, connectWalletCore } from "./contracts.js";
  
  import { setWalletUIConnected, setWalletUIDisconnected } from "./wallet-ui.js";
  import { updateBalances, updatePoolInfo } from "./balances.js";
  import { loadResourceBalancesOnchain } from "./resources.js";
  import { loadUserBlocks } from "./blocks.js";
  import { ensureFarmingApproval } from "./approvals.js";
  
  import {
    initAttackResourceSelect,
    loadUserAttacks,
    refreshBlockMarkings,
    attack,
    stopAttacksTicker,
    buyPirateBoost,
    updateBoostCostLabels,
    updateAttackerSelectorUi,
    handleAttackerSelectionChange
  } from "./attacks.js";
  
  import {
    startFarmingSelected,
    stopFarmingSelected,
    resetPurchasedFarmSelected,
    claimSelected,
    buyBoost,
    migrateSelectedFarmToV6,
    migrateAllMyV5Farms,
    protect,
    loadMercenaryPanelState,
    extendMercenaryProtection,
    cancelMercenaryProtection,
    moveMercenaryProtection,
    emergencyMoveMercenaryProtection,
    unlockMercenarySecondSlot,
    unlockMercenaryThirdSlot,
    cleanSelectedProtection,
    saveBastionTitle,
    updateFarmBoostCostLabel,
    updateMercenaryCostPreview
  } from "./farming.js";
  
  import { revealSelected } from "./reveal.js";
  import { findRandomFreeBlock, mintBlock } from "./mint.js";
  import { exchangeINPI, exchangePit } from "./exchange.js";
  
  /* =========================================================
     MODULE FLAGS / LOAD GUARDS
     ========================================================= */
  
  let gamePageInitialized = false;
  let connectSessionId = 0;
  
  function ensureGameStateGuards() {
    if (typeof state.isLoadingBlocks !== "boolean") state.isLoadingBlocks = false;
    if (typeof state.isLoadingAttacks !== "boolean") state.isLoadingAttacks = false;
    if (typeof state.isLoadingMercenaryPanel !== "boolean") state.isLoadingMercenaryPanel = false;
    if (typeof state.isLoadingBalances !== "boolean") state.isLoadingBalances = false;
    if (typeof state.isLoadingResources !== "boolean") state.isLoadingResources = false;
  }
  
  /* =========================================================
     HELPERS
     ========================================================= */
  
  async function initLightAttackUi() {
    try {
      if (byId("attackResourceSelect")) {
        initAttackResourceSelect();
      }
  
      if (byId("attackAttackerTokenId")) {
        await updateAttackerSelectorUi();
      }
    } catch (e) {
      console.warn("initLightAttackUi failed:", e);
    }
  }
  
  function clearUiMessages() {
    const ids = [
      "approveMessage",
      "attackMessage",
      "protectMessage",
      "actionMessage",
      "pirateBoostMessage",
      "exchangeMessage",
      "mintMessage"
    ];
  
    ids.forEach((id) => {
      const el = byId(id);
      if (el) el.innerHTML = "";
    });
  }
  
  function resetGamePanelsDisconnected() {
    const userAttacksList = byId("userAttacksList");
    if (userAttacksList) {
      userAttacksList.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
    }
  
    const attackerSelect = byId("attackAttackerTokenId");
    if (attackerSelect) {
      attackerSelect.innerHTML = `<option value="">Connect wallet first…</option>`;
    }
  
    const blocksGrid = byId("blocksGrid");
    if (blocksGrid) {
      blocksGrid.innerHTML = `<p class="empty-state">Connect wallet to see your blocks.</p>`;
    }
  }
  
  async function guardedUpdateBalances() {
    if (state.isLoadingBalances) return false;
    state.isLoadingBalances = true;
    try {
      await updateBalances();
      await updatePoolInfo();
      return true;
    } finally {
      state.isLoadingBalances = false;
    }
  }
  
  async function guardedLoadResourceBalances() {
    if (state.isLoadingResources) return false;
    state.isLoadingResources = true;
    try {
      await loadResourceBalancesOnchain();
      return true;
    } finally {
      state.isLoadingResources = false;
    }
  }
  
  async function guardedLoadBlocks() {
    if (state.isLoadingBlocks) return false;
    state.isLoadingBlocks = true;
    try {
      await loadUserBlocks({
        onRevealSelected: async () => {
          await revealSelected();
        },
        onRefreshBlockMarkings: refreshBlockMarkings
      });
      return true;
    } finally {
      state.isLoadingBlocks = false;
    }
  }
  
  async function guardedLoadAttacks() {
    if (state.isLoadingAttacks) return false;
    state.isLoadingAttacks = true;
    try {
      await loadUserAttacks();
      return true;
    } finally {
      state.isLoadingAttacks = false;
    }
  }
  
  async function guardedLoadMercenaryPanel() {
    if (state.isLoadingMercenaryPanel) return false;
    state.isLoadingMercenaryPanel = true;
    try {
      await loadMercenaryPanelState();
      return true;
    } finally {
      state.isLoadingMercenaryPanel = false;
    }
  }
  
  function startGamePollers() {
    if (!state.attacksPoller) {
      state.attacksPoller = setInterval(async () => {
        if (!state.userAddress) return;
        if (document.hidden) return;
  
        try {
          await guardedLoadAttacks();
          refreshBlockMarkings();
        } catch (e) {
          console.warn("Attack refresh failed:", e);
        }
  
        try {
          await guardedLoadMercenaryPanel();
        } catch (e) {
          console.warn("Mercenary poll refresh failed:", e);
        }
      }, 45000);
    }
  
    if (!state.gameBlocksPoller) {
      state.gameBlocksPoller = setInterval(async () => {
        if (!state.userAddress) return;
        if (document.hidden) return;
  
        try {
          const changed = await guardedLoadBlocks();
          if (changed) {
            refreshBlockMarkings();
          }
        } catch (e) {
          console.warn("Blocks refresh failed:", e);
        }
      }, 60000);
    }
  
    if (!state.gameBalancesPoller) {
      state.gameBalancesPoller = setInterval(async () => {
        if (!state.userAddress) return;
        if (document.hidden) return;
  
        try {
          await guardedUpdateBalances();
          await guardedLoadResourceBalances();
        } catch (e) {
          console.warn("Balance/resource refresh failed:", e);
        }
      }, 60000);
    }
  }
  
  function stopGamePollers() {
    stopAttacksTicker();
  
    if (state.attacksPoller) {
      clearInterval(state.attacksPoller);
      state.attacksPoller = null;
    }
  
    if (state.gameBlocksPoller) {
      clearInterval(state.gameBlocksPoller);
      state.gameBlocksPoller = null;
    }
  
    if (state.gameBalancesPoller) {
      clearInterval(state.gameBalancesPoller);
      state.gameBalancesPoller = null;
    }
  }
  
  /* =========================================================
     WALLET CONNECT / DISCONNECT
     ========================================================= */
  
  async function connectWallet(forceRequest = true) {
    ensureGameStateGuards();
  
    if (state.isConnecting) return;
    if (state.userAddress && forceRequest) return;
  
    const sessionId = ++connectSessionId;
    state.isConnecting = true;
  
    try {
      const ok = await connectWalletCore(forceRequest);
      if (!ok) return;
      if (sessionId !== connectSessionId) return;
  
      try {
        localStorage.setItem(STORAGE_WALLET_FLAG, "1");
      } catch {}
  
      setWalletUIConnected(state.userAddress);
  
      updateFarmBoostCostLabel();
      updateBoostCostLabels();
      updateMercenaryCostPreview();
  
      await guardedUpdateBalances();
      if (sessionId !== connectSessionId) return;
  
      await guardedLoadResourceBalances();
      if (sessionId !== connectSessionId) return;
  
      await guardedLoadBlocks();
      if (sessionId !== connectSessionId) return;
  
      await guardedLoadMercenaryPanel();
      if (sessionId !== connectSessionId) return;
  
      await initLightAttackUi();
      if (sessionId !== connectSessionId) return;
  
      await guardedLoadAttacks();
      if (sessionId !== connectSessionId) return;
  
      refreshBlockMarkings();
      startGamePollers();
  
      clearUiMessages();
      debugLog("Wallet connected", state.userAddress);
    } catch (e) {
      console.error("connectWallet error:", e);
      alert("Connection error: " + (e?.reason || e?.message || "Unknown error"));
      clearContracts();
      setWalletUIDisconnected();
    } finally {
      state.isConnecting = false;
    }
  }
  
  function disconnectWallet() {
    connectSessionId += 1;
  
    try {
      localStorage.removeItem(STORAGE_WALLET_FLAG);
    } catch {}
  
    stopGamePollers();
    clearContracts();
    setWalletUIDisconnected();
    clearUiMessages();
    resetGamePanelsDisconnected();
  
    state.isLoadingBlocks = false;
    state.isLoadingAttacks = false;
    state.isLoadingMercenaryPanel = false;
    state.isLoadingBalances = false;
    state.isLoadingResources = false;
  
    debugLog("Wallet disconnected");
  }
  
  /* =========================================================
     APPROVAL ACTIONS
     ========================================================= */
  
  async function approveResourcesForFarming() {
    const msgDiv = byId("approveMessage");
  
    if (!state.userAddress || !state.resourceTokenContract) {
      if (msgDiv) {
        msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
      }
      return;
    }
  
    const btn = byId("approveResourcesBtn");
    const originalText =
      btn?.dataset?.originalText ||
      btn?.textContent ||
      "Approve Farming for Resources";
  
    try {
      if (btn) {
        if (!btn.dataset.originalText) btn.dataset.originalText = originalText;
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.pointerEvents = "none";
        btn.textContent = "Approving...";
      }
  
      if (msgDiv) {
        msgDiv.innerHTML = `<span class="success">⏳ Approving FarmingV6 for ResourceToken...</span>`;
      }
  
      const ok = await ensureFarmingApproval();
  
      if (!ok) {
        if (msgDiv) {
          msgDiv.innerHTML = `<span class="error">❌ Resource approval failed.</span>`;
        }
        return;
      }
  
      if (msgDiv) {
        msgDiv.innerHTML = `<span class="success">✅ Resource approval successful.</span>`;
      }
    } catch (e) {
      console.error("approveResourcesForFarming error:", e);
      if (msgDiv) {
        msgDiv.innerHTML = `<span class="error">❌ ${e?.reason || e?.message || "Approval failed."}</span>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
        btn.textContent = btn.dataset.originalText || "Approve Farming for Resources";
      }
    }
  }
  
  /* =========================================================
     EVENT BINDING
     ========================================================= */
  
  function bindEvents() {
    if (document.body.dataset.gameEventsBound === "1") return;
    document.body.dataset.gameEventsBound = "1";
  
    byId("connectWallet")?.addEventListener("click", () => connectWallet(true));
    byId("disconnectWallet")?.addEventListener("click", disconnectWallet);
  
    /* ==================== PIRATE ==================== */
    byId("attackBtn")?.addEventListener("click", attack);
    byId("buyPirateBoostBtn")?.addEventListener("click", buyPirateBoost);
    byId("pirateBoostDays")?.addEventListener("input", updateBoostCostLabels);
    byId("pirateBoostDays")?.addEventListener("change", updateBoostCostLabels);
    byId("attackAttackerTokenId")?.addEventListener("change", handleAttackerSelectionChange);
  
    /* ==================== MERCENARY ==================== */
    byId("protectBtn")?.addEventListener("click", protect);
    byId("extendProtectionBtn")?.addEventListener("click", extendMercenaryProtection);
    byId("cancelProtectionBtn")?.addEventListener("click", cancelMercenaryProtection);
    byId("moveProtectionBtn")?.addEventListener("click", moveMercenaryProtection);
    byId("emergencyMoveProtectionBtn")?.addEventListener("click", emergencyMoveMercenaryProtection);
    byId("unlockSlot2Btn")?.addEventListener("click", unlockMercenarySecondSlot);
    byId("unlockSlot3Btn")?.addEventListener("click", unlockMercenaryThirdSlot);
    byId("cleanupProtectionBtn")?.addEventListener("click", cleanSelectedProtection);
    byId("saveBastionTitleBtn")?.addEventListener("click", saveBastionTitle);
  
    byId("protectDays")?.addEventListener("input", updateMercenaryCostPreview);
    byId("protectDays")?.addEventListener("change", updateMercenaryCostPreview);
    byId("protectSlotIndex")?.addEventListener("change", updateMercenaryCostPreview);
    byId("mercenaryPaymentMode")?.addEventListener("change", updateMercenaryCostPreview);
    byId("protectTokenId")?.addEventListener("input", updateMercenaryCostPreview);
    byId("moveProtectionTargetTokenId")?.addEventListener("change", updateMercenaryCostPreview);
  
    /* ==================== REVEAL / FARMING ==================== */
    byId("revealBtn")?.addEventListener("click", revealSelected);
    byId("farmingStartBtn")?.addEventListener("click", startFarmingSelected);
    byId("farmingStopBtn")?.addEventListener("click", stopFarmingSelected);
    byId("resetPurchasedFarmBtn")?.addEventListener("click", resetPurchasedFarmSelected);
    byId("claimBtn")?.addEventListener("click", claimSelected);
    byId("buyBoostBtn")?.addEventListener("click", buyBoost);
  
    byId("boostDays")?.addEventListener("input", updateFarmBoostCostLabel);
    byId("boostDays")?.addEventListener("change", updateFarmBoostCostLabel);
  
    byId("migrateFarmBtn")?.addEventListener("click", migrateSelectedFarmToV6);
    byId("migrateAllV5Btn")?.addEventListener("click", migrateAllMyV5Farms);
  
    /* ==================== EXCHANGE ==================== */
    byId("exchangeInpiBtn")?.addEventListener("click", exchangeINPI);
    byId("exchangePitBtn")?.addEventListener("click", exchangePit);
  
    /* ==================== MINT ==================== */
    byId("randomBlockBtn")?.addEventListener("click", findRandomFreeBlock);
    byId("mintBtn")?.addEventListener("click", mintBlock);
  
    /* ==================== APPROVALS ==================== */
    byId("approveResourcesBtn")?.addEventListener("click", approveResourcesForFarming);
  
    /* ==================== PAYMENT MODE ==================== */
    document.querySelectorAll('input[name="payment"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.selectedPayment = e.target.value;
      });
    });
  
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) return;
      if (!state.userAddress) return;
  
      try {
        await guardedLoadBlocks();
        await guardedLoadAttacks();
        await guardedLoadMercenaryPanel();
        await guardedUpdateBalances();
        await guardedLoadResourceBalances();
        refreshBlockMarkings();
      } catch (e) {
        console.warn("visibility refresh failed:", e);
      }
    });
  
    updateFarmBoostCostLabel();
    updateBoostCostLabels();
    updateMercenaryCostPreview();
  }
  
  /* =========================================================
     ETHEREUM EVENT BINDING
     ========================================================= */
  
  function bindEthereumEvents() {
    if (!window.ethereum || window.ethereum.__inpinityBound) return;
  
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (!accounts || !accounts.length) {
        disconnectWallet();
        return;
      }
  
      if (
        state.userAddress &&
        accounts[0].toLowerCase() !== state.userAddress.toLowerCase()
      ) {
        disconnectWallet();
        await connectWallet(false);
      }
    });
  
    window.ethereum.on("chainChanged", () => window.location.reload());
    window.ethereum.__inpinityBound = true;
  }
  
  /* =========================================================
     PAGE INIT
     ========================================================= */
  
  export function initGamePage() {
    ensureGameStateGuards();
    setWalletUIDisconnected();
  
    if (!gamePageInitialized) {
      if (byId("attackResourceSelect")) {
        initAttackResourceSelect();
      }
  
      updateFarmBoostCostLabel();
      updateBoostCostLabels();
      updateMercenaryCostPreview();
  
      bindEvents();
      bindEthereumEvents();
  
      gamePageInitialized = true;
    }
  
    let shouldReconnect = false;
    try {
      shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
    } catch {}
  
    if (shouldReconnect) {
      connectWallet(false);
    } 
  }