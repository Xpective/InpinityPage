/* =========================================================
   MAP ACTIONS – V6 + MERCENARY V4
   ========================================================= */

   import { state } from "./state.js";
   import {
     WORKER_URL,
     MERCENARY_V4_ADDRESS,
     FARM_BOOST_PRICE_PER_DAY,
     FARM_BOOST_MAX_DAYS,
     PIRATE_BOOST_PRICE_PER_DAY,
     PIRATE_BOOST_MAX_DAYS,
     MERCENARY_SLOT2_UNLOCK_COST,
     MERCENARY_SLOT3_UNLOCK_COST
   } from "./config.js";
   import { byId, formatDuration } from "./utils.js";
   import { mapState } from "./map-state.js";
   import {
     getAllMapTokens,
     loadMapData,
     loadMapUserResources,
     loadMapUserAttacks,
     getPreferredAttackerTokenId,
     normalizeAttackTuple,
     dismissAttackById,
     getAttackStorageKey,
     getFarmingV5Contract,
     getV5PendingTotal
   } from "./map-data.js";
   import { refreshSelectedTargetAttackPreview, updateSidebar } from "./map-selection.js";
   import { migrateSingleFarmV5ToV6 } from "./migration.js";
   
   /* ==================== HELPER ==================== */
   
   function getActionMessageDiv() {
     return byId("actionMessage");
   }
   
   function getProtectMessageDiv() {
     return byId("protectMessage") || byId("actionMessage");
   }
   
   function setActionMessage(html) {
     const el = getActionMessageDiv();
     if (el) el.innerHTML = html;
   }
   
   function friendlyErrorMessage(e) {
     const msg = e?.reason || e?.data?.message || e?.message || "Transaction failed";
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
       if (e?.cancelled) return "Transaction was cancelled/replaced in wallet.";
       return "Transaction was replaced in wallet.";
     }
   
     if (lower.includes("replacement transaction underpriced")) {
       return "Replacement transaction underpriced. Please wait and try again.";
     }
   
     if (lower.includes("nonce too high")) {
       return "Nonce too high. Please check pending transactions in wallet.";
     }
   
     if (lower.includes("nonce has already been used")) {
       return "Nonce already used. Please wait for pending transactions.";
     }
   
     if (lower.includes("already known")) {
       return "This transaction is already known by the network.";
     }
   
     return msg;
   }
   
   function renderCostList(items) {
     return items.map((x) => `${x.amount} ${x.label}`).join(", ");
   }
   
   function getMercenarySlotIndex() {
     const v = parseInt(byId("protectSlotIndex")?.value || "0", 10);
     return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 0;
   }
   
   function getMercenaryDurationDays() {
     const v = parseInt(byId("protectDays")?.value || "7", 10);
     return Number.isFinite(v) ? Math.max(1, Math.min(7, v)) : 7;
   }
   
   function getMercenaryPaymentMode() {
     return (byId("mercenaryPaymentMode")?.value || "resources").toLowerCase();
   }
   
   function getSelectedProtectTokenId() {
     const raw = byId("protectTokenId")?.value || mapState.selectedTokenId || "0";
     const v = parseInt(raw, 10);
     return Number.isFinite(v) ? v : 0;
   }
   
   function getSelectedToken() {
     if (!mapState.selectedTokenId) return null;
     return getAllMapTokens()[String(mapState.selectedTokenId)] || null;
   }
   
   function isSelectedOwnedByUser() {
     const token = getSelectedToken();
     if (!token?.owner || !state.userAddress) return false;
     return token.owner.toLowerCase() === state.userAddress.toLowerCase();
   }
   
   function hasActiveProtectionOnSelectedToken() {
     const token = getSelectedToken();
     const now = Math.floor(Date.now() / 1000);
   
     return !!(
       token &&
       token.protectionActive &&
       Number(token.protectionExpiry || 0) > now
     );
   }
   
   async function requireOwnedSelectedToken(msgDiv = null) {
     if (!mapState.selectedTokenId) {
       if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ No block selected.</span>`;
       return false;
     }
   
     if (!state.userAddress) {
       if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ Wallet not connected.</span>`;
       return false;
     }
   
     if (!isSelectedOwnedByUser()) {
       if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ This action is only available for your own block.</span>`;
       return false;
     }
   
     return true;
   }
   
   /* ==================== UI UPDATES ==================== */
   
   export async function updateMapPirateBoostCostLabels() {
     const daysSelect = byId("pirateBoostDays");
     const info = byId("pirateBoostCostInfo");
   
     if (!info || !daysSelect) return;
   
     let days = parseInt(daysSelect.value, 10);
     if (!Number.isFinite(days)) days = 7;
   
     days = Math.max(1, Math.min(PIRATE_BOOST_MAX_DAYS, days));
     daysSelect.value = String(days);
   
     const total = days * PIRATE_BOOST_PRICE_PER_DAY;
   
     info.style.display = "block";
     info.innerHTML = `
       <span class="success">
         Pirate Boost: ${PIRATE_BOOST_PRICE_PER_DAY} PITRONE / day<br>
         Total: ${total} PITRONE for ${days} day${days > 1 ? "s" : ""}
       </span>
     `;
   }
   
   export function updateMapFarmBoostCostLabels() {
     const daysSelect = byId("boostDays");
     const info = byId("farmBoostCostInfo");
   
     if (!info || !daysSelect) return;
   
     let days = parseInt(daysSelect.value, 10);
     if (!Number.isFinite(days)) days = 7;
   
     days = Math.max(1, Math.min(FARM_BOOST_MAX_DAYS, days));
     daysSelect.value = String(days);
   
     const total = days * FARM_BOOST_PRICE_PER_DAY;
   
     info.style.display = "block";
     info.innerHTML = `
       <span class="success">
         Farm Boost: ${FARM_BOOST_PRICE_PER_DAY} INPI / day<br>
         Total: ${total} INPI for ${days} day${days > 1 ? "s" : ""}
       </span>
     `;
   }
   
   export async function updateMapMercenaryCostPreview() {
     const info = byId("mercenaryCostInfo");
     const slotInfo = byId("protectSlotInfo");
     const daysInfo = byId("protectDaysInfo");
   
     if (slotInfo) {
       slotInfo.textContent = `Selected Slot: ${getMercenarySlotIndex() + 1}`;
     }
   
     if (daysInfo) {
       const days = getMercenaryDurationDays();
       daysInfo.textContent = `Duration: ${days} day${days > 1 ? "s" : ""}`;
     }
   
     if (!info) return;
   
     const days = getMercenaryDurationDays();
     const slotIndex = getMercenarySlotIndex();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
     const isExtension = hasActiveProtectionOnSelectedToken();
   
     if (!state.userAddress || !state.mercenaryV4Contract) {
       info.textContent = "Cost: connect wallet";
       return;
     }
   
     try {
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
   
       if (slotInfo) {
         slotInfo.textContent = `Selected Slot: ${slotIndex + 1}${isExtension ? " · Extension" : ""}`;
       }
     } catch (e) {
       console.warn("updateMapMercenaryCostPreview error:", e);
       info.textContent = "Cost preview unavailable";
     }
   }
   
   async function refreshAfterTx() {
     await loadMapData();
     await loadMapUserResources();
     await loadMapUserAttacks();
   
     if (mapState.selectedTokenId) {
       await updateSidebar(mapState.selectedTokenId);
     }
   
     await updateMapMercenaryCostPreview();
   }
   
   /* ==================== TRANSACTION HELPER ==================== */
   
   async function sendTx(txPromise, successMsg) {
     setActionMessage(`<span class="success">⏳ Sending...</span>`);
   
     try {
       const tx = await txPromise;
   
       setActionMessage(`<span class="success">⏳ Confirming...</span>`);
       await tx.wait();
   
       setActionMessage(`<span class="success">✅ ${successMsg}</span>`);
       await refreshAfterTx();
     } catch (err) {
       console.error("map action tx error:", err);
       setActionMessage(`<span class="error">❌ ${friendlyErrorMessage(err)}</span>`);
     }
   }
   
   /* ==================== FARM ACTIONS ==================== */
   
   export async function handleMigrateToV6() {
     if (!mapState.selectedTokenId) return;
   
     const actionMessage = getActionMessageDiv();
   
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     try {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="success">⏳ Migrating V5 → V6...</span>`;
       }
   
       const result = await migrateSingleFarmV5ToV6(mapState.selectedTokenId, {
         claimIfPossible: true,
         stopOnV5: true,
         startOnV6: true
       });
   
       if (actionMessage) {
         actionMessage.innerHTML = `
           <span class="success">
             ✅ Migration complete.<br>
             Claimed on V5: ${result.claimedOnV5 ? "yes" : "no"}<br>
             Stopped on V5: ${result.stoppedOnV5 ? "yes" : "no"}<br>
             Started on V6: ${result.startedOnV6 ? "yes" : "no"}
           </span>
         `;
       }
   
       await refreshAfterTx();
     } catch (e) {
       console.error("handleMigrateToV6 error:", e);
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   export async function handleReveal() {
     if (!mapState.selectedTokenId || !mapState.selectedTokenOwner) return;
   
     const actionMessage = getActionMessageDiv();
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     const tokenIdNum = parseInt(mapState.selectedTokenId, 10);
     const row = Math.floor(tokenIdNum / 2048);
     const col = tokenIdNum % 2048;
   
     try {
       const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
       if (!response.ok) throw new Error("Proofs not found");
   
       const proofs = await response.json();
   
       const formatProof = (arr) =>
         arr.map((item) => {
           const v = item.left ? item.left : item.right;
           return v.startsWith("0x") ? v : `0x${v}`;
         });
   
       await sendTx(
         state.nftContract.revealBlock(
           mapState.selectedTokenId,
           formatProof(proofs.pi.proof),
           formatProof(proofs.phi.proof),
           proofs.pi.digit,
           proofs.phi.digit,
           { gasLimit: 500000 }
         ),
         "Block revealed!"
       );
     } catch (e) {
       console.error("handleReveal error:", e);
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   export async function handleStartFarm() {
     if (!mapState.selectedTokenId) return;
   
     const actionMessage = getActionMessageDiv();
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     const tokens = getAllMapTokens();
     const token = tokens[String(mapState.selectedTokenId)];
   
     if (token?.farmV5Active) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ This block is still active on V5. Migrate it first.</span>`;
       }
       return;
     }
   
     await sendTx(
       state.farmingV6Contract.startFarming(mapState.selectedTokenId, { gasLimit: 500000 }),
       "Farming started."
     );
   }
   
   export async function handleStopFarm() {
     if (!mapState.selectedTokenId) return;
   
     const actionMessage = getActionMessageDiv();
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     await sendTx(
       state.farmingV6Contract.stopFarming(mapState.selectedTokenId, { gasLimit: 500000 }),
       "Farming stopped."
     );
   }
   
   export async function handleClaim() {
     if (!mapState.selectedTokenId) return;
   
     const actionMessage = getActionMessageDiv();
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     const tokens = getAllMapTokens();
     const token = tokens[String(mapState.selectedTokenId)];
   
     try {
       if (token?.farmV5Active && !token?.farmActive) {
         const v5 = getFarmingV5Contract();
         const total = await getV5PendingTotal(mapState.selectedTokenId);
   
         if (!total || total.isZero()) {
           if (actionMessage) {
             actionMessage.innerHTML = `<span class="error">❌ Nothing to claim on V5.</span>`;
           }
           return;
         }
   
         await sendTx(
           v5.claimResources(mapState.selectedTokenId, { gasLimit: 700000 }),
           "V5 resources claimed!"
         );
         return;
       }
   
       const preview = await state.farmingV6Contract.previewClaim(mapState.selectedTokenId);
       if (!preview.allowed) {
         if (actionMessage) {
           actionMessage.innerHTML = `<span class="error">❌ Claim not ready. Code: ${preview.code}</span>`;
         }
         return;
       }
   
       await sendTx(
         state.farmingV6Contract.claimResources(mapState.selectedTokenId, { gasLimit: 600000 }),
         "Resources claimed!"
       );
     } catch (e) {
       console.error("handleClaim error:", e);
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   export async function handleBuyBoost() {
     if (!mapState.selectedTokenId || !state.userAddress) return;
   
     const actionMessage = getActionMessageDiv();
     if (!(await requireOwnedSelectedToken(actionMessage))) return;
   
     const days = parseInt(byId("boostDays")?.value || "7", 10);
   
     if (!Number.isFinite(days) || days < 1 || days > FARM_BOOST_MAX_DAYS) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ Invalid farm boost duration.</span>`;
       }
       return;
     }
   
     try {
       const costHuman = days * FARM_BOOST_PRICE_PER_DAY;
       const costWei = ethers.utils.parseEther(String(costHuman));
   
       const allowance = await state.inpiContract.allowance(
         state.userAddress,
         state.farmingV6Contract.address
       );
   
       if (allowance.lt(costWei)) {
         if (actionMessage) {
           actionMessage.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
         }
         const approveTx = await state.inpiContract.approve(
           state.farmingV6Contract.address,
           costWei
         );
         await approveTx.wait();
       }
   
       await sendTx(
         state.farmingV6Contract.buyBoost(mapState.selectedTokenId, days, { gasLimit: 350000 }),
         `Farm boost bought for ${days} day(s)! Paid: ${costHuman} INPI`
       );
     } catch (e) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   export async function handleBuyPirateBoost() {
     if (!state.userAddress) return;
   
     const actionMessage = getActionMessageDiv();
     const attackerTokenId = await getPreferredAttackerTokenId();
     if (!attackerTokenId) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ No attacker block selected.</span>`;
       }
       return;
     }
   
     const daysInput = byId("pirateBoostDays");
     let days = parseInt(daysInput?.value, 10);
   
     if (!Number.isFinite(days)) days = 7;
     days = Math.max(1, Math.min(PIRATE_BOOST_MAX_DAYS, days));
   
     if (daysInput) {
       daysInput.value = String(days);
     }
   
     const totalCostHuman = days * PIRATE_BOOST_PRICE_PER_DAY;
   
     try {
       if (!state.pitroneContract) throw new Error("PITRONE contract not initialized");
       if (!state.piratesV6Contract) throw new Error("PiratesV6 contract not initialized");
   
       const cost = ethers.utils.parseEther(String(totalCostHuman));
       const spender = state.piratesV6Contract.address;
       const allowance = await state.pitroneContract.allowance(state.userAddress, spender);
   
       if (allowance.lt(cost)) {
         if (actionMessage) {
           actionMessage.innerHTML = `
             <span class="success">
               ⏳ Approving PITRONE...<br>
               Cost: ${totalCostHuman} PIT
             </span>
           `;
         }
   
         const approveTx = await state.pitroneContract.approve(spender, cost);
         await approveTx.wait();
       }
   
       await sendTx(
         state.piratesV6Contract.buyPirateBoost(attackerTokenId, days, { gasLimit: 350000 }),
         `Pirate boost bought for block #${attackerTokenId} for ${days} day(s)! Paid: ${totalCostHuman} PIT`
       );
   
       await refreshSelectedTargetAttackPreview();
     } catch (e) {
       console.error("handleBuyPirateBoost error:", e);
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   /* ==================== MERCENARY V4 ==================== */
   
   export async function handleSetProtection() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     const tokenId = getSelectedProtectTokenId();
     const slotIndex = getMercenarySlotIndex();
     const durationDays = getMercenaryDurationDays();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
   
     if (!tokenId || !state.mercenaryV4Contract || !state.userAddress) return;
   
     try {
       if (payInINPI) {
         const cost = await state.mercenaryV4Contract.getProtectionCost(
           state.userAddress,
           durationDays,
           true,
           false
         );
         const inpiCost = cost.inpiCost || cost[0];
   
         const allowance = await state.inpiContract.allowance(state.userAddress, MERCENARY_V4_ADDRESS);
         if (allowance.lt(inpiCost)) {
           msgDiv.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
           const approveTx = await state.inpiContract.approve(MERCENARY_V4_ADDRESS, inpiCost);
           await approveTx.wait();
         }
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Setting protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.setProtection(
         slotIndex,
         tokenId,
         durationDays,
         payInINPI,
         { gasLimit: 900000 }
       );
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection set.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleSetProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleExtendProtection() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     const slotIndex = getMercenarySlotIndex();
     const additionalDays = getMercenaryDurationDays();
     const payInINPI = getMercenaryPaymentMode() === "inpi";
   
     if (!state.mercenaryV4Contract || !state.userAddress) return;
   
     try {
       if (!hasActiveProtectionOnSelectedToken()) {
         msgDiv.innerHTML = `<span class="error">❌ No active protection on this block to extend.</span>`;
         return;
       }
   
       if (payInINPI) {
         const cost = await state.mercenaryV4Contract.getProtectionCost(
           state.userAddress,
           additionalDays,
           true,
           true
         );
         const inpiCost = cost.inpiCost || cost[0];
   
         const allowance = await state.inpiContract.allowance(state.userAddress, MERCENARY_V4_ADDRESS);
         if (allowance.lt(inpiCost)) {
           msgDiv.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
           const approveTx = await state.inpiContract.approve(MERCENARY_V4_ADDRESS, inpiCost);
           await approveTx.wait();
         }
       }
   
       msgDiv.innerHTML = `<span class="success">⏳ Extending protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.extendProtection(
         slotIndex,
         additionalDays,
         payInINPI,
         { gasLimit: 900000 }
       );
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection extended.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleExtendProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleCancelProtection() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     const slotIndex = getMercenarySlotIndex();
   
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Cancelling protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.cancelProtection(slotIndex, {
         gasLimit: 600000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection cancelled.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleCancelProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleMoveProtection() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     const slotIndex = getMercenarySlotIndex();
     const newTokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !newTokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Moving protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.moveProtection(slotIndex, newTokenId, {
         gasLimit: 900000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Protection moved.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleMoveProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleEmergencyMoveProtection() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     const slotIndex = getMercenarySlotIndex();
     const newTokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !newTokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Emergency moving protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.emergencyMoveProtection(slotIndex, newTokenId, {
         gasLimit: 900000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Emergency move complete.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleEmergencyMoveProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleCleanupProtection() {
     const msgDiv = getProtectMessageDiv();
     const tokenId = getSelectedProtectTokenId();
   
     if (!state.mercenaryV4Contract || !tokenId) return;
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Cleaning expired protection...</span>`;
   
       const tx = await state.mercenaryV4Contract.cleanExpiredToken(tokenId, {
         gasLimit: 600000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Cleanup complete.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleCleanupProtection error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleUnlockSlot2() {
     const msgDiv = getProtectMessageDiv();
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `
         <span class="success">
           ⏳ Unlocking slot 2...<br>
           ${renderCostList([
             { amount: MERCENARY_SLOT2_UNLOCK_COST.oil, label: "Oil" },
             { amount: MERCENARY_SLOT2_UNLOCK_COST.lemons, label: "Lemons" },
             { amount: MERCENARY_SLOT2_UNLOCK_COST.iron, label: "Iron" }
           ])}
         </span>
       `;
   
       const tx = await state.mercenaryV4Contract.unlockSecondSlot({ gasLimit: 800000 });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Slot 2 unlocked.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleUnlockSlot2 error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleUnlockSlot3() {
     const msgDiv = getProtectMessageDiv();
     if (!state.mercenaryV4Contract) return;
   
     try {
       msgDiv.innerHTML = `
         <span class="success">
           ⏳ Unlocking slot 3...<br>
           ${renderCostList([
             { amount: MERCENARY_SLOT3_UNLOCK_COST.oil, label: "Oil" },
             { amount: MERCENARY_SLOT3_UNLOCK_COST.lemons, label: "Lemons" },
             { amount: MERCENARY_SLOT3_UNLOCK_COST.iron, label: "Iron" },
             { amount: MERCENARY_SLOT3_UNLOCK_COST.gold, label: "Gold" },
             { amount: MERCENARY_SLOT3_UNLOCK_COST.crystal, label: "Crystal" },
             { amount: MERCENARY_SLOT3_UNLOCK_COST.mysterium, label: "Mysterium" }
           ])}
         </span>
       `;
   
       const tx = await state.mercenaryV4Contract.unlockThirdSlot({ gasLimit: 1000000 });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Slot 3 unlocked.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleUnlockSlot3 error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleSaveBastionTitle() {
     const msgDiv = getProtectMessageDiv();
     if (!state.mercenaryV4Contract) return;
   
     const title = (byId("bastionTitleInput")?.value || "").trim();
     if (!title) {
       msgDiv.innerHTML = `<span class="error">❌ Enter a title first.</span>`;
       return;
     }
   
     const points =
       Number(mapState.mercenaryProfile?.defenderPoints || mapState.mercenaryProfile?.points || 0);
   
     if (points < 1000) {
       msgDiv.innerHTML = `<span class="error">❌ Bastion Title unlocks at 1000 Defender Points.</span>`;
       return;
     }
   
     try {
       msgDiv.innerHTML = `<span class="success">⏳ Saving bastion title...</span>`;
   
       const tx = await state.mercenaryV4Contract.setBastionTitle(title, {
         gasLimit: 500000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Bastion title saved.</span>`;
       await refreshAfterTx();
     } catch (e) {
       console.error("handleSaveBastionTitle error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
     }
   }
   
   export async function handleProtect() {
     const msgDiv = getProtectMessageDiv();
     if (!(await requireOwnedSelectedToken(msgDiv))) return;
   
     if (hasActiveProtectionOnSelectedToken()) {
       return handleExtendProtection();
     }
     return handleSetProtection();
   }
   
   /* ==================== PIRATES ==================== */
   
   export async function handleAttack() {
     if (!mapState.selectedTokenId || !state.userAddress) return;
   
     const actionMessage = getActionMessageDiv();
     const tokens = getAllMapTokens();
     const targetToken = tokens[mapState.selectedTokenId];
   
     if (!targetToken?.owner) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
       }
       return;
     }
   
     if (targetToken.owner.toLowerCase() === state.userAddress.toLowerCase()) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
       }
       return;
     }
   
     const attackerTokenId = await getPreferredAttackerTokenId();
     if (!attackerTokenId) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ Need your own block to attack from.</span>`;
       }
       return;
     }
   
     const targetTokenIdNum = parseInt(mapState.selectedTokenId, 10);
     const resource = parseInt(byId("attackResource")?.value || "0", 10);
   
     if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
       }
       return;
     }
   
     try {
       const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resource);
   
       if (!preview.allowed) {
         if (actionMessage) {
           actionMessage.innerHTML = `<span class="error">❌ Attack not allowed. Code: ${preview.code}</span>`;
         }
         await refreshSelectedTargetAttackPreview();
         return;
       }
   
       if (actionMessage) {
         actionMessage.innerHTML = `
           <span class="success">
             ⏳ Starting attack...<br>
             Travel time: ${formatDuration(Number(preview.travelTime || 0))}<br>
             Steal amount: ${(preview.stealAmount || 0).toString()}<br>
             Remaining today: ${Number(preview.remainingAttacksToday || 0)}
           </span>
         `;
       }
   
       const tx = await state.piratesV6Contract.startAttack(attackerTokenId, targetTokenIdNum, resource, {
         gasLimit: 450000
       });
       await tx.wait();
   
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="success">✅ Attack launched!</span>`;
       }
   
       localStorage.setItem(
         getAttackStorageKey(targetTokenIdNum),
         JSON.stringify({
           targetTokenId: targetTokenIdNum,
           attackerTokenId,
           resource,
           startTime: Math.floor(Date.now() / 1000)
         })
       );
   
       await loadMapUserAttacks();
       await loadMapData();
       await refreshSelectedTargetAttackPreview();
     } catch (e) {
       console.error("handleAttack error:", e);
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
       }
     }
   }
   
   export async function executeAttack(attack) {
     try {
       if (!state.userAddress) {
         setActionMessage(`<span class="error">❌ Wallet not connected.</span>`);
         return;
       }
   
       if (!state.piratesV6Contract) {
         setActionMessage(`<span class="error">❌ PiratesV6 contract not initialized.</span>`);
         return;
       }
   
       if (
         !attack ||
         !Number.isFinite(Number(attack.targetTokenId)) ||
         !Number.isFinite(Number(attack.attackIndex))
       ) {
         setActionMessage(`<span class="error">❌ Invalid attack payload.</span>`);
         return;
       }
   
       setActionMessage(`<span class="success">⏳ Checking attack...</span>`);
   
       const targetTokenId = Number(attack.targetTokenId);
       const attackIndex = Number(attack.attackIndex);
   
       const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
       const normalized = normalizeAttackTuple(liveAttack);
       const now = Math.floor(Date.now() / 1000);
   
       if (!normalized.attacker) {
         setActionMessage(`<span class="error">❌ Attack not found on-chain.</span>`);
         return;
       }
   
       if (normalized.attacker.toLowerCase() !== state.userAddress.toLowerCase()) {
         setActionMessage(`<span class="error">❌ This is not your attack.</span>`);
         return;
       }
   
       if (normalized.executed) {
         setActionMessage(`<span class="error">❌ Attack already executed.</span>`);
         if (attack.id) dismissAttackById(attack.id);
         await loadMapUserAttacks();
         return;
       }
   
       if (normalized.cancelled) {
         setActionMessage(`<span class="error">❌ Attack was already cancelled.</span>`);
         if (attack.id) dismissAttackById(attack.id);
         await loadMapUserAttacks();
         return;
       }
   
       if (normalized.endTime > now) {
         setActionMessage(
           `<span class="error">❌ Attack not ready yet. Wait ${formatDuration(normalized.endTime - now)}.</span>`
         );
         return;
       }
   
       setActionMessage(`<span class="success">⏳ Previewing execute...</span>`);
   
       const preview = await state.piratesV6Contract.previewExecuteAttack(targetTokenId, attackIndex);
   
       if (!preview.allowed) {
         setActionMessage(
           `<span class="error">❌ Execute not allowed. Code: ${preview.code}</span>`
         );
         return;
       }
   
       setActionMessage(`<span class="success">⏳ Opening wallet...</span>`);
   
       const tx = await state.piratesV6Contract.executeAttack(
         targetTokenId,
         attackIndex,
         { gasLimit: 350000 }
       );
   
       setActionMessage(`<span class="success">⏳ Executing attack...</span>`);
   
       await tx.wait();
   
       setActionMessage(
         `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`
       );
   
       localStorage.removeItem(getAttackStorageKey(targetTokenId));
       if (attack.id) dismissAttackById(attack.id);
   
       await refreshAfterTx();
     } catch (e) {
       console.error("executeAttack error:", e);
       setActionMessage(`<span class="error">❌ ${friendlyErrorMessage(e)}</span>`);
     }
   }
   
   export async function cancelAttack(targetTokenId, attackIndex) {
     try {
       if (!state.userAddress) {
         setActionMessage(`<span class="error">❌ Wallet not connected.</span>`);
         return;
       }
   
       if (!state.piratesV6Contract) {
         setActionMessage(`<span class="error">❌ PiratesV6 contract not initialized.</span>`);
         return;
       }
   
       if (!Number.isFinite(Number(targetTokenId)) || !Number.isFinite(Number(attackIndex))) {
         setActionMessage(`<span class="error">❌ Invalid cancel payload.</span>`);
         return;
       }
   
       const targetIdNum = Number(targetTokenId);
       const attackIdxNum = Number(attackIndex);
   
       const liveAttack = await state.piratesV6Contract.getAttack(targetIdNum, attackIdxNum);
       const normalized = normalizeAttackTuple(liveAttack);
   
       if (!normalized.attacker) {
         setActionMessage(`<span class="error">❌ Attack not found on-chain.</span>`);
         return;
       }
   
       if (normalized.attacker.toLowerCase() !== state.userAddress.toLowerCase()) {
         setActionMessage(`<span class="error">❌ Not your attack to cancel.</span>`);
         return;
       }
   
       if (normalized.executed) {
         setActionMessage(`<span class="error">❌ Cannot cancel executed attack.</span>`);
         return;
       }
   
       if (normalized.cancelled) {
         setActionMessage(`<span class="error">❌ Attack already cancelled.</span>`);
         return;
       }
   
       setActionMessage(`<span class="success">⏳ Opening wallet...</span>`);
   
       const tx = await state.piratesV6Contract.cancelOwnPendingAttack(
         targetIdNum,
         attackIdxNum,
         { gasLimit: 300000 }
       );
   
       setActionMessage(`<span class="success">⏳ Cancelling attack...</span>`);
   
       await tx.wait();
   
       setActionMessage(`<span class="success">✅ Attack cancelled.</span>`);
   
       await refreshAfterTx();
     } catch (e) {
       console.error("cancelAttack error:", e);
       setActionMessage(`<span class="error">❌ ${friendlyErrorMessage(e)}</span>`);
     }
   }