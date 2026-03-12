/* =========================================================
   FARMING / MIGRATION / MERCENARY V4
   ========================================================= */

   import { state } from "./state.js";
   import {
     MERCENARY_SLOT2_UNLOCK_COST,
     MERCENARY_SLOT3_UNLOCK_COST,
     MERCENARY_DURATION_LABELS,
     MERCENARY_TIER_LABELS,
     MERCENARY_RANK_LABELS,
     FARM_BOOST_PRICE_PER_DAY,
     FARM_BOOST_MAX_DAYS,
     FARM_WINDOW_DAYS,
     getMercenaryV4Cost
   } from "./config.js";
   import { byId, formatDuration, debugLog, safeValue } from "./utils.js";
   import { ensureFarmingApproval, ensureInpiApprovalForMercenary } from "./approvals.js";
   import { loadResourceBalancesOnchain } from "./resources.js";
   import { loadUserBlocks, selectBlock } from "./blocks.js";
   import { loadUserAttacks, refreshBlockMarkings } from "./attacks.js";
   import {
     loadMercenaryProfileV4,
     loadMercenarySlotsV4
   } from "./subgraph.js";
   import {
     isTokenActiveOnV5,
     migrateSingleFarmV5ToV6,
     migrateManyFarmsV5ToV6,
     getFarmingV5Contract,
     getV5PendingTotal
   } from "./migration.js";
   
   let isMigrationRunning = false;
   let isBatchMigrationRunning = false;
   
   function getActionMessageDiv() {
     return byId("actionMessage");
   }
   
   function getProtectMessageDiv() {
     return byId("protectMessage");
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
   
   /* =========================================================
      FARMING V6
      ========================================================= */
   
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
   
       if (state.selectedBlock.farmingActive) {
         let preview = null;
         let pending = null;
         let total = ethers.BigNumber.from(0);
   
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
   
         try {
           preview = await state.farmingV6Contract.previewClaim(tokenId);
         } catch (e) {
           console.warn("V6 previewClaim failed, fallback to secondsUntilClaimable()", e);
         }
   
         if (preview) {
           if (!preview.allowed) {
             const code = preview?.code ?? "?";
             const secondsRemaining = Number(preview?.secondsRemaining || 0);
             msgDiv.innerHTML = `<span class="error">❌ V6 claim not ready. Code ${code}. Wait ${formatDuration(secondsRemaining)}.</span>`;
             return;
           }
         } else {
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
   
   /* =========================================================
      MIGRATION
      ========================================================= */
   
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
   
   /* =========================================================
      MERCENARY V4 HELPERS
      ========================================================= */
   
   function getMercenaryPaymentMode() {
     return (byId("mercenaryPaymentMode")?.value || "resources").toLowerCase();
   }
   
   function getSelectedMercenarySlot() {
     const v = parseInt(byId("protectSlotIndex")?.value || "0", 10);
     return Number.isFinite(v) ? v : 0;
   }
   
   function getSelectedProtectionDays() {
     const v = parseInt(byId("protectDays")?.value || "1", 10);
     return Number.isFinite(v) ? v : 1;
   }
   
   function getSelectedProtectTokenId() {
     const v = parseInt(byId("protectTokenId")?.value || "0", 10);
     return Number.isFinite(v) ? v : 0;
   }
   
   function renderCostList(items) {
     if (!items) return "";
   
     if (Array.isArray(items)) {
       return items.map((x) => `${x.amount} ${x.label}`).join(", ");
     }
   
     const labelMap = {
       oil: "Oil",
       lemons: "Lemons",
       iron: "Iron",
       gold: "Gold",
       platinum: "Platinum",
       copper: "Copper",
       crystal: "Crystal",
       obsidian: "Obsidian",
       mysterium: "Mysterium",
       aether: "Aether"
     };
   
     return Object.entries(items)
       .filter(([_, amount]) => Number(amount || 0) > 0)
       .map(([key, amount]) => `${amount} ${labelMap[key] || key}`)
       .join(", ");
   }
   
   export async function loadMercenaryPanelState() {
     if (!state.userAddress || !state.mercenaryV4Contract) return;
   
     try {
       const [profile, slots] = await Promise.all([
         loadMercenaryProfileV4(state.userAddress),
         loadMercenarySlotsV4(state.userAddress)
       ]);
   
       state.mercenaryProfile = profile || null;
       state.mercenarySlots = slots || [];
   
       updateMercenaryPanelDisplay();
     } catch (e) {
       console.error("loadMercenaryPanelState error:", e);
     }
   }
   
   export function updateMercenaryPanelDisplay() {
     const profile = state.mercenaryProfile;
     const slots = state.mercenarySlots || [];
     const selected = state.selectedBlock;
   
     safeValue("protectTokenId", selected?.tokenId || "");
   
     if (profile) {
       if (byId("mercenaryRank")) byId("mercenaryRank").textContent = profile.rankName || "Watchman";
       if (byId("mercenaryPoints")) byId("mercenaryPoints").textContent = String(profile.points || "0");
       if (byId("mercenaryDiscount")) byId("mercenaryDiscount").textContent = `${Number(profile.discountBps || 0) / 100}%`;
       if (byId("mercenarySlotsUnlocked")) byId("mercenarySlotsUnlocked").textContent = String(profile.slotsUnlocked || 1);
       if (byId("mercenaryTitle")) byId("mercenaryTitle").textContent = profile.bastionTitle || "—";
       if (byId("bastionTitleInput") && !byId("bastionTitleInput").value) {
         byId("bastionTitleInput").value = profile.bastionTitle || "";
       }
     } else {
       if (byId("mercenaryRank")) byId("mercenaryRank").textContent = "Watchman";
       if (byId("mercenaryPoints")) byId("mercenaryPoints").textContent = "0";
       if (byId("mercenaryDiscount")) byId("mercenaryDiscount").textContent = "2%";
       if (byId("mercenarySlotsUnlocked")) byId("mercenarySlotsUnlocked").textContent = "1";
       if (byId("mercenaryTitle")) byId("mercenaryTitle").textContent = "—";
     }
   
     const slotsBox = byId("mercenarySlotsInfo");
     if (slotsBox) {
       if (!slots.length) {
         slotsBox.innerHTML = `<div class="resource-item">No active protection slots.</div>`;
       } else {
         slotsBox.innerHTML = slots
           .sort((a, b) => Number(a.slotIndex) - Number(b.slotIndex))
           .map((slot) => {
             const expiry = Number(slot.expiry || 0);
             const active = !!slot.active && expiry > Math.floor(Date.now() / 1000);
             return `
               <div class="resource-item">
                 Slot ${Number(slot.slotIndex) + 1}: 
                 ${active ? `#${slot.tokenId} · ${slot.protectionPercent}% · ${formatDuration(expiry - Math.floor(Date.now() / 1000))}` : "inactive"}
               </div>
             `;
           })
           .join("");
       }
     }
   
     updateMercenaryCostPreview();
   }
   
   export async function updateMercenaryCostPreview() {
     const info = byId("mercenaryCostInfo");
     if (!info) return;
   
     const slotIndex = getSelectedMercenarySlot();
     const days = getSelectedProtectionDays();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
     const isExtension = !!(state.selectedBlock && state.selectedBlock.protectionActive);
   
     try {
       if (state.userAddress && state.mercenaryV4Contract) {
         const cost = await state.mercenaryV4Contract.getProtectionCost(
           state.userAddress,
           days,
           payInINPI,
           isExtension
         );
   
         if (payInINPI) {
           const inpiHuman = ethers.utils.formatEther(cost.inpiCost || cost[0]);
           info.textContent = `Cost: ${inpiHuman} INPI`;
         } else {
           const oil = Number(cost.oilCost || cost[1] || 0);
           const lemons = Number(cost.lemonsCost || cost[2] || 0);
           const iron = Number(cost.ironCost || cost[3] || 0);
           info.textContent = `Cost: ${oil} Oil, ${lemons} Lemons, ${iron} Iron`;
         }
       } else {
         const base = getMercenaryV4Cost(days);
         if (payInINPI) {
           info.textContent = `Cost: ${base.inpi} INPI`;
         } else {
           info.textContent = `Cost: ${base.oil} Oil, ${base.lemons} Lemons, ${base.iron} Iron`;
         }
       }
     } catch (e) {
       console.warn("updateMercenaryCostPreview fallback:", e);
       const base = getMercenaryV4Cost(days);
   
       if (payInINPI) {
         info.textContent = `Cost: ${base.inpi} INPI`;
       } else {
         info.textContent = `Cost: ${base.oil} Oil, ${base.lemons} Lemons, ${base.iron} Iron`;
       }
     }
   
     if (byId("protectDaysInfo")) {
       const tierInfo = getMercenaryV4Cost(days);
       const durationLabel = MERCENARY_DURATION_LABELS[days] || `${days} days`;
       const tierLabel = MERCENARY_TIER_LABELS[tierInfo.tier] || "None";
       byId("protectDaysInfo").textContent = `Duration: ${durationLabel} · Tier: ${tierLabel}`;
     }
   
     if (slotIndex >= 0 && byId("protectSlotInfo")) {
       byId("protectSlotInfo").textContent = `Selected Slot: ${slotIndex + 1}`;
     }
   }
   
   async function refreshMercenaryAfterWrite(tokenId = null) {
     await loadMercenaryPanelState();
     await loadUserBlocks({ onRevealSelected: null, onRefreshBlockMarkings: refreshBlockMarkings });
   
     if (state.selectedBlock) {
       await selectBlock(
         tokenId || state.selectedBlock.tokenId,
         state.selectedBlock.row,
         state.selectedBlock.col
       );
     }
   }
   
   export async function unlockMercenarySecondSlot() {
     const msgDiv = getProtectMessageDiv();
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Unlocking slot 2...<br>${renderCostList(MERCENARY_SLOT2_UNLOCK_COST)}</span>`;
   
       const tx = await state.mercenaryV4Contract.unlockSecondSlot({ gasLimit: 700000 });
       debugLog("unlockSecondSlot tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Slot 2 unlocked.</span>`;
       await loadResourceBalancesOnchain();
       await refreshMercenaryAfterWrite();
     } catch (e) {
       console.error("unlockMercenarySecondSlot error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function unlockMercenaryThirdSlot() {
     const msgDiv = getProtectMessageDiv();
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Unlocking slot 3...<br>${renderCostList(MERCENARY_SLOT3_UNLOCK_COST)}</span>`;
   
       const tx = await state.mercenaryV4Contract.unlockThirdSlot({ gasLimit: 800000 });
       debugLog("unlockThirdSlot tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Slot 3 unlocked.</span>`;
       await loadResourceBalancesOnchain();
       await refreshMercenaryAfterWrite();
     } catch (e) {
       console.error("unlockMercenaryThirdSlot error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function setMercenaryProtection() {
     const msgDiv = getProtectMessageDiv();
     const tokenId = getSelectedProtectTokenId();
     const slotIndex = getSelectedMercenarySlot();
     const durationDays = getSelectedProtectionDays();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
   
     if (!tokenId || !state.mercenaryV4Contract) return;
   
     try {
       const owner = await state.nftContract.ownerOf(tokenId);
       if (owner.toLowerCase() !== state.userAddress.toLowerCase()) {
         msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
         return;
       }
   
       if (payInINPI) {
         const previewCost = await state.mercenaryV4Contract.getProtectionCost(
           state.userAddress,
           durationDays,
           true,
           false
         );
         const amount = previewCost.inpiCost || previewCost[0];
         const ok = await ensureInpiApprovalForMercenary(amount);
         if (!ok) {
           msgDiv.innerHTML = `<span class="error">❌ INPI approval failed.</span>`;
           return;
         }
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Setting protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.setProtection(
         slotIndex,
         tokenId,
         durationDays,
         payInINPI,
         { gasLimit: 800000 }
       );
       debugLog("setProtection tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection set.</span>`;
       await loadResourceBalancesOnchain();
       await refreshMercenaryAfterWrite(tokenId);
     } catch (e) {
       console.error("setMercenaryProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function extendMercenaryProtection() {
     const msgDiv = getProtectMessageDiv();
     const slotIndex = getSelectedMercenarySlot();
     const additionalDays = getSelectedProtectionDays();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
   
     if (!state.mercenaryV4Contract) return;
   
     try {
       if (payInINPI) {
         const previewCost = await state.mercenaryV4Contract.getProtectionCost(
           state.userAddress,
           additionalDays,
           true,
           true
         );
         const amount = previewCost.inpiCost || previewCost[0];
         const ok = await ensureInpiApprovalForMercenary(amount);
         if (!ok) {
           msgDiv.innerHTML = `<span class="error">❌ INPI approval failed.</span>`;
           return;
         }
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Extending protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.extendProtection(
         slotIndex,
         additionalDays,
         payInINPI,
         { gasLimit: 800000 }
       );
       debugLog("extendProtection tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection extended.</span>`;
       await loadResourceBalancesOnchain();
       await refreshMercenaryAfterWrite();
     } catch (e) {
       console.error("extendMercenaryProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function cancelMercenaryProtection() {
     const msgDiv = getProtectMessageDiv();
     const slotIndex = getSelectedMercenarySlot();
   
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Cancelling protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.cancelProtection(slotIndex, {
         gasLimit: 500000
       });
       debugLog("cancelProtection tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection cancelled.</span>`;
       await refreshMercenaryAfterWrite();
     } catch (e) {
       console.error("cancelMercenaryProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function moveMercenaryProtection() {
     const msgDiv = getProtectMessageDiv();
     const slotIndex = getSelectedMercenarySlot();
     const newTokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !newTokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Moving protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.moveProtection(slotIndex, newTokenId, {
         gasLimit: 800000
       });
       debugLog("moveProtection tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection moved.</span>`;
       await refreshMercenaryAfterWrite(newTokenId);
     } catch (e) {
       console.error("moveMercenaryProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function emergencyMoveMercenaryProtection() {
     const msgDiv = getProtectMessageDiv();
     const slotIndex = getSelectedMercenarySlot();
     const newTokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !newTokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Emergency moving protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.emergencyMoveProtection(slotIndex, newTokenId, {
         gasLimit: 800000
       });
       debugLog("emergencyMoveProtection tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Emergency protection move complete.</span>`;
       await refreshMercenaryAfterWrite(newTokenId);
     } catch (e) {
       console.error("emergencyMoveMercenaryProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function cleanSelectedProtection() {
     const msgDiv = getProtectMessageDiv();
     const tokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !tokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Cleaning expired protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.cleanExpiredToken(tokenId, {
         gasLimit: 500000
       });
       debugLog("cleanExpiredToken tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Cleanup complete.</span>`;
       await loadResourceBalancesOnchain();
       await refreshMercenaryAfterWrite(tokenId);
     } catch (e) {
       console.error("cleanSelectedProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function saveBastionTitle() {
     const msgDiv = getProtectMessageDiv();
     const title = (byId("bastionTitleInput")?.value || "").trim();
   
     if (!state.mercenaryV4Contract) return;
     if (!title) {
       msgDiv.innerHTML = `<span class="error">❌ Enter a title first.</span>`;
       return;
     }
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Saving bastion title...</span>`;
   
       const tx = await state.mercenaryV4Contract.setBastionTitle(title, {
         gasLimit: 400000
       });
       debugLog("setBastionTitle tx", tx.hash);
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Bastion title saved.</span>`;
       await loadMercenaryPanelState();
     } catch (e) {
       console.error("saveBastionTitle error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   /* =========================================================
      LEGACY BUTTON COMPAT
      ========================================================= */
   
   export async function protect() {
     if (!state.selectedBlock?.protectionActive) {
       return setMercenaryProtection();
     }
     return extendMercenaryProtection();
   }