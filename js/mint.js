/* =========================================================
   MINT
   ========================================================= */

   import {
    PRICE_ETH,
    PRICE_INPI,
    PRICE_ETH_MIXED,
    PRICE_INPI_MIXED,
    MAX_ROW
  } from "./config.js";
  import { state } from "./state.js";
  import { byId, debugLog } from "./utils.js";
  import { ensureInpiApprovalForNFT } from "./approvals.js";
  import { updateBalances } from "./balances.js";
  import { loadResourceBalancesOnchain } from "./resources.js";
  import { loadUserBlocks } from "./blocks.js";
  import { loadUserAttacks, refreshBlockMarkings } from "./attacks.js";
  import { revealSelected } from "./reveal.js";
  
  function setMintButtonBusy(busy, text = "Mint Block") {
    const btn = byId("mintBtn");
    if (!btn) return;
  
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent;
    }
  
    if (busy) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      btn.textContent = text;
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.textContent = btn.dataset.originalText || "Mint Block";
    }
  }
  
  function setRandomButtonBusy(busy, text = "🎲 Random free") {
    const btn = byId("randomBlockBtn");
    if (!btn) return;
  
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent;
    }
  
    if (busy) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      btn.textContent = text;
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.textContent = btn.dataset.originalText || "🎲 Random free";
    }
  }
  
  function mintErrorMessage(e) {
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
  
    if (lower.includes("insufficient funds")) {
      return "Insufficient wallet funds for this mint.";
    }
  
    if (lower.includes("already minted") || lower.includes("owner query for nonexistent token") === false && lower.includes("already")) {
      return msg;
    }
  
    return msg;
  }
  
  export async function findRandomFreeBlock() {
    const msgDiv = byId("mintMessage");
  
    if (!state.userAddress || !state.nftContract) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
      return;
    }
  
    try {
      setRandomButtonBusy(true, "Searching...");
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Searching a free block...</div>`;
  
      const MAX_ATTEMPTS = 80;
  
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const row = Math.floor(Math.random() * (MAX_ROW + 1));
        const col = Math.floor(Math.random() * (2 * row + 1));
        const tokenId = row * 2048 + col;
  
        try {
          await state.nftContract.ownerOf(tokenId);
        } catch {
          if (byId("row")) byId("row").value = row;
          if (byId("col")) byId("col").value = col;
          if (msgDiv) {
            msgDiv.innerHTML = `<div class="message-box success">✅ Free block found: Row ${row}, Col ${col}. You can mint now.</div>`;
          }
          return;
        }
      }
  
      if (msgDiv) {
        msgDiv.innerHTML = `<div class="message-box error">❌ Could not find a free block fast. Try again or pick manually.</div>`;
      }
    } finally {
      setRandomButtonBusy(false);
    }
  }
  
  export async function mintBlock() {
    const msgDiv = byId("mintMessage");
  
    if (!state.userAddress || !state.nftContract) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
      return;
    }
  
    const row = parseInt(byId("row")?.value, 10);
    const col = parseInt(byId("col")?.value, 10);
  
    if (
      Number.isNaN(row) ||
      Number.isNaN(col) ||
      row < 0 ||
      row > MAX_ROW ||
      col < 0 ||
      col > 2 * row
    ) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Invalid coordinates.</div>`;
      return;
    }
  
    const tokenId = row * 2048 + col;
  
    try {
      setMintButtonBusy(true, "Minting...");
  
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Checking block availability...</div>`;
  
      try {
        await state.nftContract.ownerOf(tokenId);
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ This block is already minted.</div>`;
        return;
      } catch {}
  
      let tx;
  
      if (state.selectedPayment === "eth") {
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with ETH...</div>`;
        tx = await state.nftContract.mintWithETH(row, col, {
          value: ethers.utils.parseEther(PRICE_ETH)
        });
      } else if (state.selectedPayment === "inpi") {
        const amount = ethers.utils.parseEther(PRICE_INPI);
        const bal = await state.inpiContract.balanceOf(state.userAddress);
  
        if (bal.lt(amount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance.</div>`;
          return;
        }
  
        const ok = await ensureInpiApprovalForNFT(amount);
        if (!ok) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ INPI approval failed.</div>`;
          return;
        }
  
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with INPI...</div>`;
        tx = await state.nftContract.mintWithINPI(row, col);
      } else if (state.selectedPayment === "mixed") {
        const ethAmount = ethers.utils.parseEther(PRICE_ETH_MIXED);
        const inpiAmount = ethers.utils.parseEther(PRICE_INPI_MIXED);
        const bal = await state.inpiContract.balanceOf(state.userAddress);
  
        if (bal.lt(inpiAmount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance for mixed payment.</div>`;
          return;
        }
  
        const ok = await ensureInpiApprovalForNFT(inpiAmount);
        if (!ok) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ INPI approval failed.</div>`;
          return;
        }
  
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting (Mixed)...</div>`;
        tx = await state.nftContract.mintMixed(row, col, { value: ethAmount });
      } else {
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Unknown payment method.</div>`;
        return;
      }
  
      if (msgDiv) {
        msgDiv.innerHTML = `<div class="message-box success">⏳ Transaction sent: ${tx.hash.slice(0, 10)}...</div>`;
      }
  
      await tx.wait();
  
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">✅ Block minted! 🎉</div>`;
  
      await updateBalances();
      await loadResourceBalancesOnchain();
      await loadUserBlocks({
        onRevealSelected: revealSelected,
        onRefreshBlockMarkings: refreshBlockMarkings
      });
  
      setTimeout(() => {
        loadUserAttacks();
      }, 1200);
    } catch (e) {
      console.error("Mint error:", e);
      if (msgDiv) {
        msgDiv.innerHTML = `<div class="message-box error">❌ ${mintErrorMessage(e)}</div>`;
      }
    } finally {
      setMintButtonBusy(false);
    }
  }