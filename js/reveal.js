/* =========================================================
   REVEAL
   ========================================================= */

   import { WORKER_URL } from "./config.js";
   import { state } from "./state.js";
   import { byId, debugLog } from "./utils.js";
   import { loadUserBlocks, selectBlock } from "./blocks.js";
   import { refreshBlockMarkings } from "./attacks.js";
   
   export async function revealSelected() {
     if (!state.selectedBlock) {
       alert("No block selected.");
       return;
     }
   
     const { tokenId, row, col } = state.selectedBlock;
     const msgDiv = byId("actionMessage");
     if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Loading proofs...</span>`;
   
     try {
       debugLog("Revealing block", { tokenId, row, col });
   
       const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
       if (!response.ok) throw new Error("Proofs not found");
   
       const proofs = await response.json();
   
       const formatProof = (arr) =>
         arr.map((item) => {
           const v = item.left ? item.left : item.right;
           return v.startsWith("0x") ? v : "0x" + v;
         });
   
       const piProof = formatProof(proofs.pi.proof);
       const phiProof = formatProof(proofs.phi.proof);
   
       const tx = await state.nftContract.revealBlock(
         tokenId,
         piProof,
         phiProof,
         proofs.pi.digit,
         proofs.phi.digit,
         { gasLimit: 800000 }
       );
   
       if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Revealing...</span>`;
       await tx.wait();
   
       if (msgDiv) msgDiv.innerHTML = `<span class="success">✅ Block revealed! 🎉</span>`;
       await loadUserBlocks({ onRevealSelected: revealSelected, onRefreshBlockMarkings: refreshBlockMarkings });
       await selectBlock(tokenId, row, col);
     } catch (e) {
       console.error("Reveal error:", e);
       if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
     }
   }