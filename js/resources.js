/* =========================================================
   RESOURCES
   ========================================================= */

   import { state } from "./state.js";
   import { byId, bnGtZero } from "./utils.js";
   import { resourceNames } from "./config.js";
   
   export async function loadResourceBalancesOnchain() {
     if (!state.userAddress || !state.resourceTokenContract) return;
   
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
   }
   
   export function updateUserResourcesDisplay() {
     const container = byId("userResources");
     if (!container) return;
   
     if (!state.userAddress) {
       container.innerHTML = `<p>Connect wallet to see your resource tokens.</p>`;
       return;
     }
   
     if (!state.userResources.length) {
       container.innerHTML = `<p>You have no resource tokens yet. Start farming!</p>`;
       return;
     }
   
     let html = "";
     for (const r of state.userResources) {
       const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
       html += `<div class="resource-row"><strong>${name}</strong>: ${r.amount.toString()}</div>`;
     }
   
     container.innerHTML = html;
   }