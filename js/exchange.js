/* =========================================================
   EXCHANGE
   ========================================================= */

   import { PITRONE_ADDRESS } from "./config.js";
   import { state } from "./state.js";
   import { byId, debugLog } from "./utils.js";
   import { updateBalances, updatePoolInfo } from "./balances.js";
   import { ensureInpiApprovalForPitrone } from "./approvals.js";
   
   export async function exchangeINPI() {
     const msgDiv = byId("exchangeMessage");
   
     if (!state.userAddress) {
       msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
       return;
     }
   
     const inpiAmount = parseFloat(byId("inpiAmount")?.value);
     if (isNaN(inpiAmount) || inpiAmount <= 0) {
       alert("Invalid amount");
       return;
     }
   
     try {
       debugLog("Exchanging INPI to PIT", { amount: inpiAmount });
   
       const amountWei = ethers.utils.parseEther(inpiAmount.toString());
       const inpiBal = await state.inpiContract.balanceOf(state.userAddress);
       if (inpiBal.lt(amountWei)) throw new Error("Insufficient INPI balance");
   
       const ok = await ensureInpiApprovalForPitrone(amountWei);
       if (!ok) {
         msgDiv.innerHTML = `<span class="error">❌ INPI approval failed.</span>`;
         return;
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
       const tx = await state.pitroneContract.exchangeINPI(amountWei, { gasLimit: 400000 });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
       await updateBalances();
       await updatePoolInfo();
     } catch (e) {
       console.error("Exchange error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function exchangePit() {
     const msgDiv = byId("exchangeMessage");
   
     if (!state.userAddress) {
       msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
       return;
     }
   
     const pitAmount = parseFloat(byId("pitAmount")?.value);
     if (isNaN(pitAmount) || pitAmount <= 0) {
       alert("Invalid amount");
       return;
     }
   
     try {
       debugLog("Exchanging PIT to INPI", { amount: pitAmount, spender: PITRONE_ADDRESS });
   
       const amountWei = ethers.utils.parseEther(pitAmount.toString());
       msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
       const tx = await state.pitroneContract.exchangePitrone(amountWei, { gasLimit: 400000 });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
       await updateBalances();
       await updatePoolInfo();
     } catch (e) {
       console.error("Exchange error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }