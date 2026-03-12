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
       // Execute attack button
       const executeBtn = e.target.closest(".execute-btn");
       if (executeBtn) {
         e.preventDefault();
         e.stopPropagation();
   
         console.log("execute-btn clicked", executeBtn.dataset);
   
         const attack = {
           id: executeBtn.dataset.attackid || null,
           targetTokenId: Number(executeBtn.dataset.targetid || 0),
           attackIndex: Number(executeBtn.dataset.attackindex || 0),
           resource: Number(executeBtn.dataset.resource || 0)
         };
   
         if (!Number.isFinite(attack.targetTokenId) || attack.targetTokenId <= 0) {
           console.warn("Invalid execute attack targetTokenId", executeBtn.dataset);
           return;
         }
   
         if (!Number.isFinite(attack.attackIndex) || attack.attackIndex < 0) {
           console.warn("Invalid execute attack index", executeBtn.dataset);
           return;
         }
   
         await executeAttack(attack);
         return;
       }
   
       // Cancel attack button
       const cancelBtn = e.target.closest(".cancel-attack-btn");
       if (cancelBtn) {
         e.preventDefault();
         e.stopPropagation();
   
         console.log("cancel-attack-btn clicked", cancelBtn.dataset);
   
         const targetTokenId = Number(cancelBtn.dataset.targetid || 0);
         const attackIndex = Number(cancelBtn.dataset.attackindex || 0);
   
         if (!Number.isFinite(targetTokenId) || targetTokenId <= 0) {
           console.warn("Invalid cancel attack targetTokenId", cancelBtn.dataset);
           return;
         }
   
         if (!Number.isFinite(attackIndex) || attackIndex < 0) {
           console.warn("Invalid cancel attack index", cancelBtn.dataset);
           return;
         }
   
         await cancelAttack(targetTokenId, attackIndex);
         return;
       }
   
       // Regular buttons with IDs
       const button = e.target.closest("button");
       if (!button) return;
   
       if (button.id === "revealBtn") return await handleReveal();
       if (button.id === "startFarmBtn") return await handleStartFarm();
       if (button.id === "stopFarmBtn") return await handleStopFarm();
       if (button.id === "claimBtn") return await handleClaim();
       if (button.id === "buyBoostBtn") return await handleBuyBoost();
       if (button.id === "protectBtn") return await handleProtect();
       if (button.id === "setProtectionBtn") return await handleSetProtection();
       if (button.id === "extendProtectionBtn") return await handleExtendProtection();
       if (button.id === "cancelProtectionBtn") return await handleCancelProtection();
       if (button.id === "moveProtectionBtn") return await handleMoveProtection();
       if (button.id === "emergencyMoveProtectionBtn") return await handleEmergencyMoveProtection();
       if (button.id === "cleanupProtectionBtn") return await handleCleanupProtection();
       if (button.id === "unlockSlot2Btn") return await handleUnlockSlot2();
       if (button.id === "unlockSlot3Btn") return await handleUnlockSlot3();
       if (button.id === "saveBastionTitleBtn") return await handleSaveBastionTitle();
       if (button.id === "attackBtn") return await handleAttack();
       if (button.id === "migrateFarmBtn") return await handleMigrateToV6();
       if (button.id === "buyPirateBoostBtn") return await handleBuyPirateBoost();
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
       await connectWallet(false);
     }
   }