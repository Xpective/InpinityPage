/* =========================================================
   MAP SELECTION / SIDEBAR
   ========================================================= */

   import { state } from "./state.js";
   import { rarityNames } from "./config.js";
   import {
     byId,
     shortenAddress,
     formatDuration
   } from "./utils.js";
   import {
     mapState,
     MAP_CONST
   } from "./map-state.js";
   import {
     getAllMapTokens,
     safeGetFarm,
     getPreferredAttackerTokenId,
     getAttackableResourceIds,
     populateAttackResourceSelect,
     getReadOnlyNFTContract
   } from "./map-data.js";
   
   const blockDetailDiv = byId("blockDetail");
   const actionPanel = byId("actionPanel");
   const ownerActionsDiv = byId("ownerActions");
   const protectionInput = byId("protectionInput");
   const attackInput = byId("attackInput");
   const actionMessage = byId("actionMessage");
   
   function getProduction(rarity) {
     const p = {};
   
     if (rarity === 0) {
       p.OIL = 12; p.LEMONS = 8; p.IRON = 5; p.COPPER = 1;
     } else if (rarity === 1) {
       p.OIL = 14; p.LEMONS = 10; p.IRON = 7; p.GOLD = 1; p.COPPER = 2;
     } else if (rarity === 2) {
       p.OIL = 16; p.LEMONS = 12; p.IRON = 9; p.GOLD = 2; p.PLATINUM = 1; p.COPPER = 3; p.CRYSTAL = 1;
     } else if (rarity === 3) {
       p.OIL = 18; p.LEMONS = 14; p.IRON = 11; p.GOLD = 3; p.PLATINUM = 2; p.COPPER = 4; p.CRYSTAL = 2; p.MYSTERIUM = 1;
     } else if (rarity === 4) {
       p.OIL = 20; p.LEMONS = 15; p.IRON = 12; p.GOLD = 5; p.PLATINUM = 3; p.COPPER = 5; p.CRYSTAL = 3; p.OBSIDIAN = 1; p.MYSTERIUM = 1; p.AETHER = 1;
     }
   
     return p;
   }
   
   export function clearActionArea() {
     if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
     if (protectionInput) protectionInput.style.display = "none";
     if (attackInput) attackInput.style.display = "none";
     if (actionMessage) actionMessage.innerHTML = "";
   }
   
   export async function refreshSelectedTargetAttackPreview() {
     const tokens = getAllMapTokens();
   
     const attackerBlockEl = byId("attackAttackerBlock");
     const targetStatusEl = byId("attackTargetStatus");
     const travelTimeEl = byId("attackTravelTime");
     const remainingEl = byId("attackRemainingToday");
     const pendingLootEl = byId("attackPendingLoot");
     const stealAmountEl = byId("attackStealAmount");
     const protectionEl = byId("attackProtection");
     const stealPercentEl = byId("attackStealPercent");
     const attackResourceEl = byId("attackResource");
     const attackBtn = byId("attackBtn");
   
     const token = tokens[mapState.selectedTokenId];
   
     if (
       !mapState.selectedTokenId ||
       !state.userAddress ||
       !token?.owner ||
       token.owner.toLowerCase() === state.userAddress.toLowerCase()
     ) {
       if (attackInput) attackInput.style.display = "none";
       return;
     }
   
     if (attackInput) attackInput.style.display = "flex";
   
     const attackerTokenId = await getPreferredAttackerTokenId();
   
     if (!attackerTokenId) {
       if (attackerBlockEl) attackerBlockEl.innerText = "—";
       if (targetStatusEl) targetStatusEl.innerText = "❌ No attacker block";
       if (travelTimeEl) travelTimeEl.innerText = "—";
       if (remainingEl) remainingEl.innerText = "—";
       if (pendingLootEl) pendingLootEl.innerText = "—";
       if (stealAmountEl) stealAmountEl.innerText = "—";
       if (protectionEl) protectionEl.innerText = "—";
       if (stealPercentEl) stealPercentEl.innerText = "—";
       populateAttackResourceSelect([]);
       if (attackBtn) attackBtn.disabled = true;
       return;
     }
   
     if (attackerBlockEl) attackerBlockEl.innerText = `#${attackerTokenId}`;
   
     const targetTokenIdNum = parseInt(mapState.selectedTokenId, 10);
     const lootableIds = await getAttackableResourceIds(attackerTokenId, targetTokenIdNum);
   
     let selectedResourceId = attackResourceEl?.value ?? null;
     if (
       selectedResourceId === null ||
       selectedResourceId === "" ||
       !lootableIds.includes(Number(selectedResourceId))
     ) {
       selectedResourceId = lootableIds.length ? lootableIds[0] : null;
     }
   
     populateAttackResourceSelect(lootableIds, selectedResourceId);
   
     if (!lootableIds.length) {
       if (targetStatusEl) targetStatusEl.innerText = "⚠️ No loot available";
       if (travelTimeEl) travelTimeEl.innerText = "—";
       if (remainingEl) remainingEl.innerText = "—";
       if (pendingLootEl) pendingLootEl.innerText = "0";
       if (stealAmountEl) stealAmountEl.innerText = "—";
       if (protectionEl) protectionEl.innerText = "—";
       if (stealPercentEl) stealPercentEl.innerText = "—";
       if (attackBtn) attackBtn.disabled = true;
       return;
     }
   
     const resourceId = parseInt(byId("attackResource")?.value || "0", 10);
   
     try {
       const preview = await state.piratesV6Contract.previewAttack(
         attackerTokenId,
         targetTokenIdNum,
         resourceId
       );
   
       if (targetStatusEl) {
         if (preview.allowed) {
           targetStatusEl.innerText = "✅ Attack allowed";
         } else if (Number(preview.pendingAmount || 0) === 0) {
           targetStatusEl.innerText = "⚠️ No loot available";
         } else {
           targetStatusEl.innerText = `❌ Blocked (Code ${preview.code})`;
         }
       }
   
       if (travelTimeEl) {
         travelTimeEl.innerText = formatDuration(Number(preview.travelTime || 0));
       }
       if (remainingEl) {
         remainingEl.innerText = String(Number(preview.remainingAttacksToday || 0));
       }
       if (pendingLootEl) {
         pendingLootEl.innerText = (preview.pendingAmount || 0).toString();
       }
       if (stealAmountEl) {
         stealAmountEl.innerText = (preview.stealAmount || 0).toString();
       }
       if (protectionEl) {
         protectionEl.innerText = `${Number(preview.protectionLevel || 0)}%`;
       }
       if (stealPercentEl) {
         stealPercentEl.innerText = `${Number(preview.effectiveStealPercent || 0)}%`;
       }
       if (attackBtn) {
         attackBtn.disabled = !preview.allowed;
       }
     } catch {
       if (targetStatusEl) targetStatusEl.innerText = "⚠️ Preview failed";
       if (attackBtn) attackBtn.disabled = true;
     }
   }
   
   export async function updateSidebar(tokenId) {
     const tokens = getAllMapTokens();
     const nftReadOnlyContract = getReadOnlyNFTContract();
   
     mapState.selectedTokenId = String(tokenId);
     const token = tokens[mapState.selectedTokenId];
     const owner = token ? token.owner : null;
     mapState.selectedTokenOwner = owner;
   
     if (
       state.userAddress &&
       owner &&
       owner.toLowerCase() === state.userAddress.toLowerCase()
     ) {
       mapState.selectedAttackerTokenId = String(tokenId);
     }
   
     const now = Math.floor(Date.now() / 1000);
     let v5Active = !!token?.farmV5Active;
     let v6Active = false;
   
     let farmVersionTxt = "-";
     let farmAgeTxt = "-";
     let claimTxt = "-";
     let pendingTotalTxt = "-";
     let boostTxt = "-";
   
     if (v5Active) {
       farmVersionTxt = "V5 Legacy";
       if (token.farmV5StartTime > 0) {
         farmAgeTxt = formatDuration(now - token.farmV5StartTime);
       }
       claimTxt = "Claim or migrate";
       pendingTotalTxt = "legacy";
     }
   
     if (state.farmingV6Contract && token?.owner) {
       const farmInfo = await safeGetFarm(mapState.selectedTokenId);
       v6Active = farmInfo.ok && farmInfo.isActive;
   
       if (v6Active) {
         farmVersionTxt = "V6 Active";
   
         if (farmInfo.startTime > 0) {
           farmAgeTxt = formatDuration(now - farmInfo.startTime);
         }
   
         try {
           const preview = await state.farmingV6Contract.previewClaim(mapState.selectedTokenId);
           pendingTotalTxt = preview.pendingAmount ? preview.pendingAmount.toString() : "0";
           claimTxt = preview.allowed
             ? "READY"
             : (
                 Number(preview.secondsRemaining || 0) > 0
                   ? `in ${formatDuration(Number(preview.secondsRemaining))}`
                   : "Not ready"
               );
         } catch {}
   
         if (farmInfo.boostExpiry && farmInfo.boostExpiry > now) {
           boostTxt = "active";
         }
       }
     }
   
     if (!v5Active && !v6Active) {
       farmVersionTxt = "Inactive";
     }
   
     let productionHtml = "";
     let rarityDisplay = "";
   
     if (token?.owner && token.revealed && nftReadOnlyContract) {
       try {
         const tokenIdNum = parseInt(mapState.selectedTokenId, 10);
         const rarity = token.rarity !== null
           ? token.rarity
           : await nftReadOnlyContract.calculateRarity(tokenIdNum);
   
         const r = Number(rarity);
   
         rarityDisplay = `
           <div class="detail-row">
             <span class="detail-label">Rarity</span>
             <span class="detail-value ${MAP_CONST.rarityClass[r]}">${rarityNames[r]}</span>
           </div>
         `;
   
         const production = getProduction(r);
         productionHtml = `<div class="detail-row"><span class="detail-label">Production</span></div>`;
   
         for (const [res, amount] of Object.entries(production)) {
           productionHtml += `
             <div class="detail-row">
               <span class="detail-label">${res}</span>
               <span class="detail-value">${amount}/d</span>
             </div>
           `;
         }
       } catch {}
     }
   
     if (token?.owner) {
       blockDetailDiv.innerHTML = `
         <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${mapState.selectedTokenId}</span></div>
         <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value">${shortenAddress(owner)}</span></div>
         <div class="detail-row"><span class="detail-label">Revealed</span><span class="detail-value">${token.revealed ? "✅" : "❌"}</span></div>
         ${rarityDisplay}
         <div class="detail-row"><span class="detail-label">Farming</span><span class="detail-value">${farmVersionTxt}</span></div>
         <div class="detail-row"><span class="detail-label">Farm age</span><span class="detail-value">${farmAgeTxt}</span></div>
         <div class="detail-row"><span class="detail-label">Boost</span><span class="detail-value">${boostTxt}</span></div>
         <div class="detail-row"><span class="detail-label">Claim-ready</span><span class="detail-value">${claimTxt}</span></div>
         <div class="detail-row"><span class="detail-label">Pending</span><span class="detail-value">${pendingTotalTxt}</span></div>
         ${productionHtml}
       `;
     } else {
       blockDetailDiv.innerHTML = `<p style="color:#98a9b9;">Block #${mapState.selectedTokenId} not minted</p>`;
     }
   
     if (actionPanel) actionPanel.style.display = token?.owner ? "block" : "none";
     clearActionArea();
   
     if (state.userAddress && owner && owner.toLowerCase() !== state.userAddress.toLowerCase()) {
       await refreshSelectedTargetAttackPreview();
       return;
     }
   
     if (state.userAddress && owner && owner.toLowerCase() === state.userAddress.toLowerCase()) {
       let btns = "";
   
       if (!token.revealed) {
         btns += `<button class="action-btn" id="revealBtn">🔓 Reveal</button>`;
       }
   
       if (v5Active && !v6Active) {
         btns += `<button class="action-btn" id="claimBtn">💰 Claim V5</button>`;
         btns += `<button class="action-btn boost-btn" id="migrateFarmBtn">🔄 Migrate V5 → V6</button>`;
       } else if (!v6Active) {
         btns += `<button class="action-btn" id="startFarmBtn">🌾 Start Farming (V6)</button>`;
       } else {
         btns += `<button class="action-btn" id="stopFarmBtn">⏹️ Stop</button>`;
         btns += `<button class="action-btn" id="claimBtn">💰 Claim</button>`;
         btns += `<button class="action-btn boost-btn" id="buyBoostBtn">⚡ Buy Boost</button>`;
       }
   
       if (protectionInput) protectionInput.style.display = "flex";
       if (ownerActionsDiv) ownerActionsDiv.innerHTML = btns;
     }
   }