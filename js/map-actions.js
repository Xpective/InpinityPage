/* =========================================================
   MAP ACTIONS
   ========================================================= */

   import { state } from "./state.js";
   import { WORKER_URL, MERCENARY_V2_ADDRESS } from "./config.js";
   import { byId, formatDuration } from "./utils.js";
   import { mapState } from "./map-state.js";
   import {
     getAllMapTokens,
     loadData,
     loadUserResources,
     loadUserAttacks,
     getPreferredAttackerTokenId,
     normalizeAttackTuple,
     dismissAttackById,
     getAttackStorageKey,
     getFarmingV5Contract,
     getV5PendingTotal
   } from "./map-data.js";
   import { refreshSelectedTargetAttackPreview, updateSidebar } from "./map-selection.js";
   import { migrateSingleFarmV5ToV6 } from "./migration.js";
   import { PITRONE_ADDRESS } from "./config.js";

   const actionMessage = byId("actionMessage");
   
   async function refreshAfterTx() {
     await loadData();
     await loadUserResources();
     await loadUserAttacks();
     if (mapState.selectedTokenId) {
       await updateSidebar(mapState.selectedTokenId);
     }
   }
   
   async function sendTx(txPromise, successMsg) {
     if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Sending...</span>`;
   
     try {
       const tx = await txPromise;
       if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Confirming...</span>`;
       await tx.wait();
   
       if (actionMessage) actionMessage.innerHTML = `<span class="success">✅ ${successMsg}</span>`;
       await refreshAfterTx();
     } catch (err) {
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${err.reason || err.message || "Tx failed"}</span>`;
       }
     }
   }
   
   export async function handleBuyPirateBoost() {
    if (!state.userAddress) return;
  
    const attackerTokenId = await getPreferredAttackerTokenId();
    if (!attackerTokenId) {
      if (actionMessage) {
        actionMessage.innerHTML = `<span class="error">❌ No attacker block selected.</span>`;
      }
      return;
    }
  
    const days = parseInt(byId("pirateBoostDays")?.value || "1", 10);
    if (!Number.isFinite(days) || days < 1 || days > 10) {
      if (actionMessage) {
        actionMessage.innerHTML = `<span class="error">❌ Invalid pirate boost duration.</span>`;
      }
      return;
    }
  
    try {
      const cost = ethers.utils.parseEther(String(days * 100));
      const allowance = await state.pitroneContract.allowance(state.userAddress, state.piratesV6Contract.address);
  
      if (allowance.lt(cost)) {
        if (actionMessage) {
          actionMessage.innerHTML = `<span class="success">⏳ Approving PITRONE...</span>`;
        }
        const approveTx = await state.pitroneContract.approve(state.piratesV6Contract.address, cost);
        await approveTx.wait();
      }
  
      await sendTx(
        state.piratesV6Contract.buyPirateBoost(attackerTokenId, days, { gasLimit: 350000 }),
        `Pirate boost bought for ${days} day(s)!`
      );
  
      await refreshSelectedTargetAttackPreview();
    } catch (e) {
      if (actionMessage) {
        actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
      }
    }
  }
  
   export async function handleMigrateToV6() {
     if (!mapState.selectedTokenId) return;
   
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
       if (actionMessage) {
         actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
       }
     }
   }
   
   export async function handleReveal() {
     if (!mapState.selectedTokenId || !mapState.selectedTokenOwner) return;
   
     const tokenIdNum = parseInt(mapState.selectedTokenId, 10);
     const row = Math.floor(tokenIdNum / 2048);
     const col = tokenIdNum % 2048;
   
     try {
       const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
       if (!response.ok) throw new Error("Proofs not found");
       const proofs = await response.json();
   
       const formatProof = (arr) => arr.map((item) => {
         const v = item.left ? item.left : item.right;
         return v.startsWith("0x") ? v : ("0x" + v);
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
       if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
     }
   }
   
   export async function handleStartFarm() {
     if (!mapState.selectedTokenId) return;
   
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
   
     await sendTx(
       state.farmingV6Contract.stopFarming(mapState.selectedTokenId, { gasLimit: 500000 }),
       "Farming stopped."
     );
   }
   
   export async function handleClaim() {
     if (!mapState.selectedTokenId) return;
   
     const tokens = getAllMapTokens();
     const token = tokens[String(mapState.selectedTokenId)];
   
     try {
       if (token?.farmV5Active && !token?.farmActive) {
         const v5 = getFarmingV5Contract();
         const total = await getV5PendingTotal(mapState.selectedTokenId);
   
         if (total.isZero()) {
           actionMessage.innerHTML = `<span class="error">❌ Nothing to claim on V5.</span>`;
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
         actionMessage.innerHTML = `<span class="error">❌ Claim not ready. Code: ${preview.code}</span>`;
         return;
       }
   
       await sendTx(
         state.farmingV6Contract.claimResources(mapState.selectedTokenId, { gasLimit: 600000 }),
         "Resources claimed!"
       );
     } catch (e) {
       actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function handleBuyBoost() {
     if (!mapState.selectedTokenId) return;
   
     const days = parseInt(byId("boostDays")?.value, 10);
     if (!Number.isFinite(days) || days < 1 || days > 30) {
       alert("Please enter valid days (1-30)");
       return;
     }
   
     await sendTx(
       state.farmingV6Contract.buyBoost(mapState.selectedTokenId, days, { gasLimit: 300000 }),
       `Boost activated for ${days} days!`
     );
   }
   
   export async function handleProtect() {
     if (!mapState.selectedTokenId || !state.userAddress) return;
   
     const level = parseInt(byId("protectLevel")?.value, 10);
     if (!Number.isFinite(level) || level < 0 || level > 50) {
       alert("Invalid level (0-50)");
       return;
     }
   
     try {
       const cost = level * 10;
       const amount = ethers.utils.parseEther(String(cost));
       const allowance = await state.inpiContract.allowance(state.userAddress, MERCENARY_V2_ADDRESS);
   
       if (allowance.lt(amount)) {
         if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Approving...</span>`;
         const approveTx = await state.inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
         await approveTx.wait();
       }
   
       await sendTx(
         state.mercenaryV2Contract.hireMercenaries(mapState.selectedTokenId, level, { gasLimit: 400000 }),
         "Protection bought!"
       );
     } catch (e) {
       if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function handleAttack() {
     if (!mapState.selectedTokenId || !state.userAddress) return;
   
     const tokens = getAllMapTokens();
     const targetToken = tokens[mapState.selectedTokenId];
   
     if (!targetToken?.owner) {
       actionMessage.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
       return;
     }
   
     if (targetToken.owner.toLowerCase() === state.userAddress.toLowerCase()) {
       actionMessage.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
       return;
     }
   
     const attackerTokenId = await getPreferredAttackerTokenId();
     if (!attackerTokenId) {
       actionMessage.innerHTML = `<span class="error">❌ Need your own block to attack from.</span>`;
       return;
     }
   
     const targetTokenIdNum = parseInt(mapState.selectedTokenId, 10);
     const resource = parseInt(byId("attackResource")?.value || "0", 10);
   
     if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
       actionMessage.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
       return;
     }
   
     try {
       const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resource);
   
       if (!preview.allowed) {
         actionMessage.innerHTML = `<span class="error">❌ Attack not allowed. Code: ${preview.code}</span>`;
         await refreshSelectedTargetAttackPreview();
         return;
       }
   
       actionMessage.innerHTML = `
         <span class="success">
           ⏳ Starting attack...<br>
           Travel time: ${formatDuration(Number(preview.travelTime || 0))}<br>
           Steal amount: ${(preview.stealAmount || 0).toString()}<br>
           Remaining today: ${Number(preview.remainingAttacksToday || 0)}
         </span>
       `;
   
       const tx = await state.piratesV6Contract.startAttack(
         attackerTokenId,
         targetTokenIdNum,
         resource,
         { gasLimit: 450000 }
       );
   
       await tx.wait();
   
       actionMessage.innerHTML = `<span class="success">✅ Attack launched!</span>`;
   
       localStorage.setItem(
         getAttackStorageKey(targetTokenIdNum),
         JSON.stringify({
           targetTokenId: targetTokenIdNum,
           attackerTokenId,
           resource,
           startTime: Math.floor(Date.now() / 1000)
         })
       );
   
       await loadUserAttacks();
       await loadData();
       await refreshSelectedTargetAttackPreview();
     } catch (e) {
       actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function executeAttack(attack) {
     if (!actionMessage) return;
   
     actionMessage.innerHTML = `<span class="success">⏳ Checking attack...</span>`;
   
     try {
       const liveAttack = await state.piratesV6Contract.getAttack(attack.targetTokenId, attack.attackIndex);
       const normalized = normalizeAttackTuple(liveAttack);
       const now = Math.floor(Date.now() / 1000);
   
       if (normalized.executed) {
         actionMessage.innerHTML = `<span class="error">❌ Attack already executed.</span>`;
         if (attack.id) dismissAttackById(attack.id);
         await loadUserAttacks();
         return;
       }
   
       if (normalized.cancelled) {
         actionMessage.innerHTML = `<span class="error">❌ Attack was cancelled.</span>`;
         if (attack.id) dismissAttackById(attack.id);
         await loadUserAttacks();
         return;
       }
   
       if (normalized.endTime > now) {
         actionMessage.innerHTML = `<span class="error">❌ Attack not ready yet. Wait ${formatDuration(normalized.endTime - now)}.</span>`;
         return;
       }
   
       const preview = await state.piratesV6Contract.previewExecuteAttack(
         attack.targetTokenId,
         attack.attackIndex
       );
   
       if (!preview.allowed) {
         actionMessage.innerHTML = `<span class="error">❌ Execute not allowed. Code: ${preview.code}</span>`;
         return;
       }
   
       const tx = await state.piratesV6Contract.executeAttack(
         attack.targetTokenId,
         attack.attackIndex,
         { gasLimit: 350000 }
       );
   
       actionMessage.innerHTML = `<span class="success">⏳ Executing attack...</span>`;
       await tx.wait();
   
       actionMessage.innerHTML = `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`;
   
       localStorage.removeItem(getAttackStorageKey(attack.targetTokenId));
       if (attack.id) dismissAttackById(attack.id);
   
       await refreshAfterTx();
     } catch (e) {
       actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function cancelAttack(targetTokenId, attackIndex) {
     if (!actionMessage) return;
   
     try {
       const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
       const normalized = normalizeAttackTuple(liveAttack);
   
       if (normalized.attacker.toLowerCase() !== state.userAddress.toLowerCase()) {
         actionMessage.innerHTML = `<span class="error">❌ Not your attack to cancel.</span>`;
         return;
       }
   
       if (normalized.executed) {
         actionMessage.innerHTML = `<span class="error">❌ Cannot cancel executed attack.</span>`;
         return;
       }
   
       if (normalized.cancelled) {
         actionMessage.innerHTML = `<span class="error">❌ Attack already cancelled.</span>`;
         return;
       }
   
       const tx = await state.piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, {
         gasLimit: 300000
       });
   
       actionMessage.innerHTML = `<span class="success">⏳ Cancelling attack...</span>`;
       await tx.wait();
   
       actionMessage.innerHTML = `<span class="success">✅ Attack cancelled.</span>`;
       await refreshAfterTx();
     } catch (e) {
       actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }