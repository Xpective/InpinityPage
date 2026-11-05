/* =========================================================
   WALLET UI
   ========================================================= */

   import {
    byId,
    safeText,
    safeHTML,
    safeValue,
    safeDisabled,
    shortenAddress,
    debugLog
  } from "./utils.js";
  
  import { setupLegacyMigrationContracts } from "./migration.js";
  
  function setButtonVisualState(id, enabled) {
    const el = byId(id);
    if (!el) return;
  
    el.disabled = !enabled;
    el.style.opacity = enabled ? "1" : "0.45";
    el.style.pointerEvents = enabled ? "auto" : "none";
  }
  
  function resetMercenaryUi() {
    safeText("mercenaryRank", "Watchman");
    safeText("mercenaryPoints", "0");
    safeText("mercenaryDiscount", "0%");
    safeText("mercenarySlotsUnlocked", "1");
    safeText("mercenaryTitle", "—");
    safeText("protectionStatusText", "Inactive");
    safeText("protectionExpiry", "—");
    safeText("protectSlotInfo", "Selected Slot: 1");
    safeText("protectDaysInfo", "Duration: 7 days");
    safeText("mercenaryCostInfo", "Cost preview will appear here.");
    safeText("bastionTitleHint", "Locked until you reach 1000 Defender Points.");
    safeText("bastionTitleUnlockState", "Locked until 1000 Defender Points");
  
    const bastionInput = byId("bastionTitleInput");
    if (bastionInput) {
      bastionInput.value = "";
      bastionInput.disabled = true;
      bastionInput.style.opacity = "0.55";
    }
  
    setButtonVisualState("saveBastionTitleBtn", false);
  
    const slotSelect = byId("protectSlotIndex");
    if (slotSelect) {
      slotSelect.value = "0";
  
      const options = Array.from(slotSelect.options);
      const slot1 = options.find((o) => o.value === "0");
      const slot2 = options.find((o) => o.value === "1");
      const slot3 = options.find((o) => o.value === "2");
  
      if (slot1) {
        slot1.disabled = false;
        slot1.textContent = "Slot 1";
      }
      if (slot2) {
        slot2.disabled = true;
        slot2.textContent = "Slot 2 (locked)";
      }
      if (slot3) {
        slot3.disabled = true;
        slot3.textContent = "Slot 3 (locked)";
      }
    }
  
    const protectionStatusEl = byId("protectionStatus");
    if (protectionStatusEl) protectionStatusEl.style.display = "none";
  
    const slotsInfo = byId("mercenarySlotsInfo");
    if (slotsInfo) {
      slotsInfo.innerHTML = `<div class="resource-item">No active protection slots.</div>`;
    }
  }
  
  function resetPirateUi() {
    safeHTML(
      "attackerSelector",
      `
        <h4 style="margin:0 0 0.5rem; font-size:0.95rem;">Attack source</h4>
        <p class="info-note" style="font-size:0.8rem; margin:0;">
          Connect wallet and select a block above to use it as attacker.
        </p>
      `
    );
  
    safeHTML("attackRulesInfo", `<strong>Attack Check</strong><br>Enter valid coordinates.`);
    safeValue("attackRow", "");
    safeValue("attackCol", "");
    safeHTML("attackPreviewDetails", "");
    const preview = byId("attackPreviewDetails");
    if (preview) preview.style.display = "none";
  
    safeHTML("attackMessage", "");
    safeHTML("pirateBoostMessage", "");
  
    const resourceSelect = byId("attackResourceSelect");
    if (resourceSelect) resourceSelect.innerHTML = "";
  
    safeValue("pirateBoostDays", "7");
    safeText("pirateBoostCostInfo", "Total: 700 PIT");
  
    setButtonVisualState("attackBtn", false);
    setButtonVisualState("buyPirateBoostBtn", false);
  }
  
  function resetBlockActionUi() {
    safeValue("protectTokenId", "");
    safeText("selectedBlockText", "No block selected");
    safeText("selectedActionToken", "No block selected");
    safeText("revealStatus", "Hidden");
    safeText("farmingStatus", "Inactive");
    safeText("claimStatus", "—");
    safeText("boostStatus", "Inactive");
    safeText("revealHint", "Hidden blocks can be revealed once.");
    safeText("farmingHint", "Start farming on your selected block.");
    safeText("claimHint", "Claim becomes available when the cooldown is finished.");
    safeText("boostCostInfo", "Total: 700 INPI");
  
    safeValue("boostDays", "7");
    safeValue("protectDays", "7");
    safeValue("mercenaryPaymentMode", "resources");
  
    setButtonVisualState("revealBtn", false);
    setButtonVisualState("farmingStartBtn", false);
    setButtonVisualState("farmingStopBtn", false);
    setButtonVisualState("claimBtn", false);
    setButtonVisualState("buyBoostBtn", false);
    setButtonVisualState("protectBtn", true);
    setButtonVisualState("extendProtectionBtn", true);
    setButtonVisualState("cancelProtectionBtn", true);
    setButtonVisualState("moveProtectionBtn", true);
    setButtonVisualState("emergencyMoveProtectionBtn", true);
    setButtonVisualState("cleanupProtectionBtn", true);
    setButtonVisualState("unlockSlot2Btn", true);
    setButtonVisualState("unlockSlot3Btn", true);
  }
  
  export function setWalletUIConnected(addr) {
    safeHTML("walletStatus", "🟢 Connected");
    safeHTML("walletAddress", shortenAddress(addr));
    safeText("connectWallet", "Wallet Connected");
    safeDisabled("disconnectWallet", false);
  
    setButtonVisualState("disconnectWallet", true);
  
    try {
      setupLegacyMigrationContracts();
      debugLog("Migration contracts initialized");
    } catch (e) {
      console.warn("Migration contracts not available:", e.message);
    }
  }
  
  export function setWalletUIDisconnected() {
    safeHTML("walletStatus", "🔴 Not connected");
    safeHTML("walletAddress", "—");
    safeText("balanceEth", "0 ETH");
    safeText("balanceInpi", "0 INPI");
    safeText("balancePit", "0 PIT");
    safeText("userInpi", "0");
    safeText("userPitrone", "0");
    safeText("activeFarms", "0");
    safeText("connectWallet", "Connect Wallet");
    safeDisabled("disconnectWallet", true);
  
    setButtonVisualState("disconnectWallet", false);
  
    const blocksGrid = byId("blocksGrid");
    const userAttacksList = byId("userAttacksList");
    const userResourcesEl = byId("userResources");
    const selectedBlockInfo = byId("selectedBlockInfo");
    const blockActionsContainer = byId("blockActionsContainer");
    const noBlockSelected = byId("noBlockSelected");
    const migrateBtn = byId("migrateFarmBtn");
    const migrateAllBtn = byId("migrateAllV5Btn");
    const blockResources = byId("blockResources");
  
    if (blocksGrid) {
      blocksGrid.innerHTML = `<p class="empty-state">Connect wallet to see your blocks.</p>`;
    }
  
    if (userAttacksList) {
      userAttacksList.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
    }
  
    if (userResourcesEl) {
      userResourcesEl.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
    }
  
    if (selectedBlockInfo) selectedBlockInfo.style.display = "none";
    if (blockActionsContainer) blockActionsContainer.style.display = "none";
    if (noBlockSelected) noBlockSelected.style.display = "block";
    if (migrateBtn) migrateBtn.style.display = "none";
    if (migrateAllBtn) migrateAllBtn.style.display = "none";
  
    if (blockResources) {
      blockResources.innerHTML = "<p>Select a block to see details.</p>";
    }
  
    resetBlockActionUi();
    resetMercenaryUi();
    resetPirateUi();
  }