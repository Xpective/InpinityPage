/* =========================================================
   RESOURCES
   ========================================================= */

   import { state } from "./state.js";
   import { byId, bnGtZero } from "./utils.js";
   import { getResourceName, getResourceIconPath } from "./config.js";
   
   export async function loadResourceBalancesOnchain() {
     const container = byId("userResources");
   
     if (!state.userAddress || !state.resourceTokenContract) {
       state.userResources = [];
       if (container) updateUserResourcesDisplay();
       return;
     }
   
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
   
   function buildResourceIcon(resourceId, name) {
     const iconPath = getResourceIconPath(resourceId);
   
     return `
       <img
         class="resource-icon"
         src="${iconPath}"
         alt="${name}"
         title="${name}"
         width="32"
         height="32"
         loading="lazy"
         onerror="this.style.display='none'; if(this.nextElementSibling){ this.nextElementSibling.classList.remove('resource-icon-fallback-hidden'); }"
       />
       <span class="resource-icon-fallback resource-icon-fallback-hidden" aria-hidden="true">📦</span>
     `;
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
   
     const sortedResources = [...state.userResources].sort(
       (a, b) => Number(a.resourceId) - Number(b.resourceId)
     );
   
     let html = "";
   
     for (const r of sortedResources) {
       const resourceId = Number(r.resourceId);
       const name = getResourceName(resourceId);
       const amount = r.amount?.toString?.() || "0";
   
       html += `
         <div class="resource-item resource-item-with-icon" data-resource-id="${resourceId}">
           <div class="resource-left">
             <div class="resource-icon-wrap">
               ${buildResourceIcon(resourceId, name)}
             </div>
             <div class="resource-meta">
               <span class="resource-name" title="${name}">${name}</span>
               <span class="resource-id-label">ID ${resourceId}</span>
             </div>
           </div>
           <div class="resource-right">
             <span class="resource-amount">${amount}</span>
           </div>
         </div>
       `;
     }
   
     container.innerHTML = html;
   }