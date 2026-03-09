/* =========================================================
   WALLET UI
   ========================================================= */

   import { byId, safeDisabled, safeHTML, safeText, safeValue, shortenAddress } from "./utils.js";
   import { setupLegacyMigrationContracts } from "./migration.js";
   
   export function setWalletUIConnected(addr) {
     safeHTML("walletStatus", " Connected");
     safeHTML("walletAddress", shortenAddress(addr));
     safeText("connectWallet", "Wallet Connected");
     safeDisabled("disconnectWallet", false);
   
     try {
       setupLegacyMigrationContracts();
     } catch (e) {
       console.warn("Migration contracts not available:", e.message);
     }
   }
   
   export function setWalletUIDisconnected() {
     safeHTML("walletStatus", " Not connected");
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
     const blockActionsContainer = byId("blockActions");
     const noBlockSelected = byId("noBlockSelected");
   
     if (blocksGrid) blocksGrid.innerHTML = `<p>Connect wallet to see your blocks.</p>`;
     if (userAttacksList) userAttacksList.innerHTML = `<p>Connect wallet to see your attacks.</p>`;
     if (userResourcesEl) userResourcesEl.innerHTML = `<p>Connect wallet to see your resource tokens.</p>`;
   
     if (selectedBlockInfo) selectedBlockInfo.style.display = "none";
     if (blockActionsContainer) blockActionsContainer.style.display = "none";
     if (noBlockSelected) noBlockSelected.style.display = "block";
   
     safeValue("protectTokenId", "");
     safeText("revealStatus", "Hidden");
     safeText("farmingStatus", "Inactive");
     safeText("claimStatus", "—");
     safeText("boostStatus", "Inactive");
     safeText("protectionExpiry", "—");
   }