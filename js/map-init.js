/* =========================================================
   MAP INIT / WALLET / EVENTS – V6 + MERCENARY V4
   HARDENED VERSION
   - no duplicate event binding
   - no duplicate initial load
   - guarded polling
   - sequential loading
   - stale connect protection
   ========================================================= */

   import { STORAGE_WALLET_FLAG } from "./config.js";
   import { state } from "./state.js";
   import { byId, safeText, shortenAddress, debugLog } from "./utils.js";
   import { connectWalletCore, clearContracts } from "./contracts.js";
   import { setupLegacyMigrationContracts } from "./migration.js";
   import { mapState, stopMapPollers, resetMapRuntimeState } from "./map-state.js";
   import {
     initMapReadOnly,
     loadMapData,
     loadMapUserResources,
     loadMapUserAttacks,
     getAllMapTokens
   } from "./map-data.js";
   import { bindMapRenderEvents, resizeCanvas, drawPyramid } from "./map-render.js";
   import { refreshSelectedTargetAttackPreview, updateSidebar } from "./map-selection.js";
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
     handleExtendProtection,
     handleCancelProtection,
     handleMoveProtection,
     handleEmergencyMoveProtection,
     handleCleanupProtection,
     handleUnlockSlot2,
     handleUnlockSlot3,
     handleSaveBastionTitle
   } from "./map-actions.js";
   
   /* =========================================================
      MODULE FLAGS / GUARDS
      ========================================================= */
   
   let mapEventsBound = false;
   let mapRenderEventsBound = false;
   let mapPageInitialized = false;
   let connectSessionId = 0;
   
   /* =========================================================
      LOAD GUARDS
      ========================================================= */
   
   async function guardedLoadMapData() {
     if (mapState.isLoadingData) return false;
   
     mapState.isLoadingData = true;
     try {
       await loadMapData();
       return true;
     } catch (err) {
       debugLog("guardedLoadMapData failed", err?.message || err);
       throw err;
     } finally {
       mapState.isLoadingData = false;
     }
   }
   
   async function guardedLoadMapUserResources() {
     if (!state.userAddress) return false;
     if (mapState.isLoadingUserResources) return false;
   
     mapState.isLoadingUserResources = true;
     try {
       await loadMapUserResources();
       return true;
     } catch (err) {
       debugLog("guardedLoadMapUserResources failed", err?.message || err);
       throw err;
     } finally {
       mapState.isLoadingUserResources = false;
     }
   }
   
   async function guardedLoadMapUserAttacks() {
     if (!state.userAddress) return false;
     if (mapState.isLoadingUserAttacks) return false;
   
     mapState.isLoadingUserAttacks = true;
     try {
       await loadMapUserAttacks();
       return true;
     } catch (err) {
       debugLog("guardedLoadMapUserAttacks failed", err?.message || err);
       throw err;
     } finally {
       mapState.isLoadingUserAttacks = false;
     }
   }
   
   /* =========================================================
      UI HELPERS
      ========================================================= */
   
   function setWalletUiConnected() {
     safeText("walletAddress", shortenAddress(state.userAddress));
     safeText("connectBtn", "Connected");
   }
   
   function setWalletUiDisconnected() {
     safeText("walletAddress", "Not connected");
     safeText("connectBtn", "Connect");
   }
   
   function resetDisconnectedPanels() {
     const blockDetail = byId("blockDetail");
     if (blockDetail) {
       blockDetail.innerHTML = `<p style="color:#98a9b9; text-align:center;">Click a block</p>`;
     }
   
     const actionPanel = byId("actionPanel");
     if (actionPanel) actionPanel.style.display = "none";
   
     const userResources = byId("userResources");
     if (userResources) {
       userResources.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
     }
   
     const userAttacksList = byId("userAttacksList");
     if (userAttacksList) {
       userAttacksList.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
     }
   }
   
   function resetMapLoadingFlags() {
     mapState.isLoadingData = false;
     mapState.isLoadingUserResources = false;
     mapState.isLoadingUserAttacks = false;
   }

   /* =========================================================
      ATTACK DEEP LINK HELPERS
      ========================================================= */

   function readAttackDeepLink() {
     try {
       const params = new URLSearchParams(window.location.search || "");

       const attacker = params.get("attacker");
       const targetTokenId = params.get("targetTokenId");
       const attackIndex = params.get("attackIndex");

       const parsed = {
         attacker: attacker && /^\d+$/.test(attacker) ? String(attacker) : null,
         targetTokenId: targetTokenId && /^\d+$/.test(targetTokenId) ? Number(targetTokenId) : null,
         attackIndex: attackIndex && /^\d+$/.test(attackIndex) ? Number(attackIndex) : null
       };

       if (!parsed.attacker && parsed.targetTokenId === null && parsed.attackIndex === null) {
         return null;
       }

       return parsed;
     } catch {
       return null;
     }
   }

   function clearAttackDeepLinkFocus() {
     document.querySelectorAll(".attack-item.attack-deeplink-focus").forEach((el) => {
       el.classList.remove("attack-deeplink-focus");
       el.style.outline = "";
       el.style.boxShadow = "";
     });
   }

   function highlightDeepLinkedAttack(targetTokenId, attackIndex) {
     if (!Number.isFinite(Number(targetTokenId)) || !Number.isFinite(Number(attackIndex))) return false;

     clearAttackDeepLinkFocus();

     const row = document
       .querySelector(`.execute-btn[data-targetid="${Number(targetTokenId)}"][data-attackindex="${Number(attackIndex)}"]`)
       ?.closest(".attack-item");

     if (!row) return false;

     row.classList.add("attack-deeplink-focus");
     row.style.outline = "1px solid #d4af37";
     row.style.boxShadow = "0 0 0 1px rgba(212,175,55,0.25)";
     row.scrollIntoView({ behavior: "smooth", block: "center" });
     return true;
   }

   async function applyAttackDeepLinkContext() {
     const ctx = readAttackDeepLink();
     if (!ctx) return;

     mapState.pendingAttackDeepLink = ctx;

     if (ctx.attacker) {
       mapState.selectedAttackAttackerTokenId = String(ctx.attacker);
     }

     const tokens = getAllMapTokens();
     if (ctx.targetTokenId !== null && tokens[String(ctx.targetTokenId)]) {
       await updateSidebar(String(ctx.targetTokenId));
     }

     requestAnimationFrame(() => {
       const matched = ctx.targetTokenId !== null && ctx.attackIndex !== null
         ? highlightDeepLinkedAttack(ctx.targetTokenId, ctx.attackIndex)
         : false;

       const deepLinkMessage = byId("mapAttackDeepLinkMessage");
       if (deepLinkMessage) {
         deepLinkMessage.style.display = "block";
         deepLinkMessage.innerHTML = ctx.targetTokenId !== null && ctx.attackIndex !== null
           ? (matched
               ? `<span class="success">🗺️ Loaded target #${ctx.targetTokenId}, attack index ${ctx.attackIndex}. Use ⚔️ to execute if the attack is ready.</span>`
               : `<span class="success">🗺️ Loaded target #${ctx.targetTokenId}, attack index ${ctx.attackIndex}. If the row is not visible yet, refresh once or wait a few seconds for subgraph sync.</span>`)
           : `<span class="success">🗺️ Loaded target #${ctx.targetTokenId}.</span>`;
       }

       if (window.location.hash === "#attack") {
         const attackInput = byId("attackInput");
         const userAttacksList = byId("userAttacksList");
         (attackInput || userAttacksList)?.scrollIntoView({ behavior: "smooth", block: "center" });
       }
     });
   }
   
   /* =========================================================
      POLLERS
      ========================================================= */
   
   function startMapPollers() {
     if (!mapState.attacksPoller) {
       mapState.attacksPoller = setInterval(async () => {
         if (!state.userAddress) return;
         if (document.hidden) return;
   
         try {
           await guardedLoadMapUserAttacks();
         } catch (err) {
           debugLog("attacksPoller error", err?.message || err);
         }
       }, 30000);
     }
   
     if (!mapState.dataPoller) {
       mapState.dataPoller = setInterval(async () => {
         if (document.hidden) return;
   
         try {
           const changed = await guardedLoadMapData();
           if (changed) {
             populateAttackerSelect();
             drawPyramid();
           }
         } catch (err) {
           debugLog("dataPoller error", err?.message || err);
         }
       }, 30000);
     }
   
     if (!mapState.resourcesPoller) {
       mapState.resourcesPoller = setInterval(async () => {
         if (!state.userAddress) return;
         if (document.hidden) return;
   
         try {
           await guardedLoadMapUserResources();
         } catch (err) {
           debugLog("resourcesPoller error", err?.message || err);
         }
       }, 45000);
     }
   }
   
   /* =========================================================
      CONNECT / DISCONNECT
      ========================================================= */
   
   async function connectWallet(forceRequest = true) {
     if (!window.ethereum) {
       alert("Please install MetaMask!");
       return;
     }
   
     if (mapState.isConnecting) return;
     if (state.userAddress && forceRequest) return;
   
     const sessionId = ++connectSessionId;
     mapState.isConnecting = true;
   
     try {
       const ok = await connectWalletCore(forceRequest);
       if (!ok) return;
       if (sessionId !== connectSessionId) return;
   
       setupLegacyMigrationContracts();
       localStorage.setItem(STORAGE_WALLET_FLAG, "1");
   
       setWalletUiConnected();
   
       await guardedLoadMapData();
       if (sessionId !== connectSessionId) return;
   
       await guardedLoadMapUserResources();
       if (sessionId !== connectSessionId) return;
   
       await guardedLoadMapUserAttacks();
       if (sessionId !== connectSessionId) return;
   
       populateAttackerSelect();
       updateMapFarmBoostCostLabels();
       updateMapPirateBoostCostLabels();
       await updateMapMercenaryCostPreview();
   
       if (mapState.selectedTokenId) {
         await refreshSelectedTargetAttackPreview();
       }
   
       drawPyramid();
       startMapPollers();
       await applyAttackDeepLinkContext();

       debugLog("Map wallet connected", state.userAddress);
     } catch (err) {
       alert("Connection error: " + (err?.reason || err?.message || err));
       clearContracts();
       setWalletUiDisconnected();
       resetMapLoadingFlags();
     } finally {
       mapState.isConnecting = false;
     }
   }
   
   function disconnectMapWallet() {
     connectSessionId += 1;
   
     localStorage.removeItem(STORAGE_WALLET_FLAG);
   
     stopMapPollers();
     clearContracts();
     resetMapRuntimeState();
     resetMapLoadingFlags();
   
     setWalletUiDisconnected();
     resetDisconnectedPanels();
   
     drawPyramid();
     debugLog("Map wallet disconnected");
   }
   
   /* =========================================================
      EVENT BINDING
      ========================================================= */
   
   function bindMapEvents() {
     if (mapEventsBound) return;
     mapEventsBound = true;
   
     byId("connectBtn")?.addEventListener("click", () => {
       if (state.userAddress) {
         disconnectMapWallet();
       } else {
         connectWallet(true);
       }
     });
   
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
       if (!mapState.selectedTokenId) return;
       await refreshSelectedTargetAttackPreview();
     });
   
     byId("attackAttackerSelect")?.addEventListener("change", async () => {
       const select = byId("attackAttackerSelect");
       mapState.selectedAttackAttackerTokenId = select?.value || null;
   
       if (!mapState.selectedTokenId) return;
       await refreshSelectedTargetAttackPreview();
     });
   
     document.addEventListener("visibilitychange", async () => {
       if (document.hidden) return;
   
       try {
         const changed = await guardedLoadMapData();
         if (changed) {
           populateAttackerSelect();
           drawPyramid();
         }
   
         if (state.userAddress) {
           await guardedLoadMapUserResources();
           await loadMapUserAttacks({ forceFresh: true });
         }

         await applyAttackDeepLinkContext();
       } catch (err) {
         debugLog("visibility refresh failed", err?.message || err);
       }
     });
   
     document.addEventListener("click", async (e) => {
       const executeBtn = e.target.closest(".execute-btn");
       if (executeBtn) {
         e.preventDefault();
         e.stopPropagation();
   
         const attack = {
           id: executeBtn.dataset.attackid || null,
           targetTokenId: Number(executeBtn.dataset.targetid || 0),
           attackIndex: Number(executeBtn.dataset.attackindex || 0),
           resource: Number(executeBtn.dataset.resource || 0)
         };
   
         if (!Number.isFinite(attack.targetTokenId) || attack.targetTokenId <= 0) return;
         if (!Number.isFinite(attack.attackIndex) || attack.attackIndex < 0) return;
   
         await executeAttack(attack);
         return;
       }
   
       const cancelBtn = e.target.closest(".cancel-attack-btn");
       if (cancelBtn) {
         e.preventDefault();
         e.stopPropagation();
   
         const targetTokenId = Number(cancelBtn.dataset.targetid || 0);
         const attackIndex = Number(cancelBtn.dataset.attackindex || 0);
   
         if (!Number.isFinite(targetTokenId) || targetTokenId <= 0) return;
         if (!Number.isFinite(attackIndex) || attackIndex < 0) return;
   
         await cancelAttack(targetTokenId, attackIndex);
         return;
       }
   
       const button = e.target.closest("button");
       if (!button) return;
   
       if (button.id === "revealBtn") return await handleReveal();
       if (button.id === "startFarmBtn") return await handleStartFarm();
       if (button.id === "stopFarmBtn") return await handleStopFarm();
       if (button.id === "claimBtn") return await handleClaim();
       if (button.id === "buyBoostBtn") return await handleBuyBoost();
       if (button.id === "protectBtn") return await handleProtect();
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
   
   /* =========================================================
      PAGE INIT
      ========================================================= */
   
   export async function initMapPage() {
     if (!mapPageInitialized) {
       await initMapReadOnly();
   
       resizeCanvas();
   
       if (!mapRenderEventsBound) {
         bindMapRenderEvents();
         mapRenderEventsBound = true;
       }
   
       bindMapEvents();
       initMapUI();
   
       updateMapFarmBoostCostLabels();
       updateMapPirateBoostCostLabels();
       await updateMapMercenaryCostPreview();
   
       mapPageInitialized = true;
     }
   
     const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
   
     if (shouldReconnect) {
       await connectWallet(false);
       return;
     }
   
     await guardedLoadMapData();
     populateAttackerSelect();
     drawPyramid();
     await applyAttackDeepLinkContext();
   }