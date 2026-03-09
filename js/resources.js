/* =========================================================
   RESOURCES
   ========================================================= */

   import { state } from "./state.js";
   import { byId, bnGtZero } from "./utils.js";
   import { resourceNames } from "./config.js";
   
   export async function loadResourceBalancesOnchain() {
     if (!state.userAddress || !state.resourceTokenContract) return;
   
     try {
       const ids = [...Array(10).keys()];
       const accounts = ids.map(() => state.userAddress);
       const balances = await state.resourceTokenContract.balanceOfBatch(accounts, ids);
   
       state.userResources = ids
         .map((id, idx) => ({
           resourceId: id,
           amount: balances[idx]
         }))
         .filter((r) => bnGtZero(r.amount));
   
       updateUserResourcesDisplay();
     } catch (e) {
       console.error("loadResourceBalancesOnchain error:", e);
       state.userResources = [];
       updateUserResourcesDisplay();
     }
   }
   
   export function updateUserResourcesDisplay() {
     const container = byId("userResources");
     if (!container) return;
   
     if (!state.userAddress) {
       container.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
       return;
     }
   
     if (!state.userResources.length) {
       container.innerHTML = `<p class="empty-state">You have no resource tokens yet. Start farming!</p>`;
       return;
     }
   
     let html = "";
   
     for (const r of state.userResources) {
       const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
       html += `
         <div class="resource-item">
           <span class="resource-name">${name}</span>
           <span class="resource-amount">${r.amount.toString()}</span>
         </div>
       `;
     }
   
     container.innerHTML = html;
   }