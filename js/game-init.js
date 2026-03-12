/* =========================================================
   GAME INIT / ORCHESTRATOR
   ========================================================= */

   import { STORAGE_WALLET_FLAG } from "./config.js";
   import { state } from "./state.js";
   import { byId, debugLog } from "./utils.js";
   import { clearContracts, connectWalletCore } from "./contracts.js";
   
   import { setWalletUIConnected, setWalletUIDisconnected } from "./wallet-ui.js";
   import { updateBalances, updatePoolInfo } from "./balances.js";
   import { loadResourceBalancesOnchain } from "./resources.js";
   import { loadUserBlocks } from "./blocks.js";
   import { ensureFarmingApproval } from "./approvals.js";
   
   import {
     initAttackResourceSelect,
     scheduleAttackDropdownRefresh,
     loadUserAttacks,
     refreshBlockMarkings,
     attack,
     stopAttacksTicker,
     buyPirateBoost,
     updateBoostCostLabels
   } from "./attacks.js";
   
   import {
     startFarmingSelected,
     stopFarmingSelected,
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
      WALLET CONNECT / DISCONNECT
      ========================================================= */
   
   async function connectWallet(forceRequest = true) {
     if (state.isConnecting) return;
     state.isConnecting = true;
   
     try {
       const ok = await connectWalletCore(forceRequest);
       if (!ok) return;
   
       localStorage.setItem(STORAGE_WALLET_FLAG, "1");
       setWalletUIConnected(state.userAddress);
   
       initAttackResourceSelect();
       updateFarmBoostCostLabel();
       updateBoostCostLabels();
       updateMercenaryCostPreview();
   
       await updateBalances();
       await updatePoolInfo();
       await loadResourceBalancesOnchain();
   
       await loadUserBlocks({
         onRevealSelected: revealSelected,
         onRefreshBlockMarkings: refreshBlockMarkings
       });
   
       await loadUserAttacks();
       await loadMercenaryPanelState();
   
       scheduleAttackDropdownRefresh();
   
       if (!state.attacksPoller) {
         state.attacksPoller = setInterval(async () => {
           if (!state.userAddress) return;
   
           try {
             await loadUserAttacks();
             refreshBlockMarkings();
           } catch (e) {
             console.warn("Attack refresh failed:", e);
           }
   
           try {
             await loadMercenaryPanelState();
           } catch (e) {
             console.warn("Mercenary poll refresh failed:", e);
           }
         }, 45000);
       }
   
       const approveMsg = byId("approveMessage");
       if (approveMsg) approveMsg.innerHTML = "";
   
       debugLog("Wallet connected", state.userAddress);
     } catch (e) {
       console.error(e);
       alert("Connection error: " + (e.reason || e.message || "Unknown error"));
       clearContracts();
       setWalletUIDisconnected();
     } finally {
       state.isConnecting = false;
     }
   }
   
   function disconnectWallet() {
     localStorage.removeItem(STORAGE_WALLET_FLAG);
   
     stopAttacksTicker();
   
     if (state.attacksPoller) {
       clearInterval(state.attacksPoller);
     }
     state.attacksPoller = null;
   
     clearContracts();
     setWalletUIDisconnected();
   
     const approveMsg = byId("approveMessage");
     if (approveMsg) approveMsg.innerHTML = "";
   
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
     const originalText = btn?.dataset?.originalText || btn?.textContent || "Approve Farming for Resources";
   
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
         msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message || "Approval failed."}</span>`;
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
     byId("connectWallet")?.addEventListener("click", () => connectWallet(true));
     byId("disconnectWallet")?.addEventListener("click", disconnectWallet);
   
     /* ==================== PIRATE ==================== */
     byId("attackBtn")?.addEventListener("click", attack);
     byId("buyPirateBoostBtn")?.addEventListener("click", buyPirateBoost);
     byId("pirateBoostDays")?.addEventListener("input", updateBoostCostLabels);
     byId("pirateBoostDays")?.addEventListener("change", updateBoostCostLabels);
   
     byId("attackRow")?.addEventListener("input", scheduleAttackDropdownRefresh);
     byId("attackCol")?.addEventListener("input", scheduleAttackDropdownRefresh);
     byId("attackResourceSelect")?.addEventListener("change", scheduleAttackDropdownRefresh);
   
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
   
     /* ==================== REVEAL / FARMING ==================== */
     byId("revealBtn")?.addEventListener("click", revealSelected);
   
     byId("farmingStartBtn")?.addEventListener("click", startFarmingSelected);
     byId("farmingStopBtn")?.addEventListener("click", stopFarmingSelected);
     byId("claimBtn")?.addEventListener("click", claimSelected);
     byId("buyBoostBtn")?.addEventListener("click", buyBoost);
     byId("confirmBoostBtn")?.addEventListener("click", buyBoost);
   
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
   
     /* ==================== INITIAL LABEL REFRESH ==================== */
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
     setWalletUIDisconnected();
   
     initAttackResourceSelect();
     updateFarmBoostCostLabel();
     updateBoostCostLabels();
     updateMercenaryCostPreview();
   
     bindEvents();
     bindEthereumEvents();
   
     const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
     if (shouldReconnect) {
       connectWallet(false);
     }
   }