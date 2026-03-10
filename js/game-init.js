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
     updateFarmBoostCostLabel
   } from "./farming.js";
   
   import { revealSelected } from "./reveal.js";
   import { findRandomFreeBlock, mintBlock } from "./mint.js";
   import { exchangeINPI, exchangePit } from "./exchange.js";
   
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
   
       await updateBalances();
       await updatePoolInfo();
       await loadResourceBalancesOnchain();
       await loadUserBlocks({
         onRevealSelected: revealSelected,
         onRefreshBlockMarkings: refreshBlockMarkings
       });
       await loadUserAttacks();
   
       if (!state.attacksPoller) {
         state.attacksPoller = setInterval(async () => {
           if (!state.userAddress) return;
           await loadUserAttacks();
           refreshBlockMarkings();
         }, 45000);
       }
   
       debugLog("Wallet connected", state.userAddress);
     } catch (e) {
       console.error(e);
       alert("Connection error: " + (e.reason || e.message));
       clearContracts();
       setWalletUIDisconnected();
     } finally {
       state.isConnecting = false;
     }
   }
   
   function disconnectWallet() {
     localStorage.removeItem(STORAGE_WALLET_FLAG);
   
     stopAttacksTicker();
   
     if (state.attacksPoller) clearInterval(state.attacksPoller);
     state.attacksPoller = null;
   
     clearContracts();
     setWalletUIDisconnected();
     debugLog("Wallet disconnected");
   }
   
   function bindEvents() {
     byId("connectWallet")?.addEventListener("click", () => connectWallet(true));
     byId("disconnectWallet")?.addEventListener("click", disconnectWallet);
   
     byId("attackBtn")?.addEventListener("click", attack);
     byId("buyPirateBoostBtn")?.addEventListener("click", buyPirateBoost);
     byId("pirateBoostDays")?.addEventListener("input", updateBoostCostLabels);
   
     byId("protectBtn")?.addEventListener("click", protect);
     byId("revealBtn")?.addEventListener("click", revealSelected);
   
     byId("farmingStartBtn")?.addEventListener("click", startFarmingSelected);
     byId("farmingStopBtn")?.addEventListener("click", stopFarmingSelected);
     byId("claimBtn")?.addEventListener("click", claimSelected);
     byId("buyBoostBtn")?.addEventListener("click", buyBoost);
     byId("confirmBoostBtn")?.addEventListener("click", buyBoost);
   
     byId("migrateFarmBtn")?.addEventListener("click", migrateSelectedFarmToV6);
     byId("migrateAllV5Btn")?.addEventListener("click", migrateAllMyV5Farms);
   
     byId("exchangeInpiBtn")?.addEventListener("click", exchangeINPI);
     byId("exchangePitBtn")?.addEventListener("click", exchangePit);
   
     byId("randomBlockBtn")?.addEventListener("click", findRandomFreeBlock);
     byId("mintBtn")?.addEventListener("click", mintBlock);
   
     byId("attackRow")?.addEventListener("input", scheduleAttackDropdownRefresh);
     byId("attackCol")?.addEventListener("input", scheduleAttackDropdownRefresh);
   
     byId("boostDays")?.addEventListener("input", updateFarmBoostCostLabel);
     byId("pirateBoostDays")?.addEventListener("input", updateBoostCostLabels);
   
     document.querySelectorAll('input[name="payment"]').forEach((radio) => {
       radio.addEventListener("change", (e) => {
         state.selectedPayment = e.target.value;
       });
     });
   }
   
   function bindEthereumEvents() {
     if (!window.ethereum || window.ethereum.__inpinityBound) return;
   
     window.ethereum.on("accountsChanged", async (accounts) => {
       if (!accounts || !accounts.length) {
         disconnectWallet();
         return;
       }
   
       if (state.userAddress && accounts[0].toLowerCase() !== state.userAddress.toLowerCase()) {
         disconnectWallet();
         await connectWallet(false);
       }
     });
   
     window.ethereum.on("chainChanged", () => window.location.reload());
     window.ethereum.__inpinityBound = true;
   }
   
   export function initGamePage() {
     setWalletUIDisconnected();
     initAttackResourceSelect();
     updateFarmBoostCostLabel();
     updateBoostCostLabels();
     bindEvents();
     bindEthereumEvents();
   
     const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
     if (shouldReconnect) connectWallet(false);
   }