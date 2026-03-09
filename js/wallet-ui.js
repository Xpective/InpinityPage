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
  
  export function setWalletUIConnected(addr) {
    safeHTML("walletStatus", "🟢 Connected");
    safeHTML("walletAddress", shortenAddress(addr));
    safeText("connectWallet", "Wallet Connected");
    safeDisabled("disconnectWallet", false);
  
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
  
    const blocksGrid = byId("blocksGrid");
    const userAttacksList = byId("userAttacksList");
    const userResourcesEl = byId("userResources");
    const selectedBlockInfo = byId("selectedBlockInfo");
    const blockActionsContainer = byId("blockActionsContainer");
    const noBlockSelected = byId("noBlockSelected");
    const migrateBtn = byId("migrateFarmBtn");
    const migrateAllBtn = byId("migrateAllV5Btn");
    const protectionStatusEl = byId("protectionStatus");
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
    if (protectionStatusEl) protectionStatusEl.style.display = "none";
    if (blockResources) blockResources.innerHTML = "<p>Select a block to see details.</p>";
  
    safeValue("protectTokenId", "");
    safeText("selectedBlockText", "No block selected");
    safeText("selectedActionToken", "No block selected");
    safeText("revealStatus", "Hidden");
    safeText("farmingStatus", "Inactive");
    safeText("claimStatus", "—");
    safeText("boostStatus", "Inactive");
    safeText("protectionExpiry", "—");
  
    safeDisabled("revealBtn", true);
    safeDisabled("farmingStartBtn", true);
    safeDisabled("farmingStopBtn", true);
    safeDisabled("claimBtn", true);
    safeDisabled("buyBoostBtn", true);
  }