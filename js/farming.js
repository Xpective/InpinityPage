/* =========================================================
   FARMING / MIGRATION / PROTECTION
   ========================================================= */

   import { state } from "./state.js";
   import { MERCENARY_V2_ADDRESS } from "./config.js";
   import { byId, formatDuration, debugLog } from "./utils.js";
   import { ensureFarmingApproval, ensureInpiApprovalForMercenary } from "./approvals.js";
   import { loadResourceBalancesOnchain } from "./resources.js";
   import { loadUserBlocks, selectBlock } from "./blocks.js";
   import { loadUserAttacks, refreshBlockMarkings } from "./attacks.js";
   import {
     isTokenActiveOnV5,
     migrateSingleFarmV5ToV6,
     migrateManyFarmsV5ToV6,
     getFarmingV5Contract,
     getV5PendingTotal
   } from "./migration.js";

   import {
    FARM_BOOST_PRICE_PER_DAY,
    FARM_BOOST_MAX_DAYS,
    FARM_WINDOW_DAYS
  } from "./config.js";
   
   let isMigrationRunning = false;
   let isBatchMigrationRunning = false;
   
   function getActionMessageDiv() {
     return byId("actionMessage");
   }
   
   async function refreshSelectedBlockView() {
     if (!state.selectedBlock) return;
     await loadUserBlocks({ onRevealSelected: null, onRefreshBlockMarkings: refreshBlockMarkings });
     await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
   }
   
   function setButtonBusy(buttonId, busy, busyText = "Processing...") {
     const btn = byId(buttonId);
     if (!btn) return null;
   
     if (busy) {
       if (!btn.dataset.originalText) {
         btn.dataset.originalText = btn.textContent;
       }
       btn.disabled = true;
       btn.textContent = busyText;
     } else {
       btn.disabled = false;
       if (btn.dataset.originalText) {
         btn.textContent = btn.dataset.originalText;
       }
     }
   
     return btn;
   }
   
   function friendlyErrorMessage(e) {
     const msg = e?.reason || e?.message || "Unknown error";
     const lower = String(msg).toLowerCase();
   
     if (
       e?.code === 4001 ||
       lower.includes("user rejected") ||
       lower.includes("denied transaction signature") ||
       lower.includes("action_rejected")
     ) {
       return "Transaction cancelled in wallet.";
     }
   
     if (e?.code === "TRANSACTION_REPLACED") {
       if (e?.cancelled) {
         return "Transaction was cancelled/replaced in wallet after sending.";
       }
       return "Transaction was replaced in wallet.";
     }
   
     if (lower.includes("nonce too high")) {
       return "Nonce too high. Please check pending transactions in MetaMask and try again.";
     }
   
     if (lower.includes("nonce has already been used")) {
       return "Nonce already used. Please wait for pending transactions or reset activity in MetaMask.";
     }
   
     if (lower.includes("replacement transaction underpriced")) {
       return "Replacement transaction underpriced. Please wait a moment and try again.";
     }
   
     if (lower.includes("already known")) {
       return "This transaction is already known by the network. Please wait.";
     }
   
     if (lower.includes("call revert exception")) {
       return "Contract call failed. Please check whether the selected block is really active on this farm version.";
     }
   
     return msg;
   }
   
   export async function startFarmingSelected() {
     if (!state.selectedBlock) return;
     const msgDiv = getActionMessageDiv();
   
     try {
       if (state.selectedBlock.activeOnV5) {
         msgDiv.innerHTML = `<span class="error">❌ Block is still active on V5. Use Migrate button first.</span>`;
         return;
       }
   
       const owner = await state.nftContract.ownerOf(state.selectedBlock.tokenId);
       if (owner.toLowerCase() !== state.userAddress.toLowerCase()) {
         msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
         return;
       }
   
       const approved = await ensureFarmingApproval();
       if (!approved) {
         msgDiv.innerHTML = `<span class="error">❌ Failed to approve farming.</span>`;
         return;
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Starting V6 farming...</span>`;
       const tx = await state.farmingV6Contract.startFarming(state.selectedBlock.tokenId, { gasLimit: 500000 });
       debugLog("startFarming tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ V6 farming started.</span>`;
       await refreshSelectedBlockView();
     } catch (e) {
       console.error("Farming error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function stopFarmingSelected() {
     if (!state.selectedBlock) return;
     const msgDiv = getActionMessageDiv();
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Stopping V6 farming...</span>`;
       const tx = await state.farmingV6Contract.stopFarming(state.selectedBlock.tokenId, { gasLimit: 500000 });
       debugLog("stopFarming tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">⏹️ Farming stopped.</span>`;
       await refreshSelectedBlockView();
     } catch (e) {
       console.error("Stop farming error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function claimSelected() {
    if (!state.selectedBlock) return;
  
    const msgDiv = getActionMessageDiv();
    const tokenId = state.selectedBlock.tokenId;
  
    try {
      // =========================
      // V5 CLAIM
      // =========================
      if (state.selectedBlock.activeOnV5 && !state.selectedBlock.farmingActive) {
        const v5 = getFarmingV5Contract();
        let preview = null;
  
        try {
          preview = await v5.previewClaim(tokenId);
        } catch (e) {
          console.error("V5 previewClaim error:", e);
          msgDiv.innerHTML = `<span class="error">❌ V5 preview failed: ${friendlyErrorMessage(e)}</span>`;
          return;
        }
  
        if (!preview || !preview.allowed) {
          const code = preview?.code ?? "?";
          const secondsRemaining = Number(preview?.secondsRemaining || 0);
          msgDiv.innerHTML = `<span class="error">❌ V5 claim not ready. Code ${code}. Wait ${formatDuration(secondsRemaining)}.</span>`;
          return;
        }
  
        let total = null;
        try {
          total = await getV5PendingTotal(tokenId);
        } catch (e) {
          console.error("V5 pending total error:", e);
          msgDiv.innerHTML = `<span class="error">❌ Could not read V5 pending rewards: ${friendlyErrorMessage(e)}</span>`;
          return;
        }
  
        if (!total || total.isZero()) {
          msgDiv.innerHTML = `<span class="error">❌ Nothing to claim on V5.</span>`;
          return;
        }
  
        msgDiv.innerHTML = `<span class="success">⏳ Claiming V5 resources... ${total.toString()} total</span>`;
        const tx = await v5.claimResources(tokenId, { gasLimit: 700000 });
        debugLog("V5 claim tx", tx.hash);
        await tx.wait();
  
        msgDiv.innerHTML = `<span class="success">💰 V5 resources claimed!</span>`;
        await loadResourceBalancesOnchain();
        await refreshSelectedBlockView();
        return;
      }
  
      // =========================
      // V6 CLAIM
      // =========================
      if (state.selectedBlock.farmingActive) {
        let preview = null;
        let pending = null;
        let total = ethers.BigNumber.from(0);
  
        // 1) Erst Pending lesen, damit wir überhaupt wissen, ob was da ist
        try {
          pending = await state.farmingV6Contract.getAllPending(tokenId);
        } catch (e) {
          console.error("V6 getAllPending error:", e);
          msgDiv.innerHTML = `<span class="error">❌ Could not read V6 pending rewards: ${friendlyErrorMessage(e)}</span>`;
          return;
        }
  
        for (let i = 0; i < pending.length; i++) {
          total = total.add(pending[i]);
        }
  
        if (total.isZero()) {
          msgDiv.innerHTML = `<span class="error">❌ Nothing to claim on V6.</span>`;
          return;
        }
  
        // 2) Preview versuchen, aber nicht hart abbrechen wenn es revertet
        try {
          preview = await state.farmingV6Contract.previewClaim(tokenId);
        } catch (e) {
          console.warn("V6 previewClaim failed, fallback to secondsUntilClaimable()", e);
        }
  
        // 3) Wenn Preview funktioniert hat, normale Logik
        if (preview) {
          if (!preview.allowed) {
            const code = preview?.code ?? "?";
            const secondsRemaining = Number(preview?.secondsRemaining || 0);
            msgDiv.innerHTML = `<span class="error">❌ V6 claim not ready. Code ${code}. Wait ${formatDuration(secondsRemaining)}.</span>`;
            return;
          }
        } else {
          // 4) Fallback: direkt cooldown lesen
          try {
            const waitSec = await state.farmingV6Contract.secondsUntilClaimable(tokenId);
            const waitNum = Number(waitSec || 0);
  
            if (waitNum > 0) {
              msgDiv.innerHTML = `<span class="error">❌ V6 claim not ready. Wait ${formatDuration(waitNum)}.</span>`;
              return;
            }
          } catch (e) {
            console.error("V6 secondsUntilClaimable fallback error:", e);
            msgDiv.innerHTML = `<span class="error">❌ V6 preview failed and fallback check also failed: ${friendlyErrorMessage(e)}</span>`;
            return;
          }
        }
  
        msgDiv.innerHTML = `<span class="success">⏳ Claiming V6 resources... ${total.toString()} total</span>`;
        const tx = await state.farmingV6Contract.claimResources(tokenId, { gasLimit: 700000 });
        debugLog("V6 claim tx", tx.hash);
        await tx.wait();
  
        msgDiv.innerHTML = `<span class="success">💰 V6 resources claimed!</span>`;
        await loadResourceBalancesOnchain();
        await refreshSelectedBlockView();
        return;
      }
  
      msgDiv.innerHTML = `<span class="error">❌ No active farm to claim from.</span>`;
    } catch (e) {
      console.error("Claim error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
    }
  }
  export function updateFarmBoostCostLabel() {
    const daysEl = byId("boostDays");
    const costInfo = byId("boostCostInfo");
  
    if (!costInfo || !daysEl) return;
  
    let days = parseInt(daysEl.value, 10);
    if (!Number.isFinite(days)) days = 7;
  
    days = Math.max(1, Math.min(FARM_BOOST_MAX_DAYS, days));
    daysEl.value = String(days);
  
    costInfo.textContent = `Total: ${days * FARM_BOOST_PRICE_PER_DAY} INPI`;
  }
  
  export async function buyBoost() {
    if (!state.selectedBlock) {
      alert("No block selected.");
      return;
    }
  
    const msgDiv = getActionMessageDiv();
    const tokenId = state.selectedBlock.tokenId;
  
    let days = parseInt(byId("boostDays")?.value, 10);
    if (!Number.isFinite(days)) days = 7;
    days = Math.max(1, Math.min(FARM_BOOST_MAX_DAYS, days));
  
    const totalCostHuman = days * FARM_BOOST_PRICE_PER_DAY;
    const totalCostWei = ethers.utils.parseEther(String(totalCostHuman));
  
    try {
      const owner = await state.nftContract.ownerOf(tokenId);
      if (owner.toLowerCase() !== state.userAddress.toLowerCase()) {
        msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
        return;
      }
  
      const allowance = await state.inpiContract.allowance(
        state.userAddress,
        state.farmingV6Contract.address
      );
  
      if (allowance.lt(totalCostWei)) {
        msgDiv.innerHTML = `
          <span class="success">
            ⏳ Approving INPI...<br>
            Cost: ${totalCostHuman} INPI
          </span>
        `;
  
        const approveTx = await state.inpiContract.approve(
          state.farmingV6Contract.address,
          totalCostWei
        );
        debugLog("farm boost approve tx", approveTx.hash);
        await approveTx.wait();
      }
  
      msgDiv.innerHTML = `
        <span class="success">
          ⏳ Buying farm boost...<br>
          Block: #${tokenId}<br>
          Days: ${days}<br>
          Cost: ${totalCostHuman} INPI<br>
          Effect: +25% production<br>
          Farm window: ${FARM_WINDOW_DAYS} days
        </span>
      `;
  
      const tx = await state.farmingV6Contract.buyBoost(tokenId, days, {
        gasLimit: 300000
      });
  
      debugLog("buyBoost tx", tx.hash);
      await tx.wait();
  
      msgDiv.innerHTML = `
        <span class="success">
          ✅ Farm boost activated.<br>
          Block: #${tokenId}<br>
          Days: ${days}<br>
          Paid: ${totalCostHuman} INPI
        </span>
      `;
  
      await loadResourceBalancesOnchain();
      await refreshSelectedBlockView();
    } catch (e) {
      console.error("Boost error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
    }
  }


   
   export async function migrateSelectedFarmToV6() {
     if (!state.selectedBlock) return;
     if (isMigrationRunning) return;
   
     const msgDiv = getActionMessageDiv();
     isMigrationRunning = true;
     setButtonBusy("migrateFarmBtn", true, "⏳ Migrating...");
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Migrating V5 → V6...</span>`;
   
       const result = await migrateSingleFarmV5ToV6(state.selectedBlock.tokenId, {
         claimIfPossible: true,
         stopOnV5: true,
         startOnV6: true
       });
   
       let extra = "";
       if (result.needsRevealOnV6) {
         extra = `<br>Reveal needed on V6 before farming can start.`;
       }
   
       msgDiv.innerHTML = `
         <span class="success">
           ✅ Migration complete.<br>
           Claimed on V5: ${result.claimedOnV5 ? "yes" : "no"}<br>
           Stopped on V5: ${result.stoppedOnV5 ? "yes" : "no"}<br>
           Started on V6: ${result.startedOnV6 ? "yes" : "no"}${extra}
         </span>
       `;
   
       await loadResourceBalancesOnchain();
       await loadUserAttacks();
       await refreshSelectedBlockView();
     } catch (e) {
       console.error("Migration error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     } finally {
       isMigrationRunning = false;
       setButtonBusy("migrateFarmBtn", false);
     }
   }
   
   export async function migrateAllMyV5Farms() {
     if (isBatchMigrationRunning) return;
   
     const msgDiv = getActionMessageDiv();
     isBatchMigrationRunning = true;
     setButtonBusy("migrateAllV5Btn", true, "⏳ Migrating...");
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Scanning V5 farms...</span>`;
   
       const checks = await Promise.all(
         state.userBlocks.map(async (tokenId) => ({
           tokenId,
           active: await isTokenActiveOnV5(tokenId).catch(() => false)
         }))
       );
   
       const toMigrate = checks.filter((x) => x.active).map((x) => x.tokenId);
   
       if (!toMigrate.length) {
         msgDiv.innerHTML = `<span class="success">✅ No active V5 farms found.</span>`;
         return;
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Migrating ${toMigrate.length} V5 farms...</span>`;
   
       const results = await migrateManyFarmsV5ToV6(toMigrate, {
         claimIfPossible: true,
         stopOnV5: true,
         startOnV6: true
       });
   
       const successCount = results.filter((r) => r.ok && (r.startedOnV6 || r.needsRevealOnV6)).length;
       const failCount = results.length - successCount;
       const revealCount = results.filter((r) => r.ok && r.needsRevealOnV6).length;
   
       msgDiv.innerHTML = `
         <span class="success">
           ✅ Migration finished.<br>
           Success: ${successCount}<br>
           Failed: ${failCount}<br>
           Need reveal before V6 start: ${revealCount}
         </span>
       `;
   
       await loadResourceBalancesOnchain();
       await loadUserBlocks({ onRevealSelected: null, onRefreshBlockMarkings: refreshBlockMarkings });
       await loadUserAttacks();
     } catch (e) {
       console.error("Migration error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     } finally {
       isBatchMigrationRunning = false;
       setButtonBusy("migrateAllV5Btn", false);
     }
   }
   
   export async function protect() {
     const tokenId = parseInt(byId("protectTokenId")?.value, 10);
     const level = parseInt(byId("protectLevel")?.value, 10);
     const msgDiv = byId("protectMessage");
   
     if (isNaN(tokenId) || isNaN(level)) {
       alert("Invalid input");
       return;
     }
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Hiring mercenaries...</span>`;
   
       const owner = await state.nftContract.ownerOf(tokenId);
       if (owner.toLowerCase() !== state.userAddress.toLowerCase()) {
         msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
         return;
       }
   
       const cost = level * 10;
       const amount = ethers.utils.parseEther(cost.toString());
   
       const ok = await ensureInpiApprovalForMercenary(amount);
       if (!ok) {
         msgDiv.innerHTML = `<span class="error">❌ INPI approval failed.</span>`;
         return;
       }
   
       const tx = await state.mercenaryV2Contract.hireMercenaries(tokenId, level, { gasLimit: 400000 });
       debugLog("hireMercenaries tx", {
         tokenId,
         level,
         spender: MERCENARY_V2_ADDRESS,
         hash: tx.hash
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection active for 3.14 days.</span>`;
   
       await loadUserBlocks({ onRevealSelected: null, onRefreshBlockMarkings: refreshBlockMarkings });
       if (state.selectedBlock && String(state.selectedBlock.tokenId) === String(tokenId)) {
         await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
       }
     } catch (e) {
       console.error("Protection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }