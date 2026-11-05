/* =========================================================
   REVEAL
   ========================================================= */

   import { WORKER_URL } from "./config.js";
   import { state } from "./state.js";
   import { byId, debugLog } from "./utils.js";
   import { loadUserBlocks, selectBlock } from "./blocks.js";
   import { refreshBlockMarkings } from "./attacks.js";
   
   function setRevealButtonBusy(busy) {
     const btn = byId("revealBtn");
     if (!btn) return;
   
     if (!btn.dataset.originalText) {
       btn.dataset.originalText = btn.textContent;
     }
   
     if (busy) {
       btn.disabled = true;
       btn.style.opacity = "0.6";
       btn.style.pointerEvents = "none";
       btn.textContent = "Revealing...";
     } else {
       btn.disabled = false;
       btn.style.opacity = "1";
       btn.style.pointerEvents = "auto";
       btn.textContent = btn.dataset.originalText || "Reveal";
     }
   }
   
   function friendlyRevealError(e) {
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
   
     if (lower.includes("proof")) {
       return "Reveal proof could not be loaded or was invalid.";
     }
   
     if (lower.includes("already revealed")) {
       return "This block is already revealed.";
     }
   
     return msg;
   }
   
   export async function revealSelected() {
     if (!state.selectedBlock) {
       const msgDiv = byId("actionMessage");
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="error">❌ No block selected.</span>`;
       }
       return;
     }
   
     const { tokenId, row, col, revealed } = state.selectedBlock;
     const msgDiv = byId("actionMessage");
   
     if (revealed) {
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="error">❌ This block is already revealed.</span>`;
       }
       return;
     }
   
     try {
       setRevealButtonBusy(true);
   
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="success">⏳ Loading reveal proofs...</span>`;
       }
   
       debugLog("Revealing block", { tokenId, row, col });
   
       const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
       if (!response.ok) {
         throw new Error("Proofs not found");
       }
   
       const proofs = await response.json();
   
       const formatProof = (arr) =>
         (arr || []).map((item) => {
           const v = item?.left ? item.left : item?.right;
           if (!v) return "0x";
           return String(v).startsWith("0x") ? String(v) : "0x" + String(v);
         });
   
       const piProof = formatProof(proofs?.pi?.proof);
       const phiProof = formatProof(proofs?.phi?.proof);
   
       const tx = await state.nftContract.revealBlock(
         tokenId,
         piProof,
         phiProof,
         proofs?.pi?.digit,
         proofs?.phi?.digit,
         { gasLimit: 800000 }
       );
   
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="success">⏳ Revealing block...</span>`;
       }
   
       await tx.wait();
   
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="success">✅ Block revealed! 🎉</span>`;
       }
   
       await loadUserBlocks({
         onRevealSelected: revealSelected,
         onRefreshBlockMarkings: refreshBlockMarkings
       });
   
       await selectBlock(tokenId, row, col);
     } catch (e) {
       console.error("Reveal error:", e);
       if (msgDiv) {
         msgDiv.innerHTML = `<span class="error">❌ ${friendlyRevealError(e)}</span>`;
       }
     } finally {
       setRevealButtonBusy(false);
     }
   }