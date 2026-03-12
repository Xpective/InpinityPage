/* =========================================================
   MAP INIT / WALLET / EVENTS – V6 + MERCENARY V4
   ========================================================= */

import { STORAGE_WALLET_FLAG } from "./config.js";
import { state } from "./state.js";
import { byId, safeText, shortenAddress, debugLog } from "./utils.js";
import { connectWalletCore, clearContracts } from "./contracts.js";
import { setupLegacyMigrationContracts } from "./migration.js";
import { mapState } from "./map-state.js";
import {
  initMapReadOnly,
  loadMapData,
  loadMapUserResources,
  loadMapUserAttacks
} from "./map-data.js";
import { bindMapRenderEvents, resizeCanvas, drawPyramid } from "./map-render.js";
import { refreshSelectedTargetAttackPreview } from "./map-selection.js";
import { initMapUI, populateAttackerSelect } from "./map-ui.js";
import {
  handleReveal,
  handleStartFarm,
  handleStopFarm,
  handleClaim,
  handleBuyBoost,
  handleProtect,
  handleAttack,
  handleMigrateToV6,
  executeAttack,
  cancelAttack,
  updateMapFarmBoostCostLabels,
  updateMapPirateBoostCostLabels,
  updateMapMercenaryCostPreview,
  handleBuyPirateBoost,
  handleSetProtection,
  handleExtendProtection,
  handleCancelProtection,
  handleMoveProtection,
  handleEmergencyMoveProtection,
  handleCleanupProtection,
  handleUnlockSlot2,
  handleUnlockSlot3,
  handleSaveBastionTitle
} from "./map-actions.js";

async function connectWallet(forceRequest = true) {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return;
  }
  if (mapState.isConnecting) return;
  if (state.userAddress) return;

  mapState.isConnecting = true;

  try {
    const ok = await connectWalletCore(forceRequest);
    if (!ok) return;

    setupLegacyMigrationContracts();
    localStorage.setItem(STORAGE_WALLET_FLAG, "1");

    safeText("walletAddress", shortenAddress(state.userAddress));
    safeText("connectBtn", "Connected");

    await Promise.all([
      loadMapData(),
      loadMapUserResources(),
      loadMapUserAttacks()
    ]);

    populateAttackerSelect();
    updateMapFarmBoostCostLabels();
    updateMapPirateBoostCostLabels();
    await updateMapMercenaryCostPreview();
    drawPyramid();

    if (!mapState.attacksPoller) {
      mapState.attacksPoller = setInterval(() => {
        loadMapUserAttacks();
      }, 30000);
    }

    if (!mapState.dataPoller) {
      mapState.dataPoller = setInterval(async () => {
        await loadMapData();
        populateAttackerSelect();
      }, 30000);
    }

    debugLog("Map wallet connected", state.userAddress);
  } catch (err) {
    alert("Connection error: " + (err?.reason || err?.message || err));
    clearContracts();
  } finally {
    mapState.isConnecting = false;
  }
}

function bindMapEvents() {
  byId("connectBtn")?.addEventListener("click", () => connectWallet(true));

  byId("boostDays")?.addEventListener("input", updateMapFarmBoostCostLabels);
  byId("boostDays")?.addEventListener("change", updateMapFarmBoostCostLabels);

  byId("pirateBoostDays")?.addEventListener("input", updateMapPirateBoostCostLabels);
  byId("pirateBoostDays")?.addEventListener("change", updateMapPirateBoostCostLabels);

  byId("protectDays")?.addEventListener("input", updateMapMercenaryCostPreview);
  byId("protectDays")?.addEventListener("change", updateMapMercenaryCostPreview);

  byId("protectSlotIndex")?.addEventListener("change", updateMapMercenaryCostPreview);
  byId("mercenaryPaymentMode")?.addEventListener("change", updateMapMercenaryCostPreview);
  byId("protectTokenId")?.addEventListener("input", updateMapMercenaryCostPreview);

  byId("attackResource")?.addEventListener("change", async () => {
    if (mapState.selectedTokenId) {
      await refreshSelectedTargetAttackPreview();
    }
  });

  byId("attackAttackerSelect")?.addEventListener("change", async () => {
    const select = byId("attackAttackerSelect");
    mapState.selectedAttackAttackerTokenId = select?.value || null;
    if (mapState.selectedTokenId) {
      await refreshSelectedTargetAttackPreview();
    }
  });

  document.addEventListener("click", async (e) => {
    const target = e.target.closest("button");
    if (!target) return;

    if (target.id === "revealBtn") return await handleReveal();
    if (target.id === "startFarmBtn") return await handleStartFarm();
    if (target.id === "stopFarmBtn") return await handleStopFarm();
    if (target.id === "claimBtn") return await handleClaim();
    if (target.id === "buyBoostBtn") return await handleBuyBoost();
    if (target.id === "protectBtn") return await handleProtect();
    if (target.id === "setProtectionBtn") return await handleSetProtection();
    if (target.id === "extendProtectionBtn") return await handleExtendProtection();
    if (target.id === "cancelProtectionBtn") return await handleCancelProtection();
    if (target.id === "moveProtectionBtn") return await handleMoveProtection();
    if (target.id === "emergencyMoveProtectionBtn") return await handleEmergencyMoveProtection();
    if (target.id === "cleanupProtectionBtn") return await handleCleanupProtection();
    if (target.id === "unlockSlot2Btn") return await handleUnlockSlot2();
    if (target.id === "unlockSlot3Btn") return await handleUnlockSlot3();
    if (target.id === "saveBastionTitleBtn") return await handleSaveBastionTitle();
    if (target.id === "attackBtn") return await handleAttack();
    if (target.id === "migrateFarmBtn") return await handleMigrateToV6();
    if (target.id === "buyPirateBoostBtn") return await handleBuyPirateBoost();

    if (target.classList.contains("execute-btn")) {
      const attack = {
        id: target.dataset.attackid || null,
        targetTokenId: parseInt(target.dataset.targetid || "0", 10),
        attackIndex: parseInt(target.dataset.attackindex || "0", 10),
        resource: parseInt(target.dataset.resource || "0", 10)
      };

      if (!Number.isFinite(attack.targetTokenId) || !Number.isFinite(attack.attackIndex)) {
        console.warn("Invalid execute attack payload", target.dataset);
        return;
      }

      return await executeAttack(attack);
    }

    if (target.classList.contains("cancel-attack-btn")) {
      const targetTokenId = parseInt(target.dataset.targetid || "0", 10);
      const attackIndex = parseInt(target.dataset.attackindex || "0", 10);

      if (!Number.isFinite(targetTokenId) || !Number.isFinite(attackIndex)) {
        console.warn("Invalid cancel attack payload", target.dataset);
        return;
      }

      return await cancelAttack(targetTokenId, attackIndex);
    }
  });
}

export async function initMapPage() {
  await initMapReadOnly();
  resizeCanvas();
  bindMapRenderEvents();
  bindMapEvents();
  initMapUI();

  updateMapFarmBoostCostLabels();
  updateMapPirateBoostCostLabels();
  await updateMapMercenaryCostPreview();

  await loadMapData();
  populateAttackerSelect();
  drawPyramid();

  const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
  if (shouldReconnect) {
    connectWallet(false);
  }
}
