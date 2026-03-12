/* =========================================================
   EXCHANGE
   ========================================================= */

   import { PITRONE_ADDRESS } from "./config.js";
   import { state } from "./state.js";
   import { byId, debugLog } from "./utils.js";
   import { updateBalances, updatePoolInfo } from "./balances.js";
   import {
     ensureInpiApprovalForPitrone,
     ensurePitroneApproval
   } from "./approvals.js";
   
   function setExchangeButtonBusy(buttonId, busy, busyText = "Processing...") {
     const btn = byId(buttonId);
     if (!btn) return;
   
     if (!btn.dataset.originalText) {
       btn.dataset.originalText = btn.textContent;
     }
   
     if (busy) {
       btn.disabled = true;
       btn.style.opacity = "0.6";
       btn.style.pointerEvents = "none";
       btn.textContent = busyText;
     } else {
       btn.disabled = false;
       btn.style.opacity = "1";
       btn.style.pointerEvents = "auto";
       btn.textContent = btn.dataset.originalText;
     }
   }
   
   function exchangeErrorMessage(e) {
     const msg = e?.reason || e?.data?.message || e?.message || "Unknown error";
     const lower = String(msg).toLowerCase();
   
     if (
       e?.code === 4001 ||
       lower.includes("user rejected") ||
       lower.includes("denied transaction signature") ||
       lower.includes("action_rejected")
     ) {
       return "Transaction cancelled in wallet.";
     }
   
     if (lower.includes("insufficient")) {
       return msg;
     }
   
     return msg;
   }
   
   export async function exchangeINPI() {
     const msgDiv = byId("exchangeMessage");
   
     if (!state.userAddress) {
       msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
       return;
     }
   
     const inpiAmount = parseFloat(byId("inpiAmount")?.value);
     if (isNaN(inpiAmount) || inpiAmount <= 0) {
       msgDiv.innerHTML = `<span class="error">❌ Invalid INPI amount.</span>`;
       return;
     }
   
     try {
       setExchangeButtonBusy("exchangeInpiBtn", true, "Swapping...");
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
       msgDiv.innerHTML = `<span class="error">❌ ${exchangeErrorMessage(e)}</span>`;
     } finally {
       setExchangeButtonBusy("exchangeInpiBtn", false);
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
       msgDiv.innerHTML = `<span class="error">❌ Invalid PIT amount.</span>`;
       return;
     }
   
     try {
       setExchangeButtonBusy("exchangePitBtn", true, "Swapping...");
       debugLog("Exchanging PIT to INPI", { amount: pitAmount, spender: PITRONE_ADDRESS });
   
       const amountWei = ethers.utils.parseEther(pitAmount.toString());
       const pitBal = await state.pitroneContract.balanceOf(state.userAddress);
       if (pitBal.lt(amountWei)) throw new Error("Insufficient PIT balance");
   
       const ok = await ensurePitroneApproval(PITRONE_ADDRESS, amountWei);
       if (!ok) {
         msgDiv.innerHTML = `<span class="error">❌ PIT approval failed.</span>`;
         return;
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
       const tx = await state.pitroneContract.exchangePitrone(amountWei, { gasLimit: 400000 });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
       await updateBalances();
       await updatePoolInfo();
     } catch (e) {
       console.error("Exchange error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${exchangeErrorMessage(e)}</span>`;
     } finally {
       setExchangeButtonBusy("exchangePitBtn", false);
     }
   }