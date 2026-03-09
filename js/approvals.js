/* =========================================================
   APPROVALS
   ========================================================= */

   import { state } from "./state.js";
   import { FARMING_V6_ADDRESS, PIRATES_V6_ADDRESS } from "./config.js";
   import { debugLog } from "./utils.js";
   
   export async function ensureFarmingApproval() {
     if (!state.resourceTokenContract || !state.userAddress) return false;
   
     const isApproved = await state.resourceTokenContract.isApprovedForAll(
       state.userAddress,
       FARMING_V6_ADDRESS
     );
   
     if (isApproved) return true;
   
     const tx = await state.resourceTokenContract.setApprovalForAll(
       FARMING_V6_ADDRESS,
       true,
       { gasLimit: 100000 }
     );
   
     await tx.wait();
     debugLog("ResourceToken approved for FarmingV6");
     return true;
   }
   
   export async function ensureInpiApproval(spender, amount) {
     if (!state.inpiContract || !state.userAddress) return false;
   
     const allowance = await state.inpiContract.allowance(state.userAddress, spender);
     if (allowance.gte(amount)) return true;
   
     const tx = await state.inpiContract.approve(spender, amount);
     await tx.wait();
     debugLog("INPI approval updated", { spender, amount: amount.toString() });
     return true;
   }
   
   export async function ensurePitroneApproval(spender = PIRATES_V6_ADDRESS, amount) {
     if (!state.pitroneContract || !state.userAddress) return false;
   
     const allowance = await state.pitroneContract.allowance(state.userAddress, spender);
     if (allowance.gte(amount)) return true;
   
     const tx = await state.pitroneContract.approve(spender, amount);
     await tx.wait();
     debugLog("Pitrone approval updated", { spender, amount: amount.toString() });
     return true;
   }