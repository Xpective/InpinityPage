/* =========================================================
   APPROVALS
   ========================================================= */

   import { state } from "./state.js";
   import {
     FARMING_V6_ADDRESS,
     MERCENARY_V2_ADDRESS,
     NFT_ADDRESS,
     PITRONE_ADDRESS
   } from "./config.js";
   import { debugLog } from "./utils.js";
   
   export async function ensureFarmingApproval() {
     if (!state.resourceTokenContract || !state.userAddress) return false;
   
     try {
       const isApproved = await state.resourceTokenContract.isApprovedForAll(
         state.userAddress,
         FARMING_V6_ADDRESS
       );
   
       if (isApproved) {
         debugLog("Farming already approved");
         return true;
       }
   
       debugLog("Requesting farming approval");
       const tx = await state.resourceTokenContract.setApprovalForAll(
         FARMING_V6_ADDRESS,
         true,
         { gasLimit: 100000 }
       );
       await tx.wait();
   
       debugLog("Farming approval confirmed");
       return true;
     } catch (e) {
       console.error("ensureFarmingApproval error:", e);
       return false;
     }
   }
   
   export async function ensureInpiApproval(spender, amount) {
     if (!state.inpiContract || !state.userAddress) return false;
   
     try {
       const allowance = await state.inpiContract.allowance(state.userAddress, spender);
       if (allowance.gte(amount)) return true;
   
       const tx = await state.inpiContract.approve(spender, amount);
       await tx.wait();
   
       debugLog("INPI approval confirmed", {
         spender,
         amount: amount.toString()
       });
       return true;
     } catch (e) {
       console.error("ensureInpiApproval error:", e);
       return false;
     }
   }
   
   export async function ensureInpiApprovalForNFT(amount) {
     return ensureInpiApproval(NFT_ADDRESS, amount);
   }
   
   export async function ensureInpiApprovalForMercenary(amount) {
     return ensureInpiApproval(MERCENARY_V2_ADDRESS, amount);
   }
   
   export async function ensureInpiApprovalForPitrone(amount) {
     return ensureInpiApproval(PITRONE_ADDRESS, amount);
   }
   
   export async function ensurePitroneApproval(spender, amount) {
     if (!state.pitroneContract || !state.userAddress) return false;
   
     try {
       const allowance = await state.pitroneContract.allowance(state.userAddress, spender);
       if (allowance.gte(amount)) return true;
   
       const tx = await state.pitroneContract.approve(spender, amount);
       await tx.wait();
   
       debugLog("Pitrone approval confirmed", {
         spender,
         amount: amount.toString()
       });
       return true;
     } catch (e) {
       console.error("ensurePitroneApproval error:", e);
       return false;
     }
   }