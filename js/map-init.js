/* =========================================================
   MAP INIT / WALLET / EVENTS
   ========================================================= */

   import { STORAGE_WALLET_FLAG } from "./config.js";
   import { state } from "./state.js";
   import { byId, safeText, shortenAddress, debugLog } from "./utils.js";
   import { connectWalletCore, clearContracts } from "./contracts.js";
   import { setupLegacyMigrationContracts } from "./migration.js";
   import { mapState } from "./map-state.js";
   import {
     initReadOnly,
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
     handleMigrateToV6
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
       drawPyramid();
   
       if (!mapState.attacksPoller) {
         mapState.attacksPoller = setInterval(() => loadMapUserAttacks(), 30000);
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
   
     byId("attackResource")?.addEventListener("change", async () => {
       if (mapState.selectedTokenId) {
         await refreshSelectedTargetAttackPreview();
       }
     });
   
     document.addEventListener("click", async (e) => {
       if (e.target.id === "revealBtn") await handleReveal();
       if (e.target.id === "startFarmBtn") await handleStartFarm();
       if (e.target.id === "stopFarmBtn") await handleStopFarm();
       if (e.target.id === "claimBtn") await handleClaim();
       if (e.target.id === "buyBoostBtn") await handleBuyBoost();
       if (e.target.id === "protectBtn") await handleProtect();
       if (e.target.id === "attackBtn") await handleAttack();
       if (e.target.id === "migrateFarmBtn") await handleMigrateToV6();
     });
   }
   
   export async function initMapPage() {
     await initReadOnly();
     resizeCanvas();
     bindMapRenderEvents();
     bindMapEvents();
     initMapUI();
   
     await loadMapData();
     populateAttackerSelect();
     drawPyramid();
   
     const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
     if (shouldReconnect) {
       connectWallet(false);
     }
   }