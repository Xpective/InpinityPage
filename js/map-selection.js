/* =========================================================
   MAP SELECTION / SIDEBAR – V6 + MERCENARY V4
   ========================================================= */

   import { state } from "./state.js";
   import { rarityNames } from "./config.js";
   import {
     byId,
     shortenAddress,
     formatDuration,
     getProduction
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
   import { populateAttackerSelect } from "./map-ui.js";
   
   function readTupleValue(tuple, key, index, fallback = null) {
     if (!tuple) return fallback;
   
     const named = tuple?.[key];
     if (named !== undefined) return named;
   
     const indexed = tuple?.[index];
     if (indexed !== undefined) return indexed;
   
     return fallback;
   }
   
   function getProtectionTierLabel(tier) {
     const t = Number(tier || 0);
     if (t === 1) return "Tier 1 (20%)";
     if (t === 2) return "Tier 2 (30%)";
     if (t === 3) return "Tier 3 (50%)";
     return "None";
   }
   
   function getProtectionFlags(token, now = Math.floor(Date.now() / 1000)) {
     const expiry = Number(token?.protectionExpiry || 0);
     const hasAnyProtectionData =
       !!token?.protectionUser ||
       expiry > 0 ||
       !!token?.protectionActive;
   
     const hasActiveProtection =
       !!token?.protectionActive &&
       expiry > now;
   
     const hasExpiredProtection =
       hasAnyProtectionData &&
       expiry > 0 &&
       expiry <= now;
   
     return {
       hasAnyProtectionData,
       hasActiveProtection,
       hasExpiredProtection,
       expiry
     };
   }
   
   function setButtonState(el, enabled) {
     if (!el) return;
     el.disabled = !enabled;
     el.style.opacity = enabled ? "1" : "0.45";
     el.style.pointerEvents = enabled ? "auto" : "none";
   }
   
   function setDisplay(el, show, displayValue = "block") {
     if (!el) return;
     el.style.display = show ? displayValue : "none";
   }
   
   function hideClosest(id, selector) {
     const el = byId(id);
     if (!el) return;
     const target = el.closest(selector);
     if (target) target.style.display = "none";
   }
   
   function showClosest(id, selector, displayValue = "") {
     const el = byId(id);
     if (!el) return;
     const target = el.closest(selector);
     if (target) target.style.display = displayValue;
   }
   
   function formatMaybeBpsPercent(value) {
     const n = Number(value || 0);
     if (!Number.isFinite(n)) return "0%";
   
     if (n > 100) {
       const pct = n / 100;
       return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
     }
   
     return `${n}%`;
   }
   
   function getMercenaryUnlockedSlots() {
     const unlocked =
       Number(mapState.mercenaryProfile?.slotsUnlocked || 0) ||
       Number(mapState.mercenaryProfile?.unlockedSlots || 0) ||
       1;
   
     return Math.max(1, Math.min(3, unlocked));
   }
   
   function updateSlotOptionsForOwner() {
     const select = byId("protectSlotIndex");
     if (!select) return;
   
     const unlocked = getMercenaryUnlockedSlots();
     const labels = ["Slot 1", "Slot 2 (locked)", "Slot 3 (locked)"];
   
     [...select.options].forEach((opt, idx) => {
       const enabled = idx < unlocked;
       opt.disabled = !enabled;
       opt.textContent = enabled ? `Slot ${idx + 1}` : labels[idx];
     });
   
     if (Number(select.value || "0") >= unlocked) {
       select.value = "0";
     }
   }
   
   function updateBastionTitleLock() {
     const points = Number(mapState.mercenaryProfile?.points || 0);
     const unlocked = points >= 1000;
   
     const unlockState = byId("bastionTitleUnlockState");
     const hint = byId("bastionTitleHint");
     const input = byId("bastionTitleInput");
     const saveBtn = byId("saveBastionTitleBtn");
   
     if (unlockState) {
       unlockState.textContent = unlocked
         ? "Unlocked"
         : "Locked until 1000 Defender Points";
     }
   
     if (hint) {
       hint.innerHTML = unlocked
         ? "You can now save your Bastion / Clan Title."
         : "Locked until you reach 1000 Defender Points.";
     }
   
     if (input) {
       input.disabled = !unlocked;
       input.style.opacity = unlocked ? "1" : "0.55";
     }
   
     if (saveBtn) {
       saveBtn.disabled = !unlocked;
       saveBtn.style.opacity = unlocked ? "1" : "0.45";
       saveBtn.style.pointerEvents = unlocked ? "auto" : "none";
     }
   }
   
   function updateMercenaryProfileDisplay() {
     const rankEl = byId("mercenaryRank");
     const pointsEl = byId("mercenaryPoints");
     const discountEl = byId("mercenaryDiscount");
     const slotsUnlockedEl = byId("mercenarySlotsUnlocked");
     const titleEl = byId("mercenaryTitle");
     const slotsInfoEl = byId("mercenarySlotsInfo");
   
     const profile = mapState.mercenaryProfile || null;
     const slots = Array.isArray(mapState.mercenarySlots) ? mapState.mercenarySlots : [];
     const now = Math.floor(Date.now() / 1000);
   
     if (rankEl) rankEl.textContent = profile?.rankName || "Watchman";
     if (pointsEl) pointsEl.textContent = String(profile?.points || 0);
     if (discountEl) discountEl.textContent = `${Number(profile?.discountBps || 0) / 100}%`;
     if (slotsUnlockedEl) slotsUnlockedEl.textContent = String(getMercenaryUnlockedSlots());
     if (titleEl) titleEl.textContent = profile?.bastionTitle || "—";
   
     if (slotsInfoEl) {
       if (!slots.length) {
         slotsInfoEl.innerHTML = `<div class="resource-item">No active protection slots.</div>`;
       } else {
         slotsInfoEl.innerHTML = slots
           .slice()
           .sort((a, b) => Number(a.slotIndex || 0) - Number(b.slotIndex || 0))
           .map((slot) => {
             const expiry = Number(slot.expiry || 0);
             const active = !!slot.active && expiry > now;
             const tokenId = String(slot.tokenId || "0");
             const protectionPercent = Number(slot.protectionPercent || 0);
   
             return `
               <div class="resource-item">
                 Slot ${Number(slot.slotIndex || 0) + 1}:
                 ${
                   active
                     ? ` #${tokenId} · ${protectionPercent}% · ${formatDuration(expiry - now)}`
                     : " inactive"
                 }
               </div>
             `;
           })
           .join("");
       }
     }
   
     updateSlotOptionsForOwner();
     updateBastionTitleLock();
   }
   
   function setProtectionInfoText(token, now) {
     const protectionStatusText = byId("protectionStatusText");
     const protectionExpiry = byId("protectionExpiry");
   
     const { hasActiveProtection, hasExpiredProtection } = getProtectionFlags(token, now);
   
     if (protectionStatusText) {
       if (hasActiveProtection) {
         protectionStatusText.textContent = `${Number(token?.protectionLevel || 0)}% active`;
       } else if (hasExpiredProtection) {
         protectionStatusText.textContent = "Expired";
       } else {
         protectionStatusText.textContent = "Inactive";
       }
     }
   
     if (protectionExpiry) {
       if (hasActiveProtection) {
         protectionExpiry.textContent = formatDuration(Number(token?.protectionExpiry || 0) - now);
       } else if (hasExpiredProtection) {
         protectionExpiry.textContent = "Expired";
       } else {
         protectionExpiry.textContent = "—";
       }
     }
   }
   
   function configureMercenaryForOwnerMode({ cleanupAllowed = false } = {}) {
     const mercenaryPanel = byId("mercenaryPanel");
     setDisplay(mercenaryPanel, true, "block");
   
     showClosest("protectTokenId", ".detail-row");
     showClosest("protectSlotIndex", ".detail-row");
     showClosest("protectDays", ".detail-row");
     showClosest("mercenaryPaymentMode", ".detail-row");
     showClosest("protectSlotInfo", ".detail-row");
     showClosest("protectDaysInfo", ".detail-row");
     showClosest("mercenaryCostInfo", ".detail-row");
     showClosest("protectionStatusText", ".detail-row");
     showClosest("protectionExpiry", ".detail-row");
   
     setDisplay(byId("protectBtn"), true, "block");
     setDisplay(byId("extendProtectionBtn"), true, "block");
     setDisplay(byId("cancelProtectionBtn"), true, "block");
     setDisplay(byId("moveProtectionBtn"), true, "block");
     setDisplay(byId("emergencyMoveProtectionBtn"), true, "block");
     setDisplay(byId("unlockSlot2Btn"), true, "block");
     setDisplay(byId("unlockSlot3Btn"), true, "block");
     setDisplay(byId("cleanupProtectionBtn"), !!cleanupAllowed, "block");
   
     setButtonState(byId("protectBtn"), true);
     setButtonState(byId("extendProtectionBtn"), true);
     setButtonState(byId("cancelProtectionBtn"), true);
     setButtonState(byId("moveProtectionBtn"), true);
     setButtonState(byId("emergencyMoveProtectionBtn"), true);
     setButtonState(byId("unlockSlot2Btn"), true);
     setButtonState(byId("unlockSlot3Btn"), true);
     setButtonState(byId("cleanupProtectionBtn"), !!cleanupAllowed);
   
     const bastionCard = byId("bastionTitleInput")?.closest(".detail-card");
     if (bastionCard) bastionCard.style.display = "block";
   
     updateMercenaryProfileDisplay();
   }
   
   function configureMercenaryForForeignMode({ showPanel = false, cleanupAllowed = false } = {}) {
     const mercenaryPanel = byId("mercenaryPanel");
     setDisplay(mercenaryPanel, !!showPanel, "block");
   
     if (!showPanel) return;
   
     hideClosest("protectTokenId", ".detail-row");
     hideClosest("protectSlotIndex", ".detail-row");
     hideClosest("protectDays", ".detail-row");
     hideClosest("mercenaryPaymentMode", ".detail-row");
     hideClosest("protectSlotInfo", ".detail-row");
     hideClosest("protectDaysInfo", ".detail-row");
     hideClosest("mercenaryCostInfo", ".detail-row");
   
     showClosest("protectionStatusText", ".detail-row");
     showClosest("protectionExpiry", ".detail-row");
   
     setDisplay(byId("protectBtn"), false);
     setDisplay(byId("extendProtectionBtn"), false);
     setDisplay(byId("cancelProtectionBtn"), false);
     setDisplay(byId("moveProtectionBtn"), false);
     setDisplay(byId("emergencyMoveProtectionBtn"), false);
     setDisplay(byId("unlockSlot2Btn"), false);
     setDisplay(byId("unlockSlot3Btn"), false);
   
     setDisplay(byId("cleanupProtectionBtn"), !!cleanupAllowed, "block");
     setButtonState(byId("cleanupProtectionBtn"), !!cleanupAllowed);
   
     const bastionCard = byId("bastionTitleInput")?.closest(".detail-card");
     if (bastionCard) bastionCard.style.display = "none";
   }
   
   function clearAttackPreviewFields(statusText = "—") {
     const attackerBlockEl = byId("attackAttackerBlock");
     const targetStatusEl = byId("attackTargetStatus");
     const travelTimeEl = byId("attackTravelTime");
     const remainingEl = byId("attackRemainingToday");
     const pendingLootEl = byId("attackPendingLoot");
     const stealAmountEl = byId("attackStealAmount");
     const protectionEl = byId("attackProtection");
     const stealPercentEl = byId("attackStealPercent");
     const attackBtn = byId("attackBtn");
   
     if (attackerBlockEl) attackerBlockEl.innerText = "—";
     if (targetStatusEl) targetStatusEl.innerText = statusText;
     if (travelTimeEl) travelTimeEl.innerText = "—";
     if (remainingEl) remainingEl.innerText = "—";
     if (pendingLootEl) pendingLootEl.innerText = "—";
     if (stealAmountEl) stealAmountEl.innerText = "—";
     if (protectionEl) protectionEl.innerText = "—";
     if (stealPercentEl) stealPercentEl.innerText = "—";
   
     populateAttackResourceSelect([]);
     setButtonState(attackBtn, false);
   }
   
   export function clearActionArea() {
     const ownerActionsDiv = byId("ownerActions");
     const publicActionsDiv = byId("publicActions");
     const attackInput = byId("attackInput");
     const actionMessage = byId("actionMessage");
     const pirateBoostInput = byId("pirateBoostInput");
     const boostCenter = byId("boostCenter");
     const boostOptions = byId("boostOptions");
     const buyBoostBtn = byId("buyBoostBtn");
     const mercenaryPanel = byId("mercenaryPanel");
   
     if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
     if (publicActionsDiv) {
       publicActionsDiv.innerHTML = "";
       publicActionsDiv.style.display = "none";
     }
   
     setDisplay(attackInput, false);
     setDisplay(pirateBoostInput, false);
     setDisplay(boostOptions, false);
     setDisplay(buyBoostBtn, false);
     setDisplay(boostCenter, false);
     setDisplay(mercenaryPanel, false);
   
     if (actionMessage) actionMessage.innerHTML = "";
   }
   
   export async function refreshSelectedTargetAttackPreview() {
     const tokens = getAllMapTokens();
     const attackInput = byId("attackInput");
     const attackBtn = byId("attackBtn");
     const attackResourceEl = byId("attackResource");
   
     const pirateBoostInput = byId("pirateBoostInput");
     const pirateBoostStatusEl = byId("pirateBoostStatus");
     const pirateBoostExpiryEl = byId("pirateBoostExpiry");
     const pirateBoostOptions = byId("pirateBoostOptions");
     const buyPirateBoostBtn = byId("buyPirateBoostBtn");
     const attackerBlockEl = byId("attackAttackerBlock");
   
     const token = tokens[mapState.selectedTokenId];
   
     if (
       !mapState.selectedTokenId ||
       !state.userAddress ||
       !token?.owner ||
       token.owner.toLowerCase() === state.userAddress.toLowerCase()
     ) {
       setDisplay(attackInput, false);
       setDisplay(pirateBoostInput, false);
       clearAttackPreviewFields("—");
       return;
     }
   
     if (!state.piratesV6Contract) {
       setDisplay(attackInput, true, "flex");
       setDisplay(pirateBoostInput, false);
       clearAttackPreviewFields("⚠️ Pirates unavailable");
       return;
     }
   
     setDisplay(attackInput, true, "flex");
   
     populateAttackerSelect();
     const attackerTokenId = await getPreferredAttackerTokenId();
   
     if (!attackerTokenId) {
       clearAttackPreviewFields("❌ No attacker block");
       setDisplay(pirateBoostInput, false);
       return;
     }
   
     if (attackerBlockEl) attackerBlockEl.innerText = `#${attackerTokenId}`;
   
     try {
       const hasBoostRaw = await state.piratesV6Contract.hasPirateBoost(attackerTokenId);
       const expiryRaw = await state.piratesV6Contract.getPirateBoostExpiry(attackerTokenId);
       const hasBoost = !!hasBoostRaw;
       const expiryNum = Number(expiryRaw || 0);
       const now = Math.floor(Date.now() / 1000);
   
       setDisplay(pirateBoostInput, true, "block");
       setDisplay(pirateBoostOptions, true, "flex");
       setDisplay(buyPirateBoostBtn, true, "block");
       setButtonState(buyPirateBoostBtn, true);
   
       if (pirateBoostStatusEl) {
         pirateBoostStatusEl.innerText = hasBoost && expiryNum > now ? "✅ Active" : "❌ Inactive";
       }
   
       if (pirateBoostExpiryEl) {
         pirateBoostExpiryEl.innerText =
           expiryNum > now
             ? `${formatDuration(expiryNum - now)} left`
             : "Expired";
       }
     } catch {
       setDisplay(pirateBoostInput, true, "block");
       setDisplay(pirateBoostOptions, true, "flex");
       setDisplay(buyPirateBoostBtn, true, "block");
       setButtonState(buyPirateBoostBtn, true);
   
       if (pirateBoostStatusEl) pirateBoostStatusEl.innerText = "⚠️ Unknown";
       if (pirateBoostExpiryEl) pirateBoostExpiryEl.innerText = "—";
     }
   
     const targetTokenIdNum = parseInt(mapState.selectedTokenId, 10);
     let lootableIds = [];
   
     try {
       lootableIds = await getAttackableResourceIds(attackerTokenId, targetTokenIdNum);
     } catch {
       clearAttackPreviewFields("⚠️ Loot check failed");
       return;
     }
   
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
       clearAttackPreviewFields("⚠️ No loot available");
       const pendingLootEl = byId("attackPendingLoot");
       if (pendingLootEl) pendingLootEl.innerText = "0";
       return;
     }
   
     const resourceId = parseInt(byId("attackResource")?.value || "0", 10);
     if (!Number.isFinite(resourceId) || resourceId < 0) {
       clearAttackPreviewFields("⚠️ Invalid resource");
       return;
     }
   
     const targetStatusEl = byId("attackTargetStatus");
     const travelTimeEl = byId("attackTravelTime");
     const remainingEl = byId("attackRemainingToday");
     const pendingLootEl = byId("attackPendingLoot");
     const stealAmountEl = byId("attackStealAmount");
     const protectionEl = byId("attackProtection");
     const stealPercentEl = byId("attackStealPercent");
   
     try {
       const preview = await state.piratesV6Contract.previewAttack(
         attackerTokenId,
         targetTokenIdNum,
         resourceId
       );
   
       const code = Number(readTupleValue(preview, "code", 0, 0));
       const allowed = !!readTupleValue(preview, "allowed", 1, false);
       const pendingAmount = readTupleValue(preview, "pendingAmount", 2, 0);
       const stealAmount = readTupleValue(preview, "stealAmount", 3, 0);
       const travelTime = Number(readTupleValue(preview, "travelTime", 4, 0));
       const remainingAttacksToday = Number(readTupleValue(preview, "remainingAttacksToday", 5, 0));
       const protectionLevel = Number(readTupleValue(preview, "protectionLevel", 6, 0));
       const effectiveStealPercent = readTupleValue(preview, "effectiveStealPercent", 7, 0);
   
       if (targetStatusEl) {
         if (allowed) {
           targetStatusEl.innerText = "✅ Attack allowed";
         } else if (Number(pendingAmount || 0) === 0) {
           targetStatusEl.innerText = "⚠️ No loot available";
         } else {
           targetStatusEl.innerText = `❌ Blocked (Code ${code})`;
         }
       }
   
       if (travelTimeEl) {
         travelTimeEl.innerText = formatDuration(travelTime);
       }
       if (remainingEl) {
         remainingEl.innerText = String(remainingAttacksToday);
       }
       if (pendingLootEl) {
         pendingLootEl.innerText = pendingAmount?.toString ? pendingAmount.toString() : String(pendingAmount || 0);
       }
       if (stealAmountEl) {
         stealAmountEl.innerText = stealAmount?.toString ? stealAmount.toString() : String(stealAmount || 0);
       }
       if (protectionEl) {
         protectionEl.innerText = `${protectionLevel}%`;
       }
       if (stealPercentEl) {
         stealPercentEl.innerText = formatMaybeBpsPercent(effectiveStealPercent || 0);
       }
   
       setButtonState(attackBtn, allowed);
     } catch {
       clearAttackPreviewFields("⚠️ Preview failed");
     }
   }
   
   export async function updateSidebar(tokenId) {
     const tokens = getAllMapTokens();
     const nftReadOnlyContract = getReadOnlyNFTContract();
   
     const blockDetailDiv = byId("blockDetail");
     const actionPanel = byId("actionPanel");
     const ownerActionsDiv = byId("ownerActions");
     const publicActionsDiv = byId("publicActions");
     const boostCenter = byId("boostCenter");
     const boostOptions = byId("boostOptions");
     const buyBoostBtn = byId("buyBoostBtn");
     const farmBoostStatusEl = byId("farmBoostStatus");
     const pirateBoostInput = byId("pirateBoostInput");
     const protectTokenId = byId("protectTokenId");
   
     mapState.selectedTokenId = String(tokenId);
     const token = tokens[mapState.selectedTokenId];
     const owner = token ? token.owner : null;
     mapState.selectedTokenOwner = owner;
   
     if (
       state.userAddress &&
       owner &&
       owner.toLowerCase() === state.userAddress.toLowerCase()
     ) {
       mapState.selectedAttackAttackerTokenId = String(tokenId);
     }
   
     if (protectTokenId) {
       protectTokenId.value = String(mapState.selectedTokenId || "");
     }
   
     const now = Math.floor(Date.now() / 1000);
     const {
       hasActiveProtection,
       hasExpiredProtection
     } = getProtectionFlags(token, now);
   
     let v5Active = !!token?.farmV5Active;
     let v6Active = false;
   
     let farmVersionTxt = "-";
     let farmAgeTxt = "-";
     let claimTxt = "-";
     let pendingTotalTxt = "-";
     let boostTxt = "inactive";
     let protectionTxt = "inactive";
     let protectionLevelTxt = "0%";
     let protectionTierTxt = "None";
     let protectionSlotTxt = "-";
     let protectionOwnerTxt = "-";
   
     if (hasActiveProtection) {
       protectionTxt = `active for ${formatDuration(Number(token?.protectionExpiry || 0) - now)}`;
       protectionLevelTxt = `${Number(token?.protectionLevel || 0)}%`;
       protectionTierTxt = getProtectionTierLabel(token?.protectionTier);
       protectionSlotTxt = `${Number(token?.protectionSlotIndex || 0) + 1}`;
       protectionOwnerTxt = token?.protectionUser
         ? shortenAddress(token.protectionUser)
         : (owner ? shortenAddress(owner) : "-");
     } else if (hasExpiredProtection) {
       protectionTxt = "expired";
       protectionLevelTxt = `${Number(token?.protectionLevel || 0)}%`;
       protectionTierTxt = getProtectionTierLabel(token?.protectionTier);
       protectionSlotTxt = `${Number(token?.protectionSlotIndex || 0) + 1}`;
       protectionOwnerTxt = token?.protectionUser
         ? shortenAddress(token.protectionUser)
         : (owner ? shortenAddress(owner) : "-");
     }
   
     if (v5Active) {
       farmVersionTxt = "V5 Legacy";
   
       if (Number(token?.farmV5StartTime || 0) > 0) {
         farmAgeTxt = formatDuration(now - Number(token?.farmV5StartTime || 0));
       }
   
       claimTxt = "Claim or migrate";
       pendingTotalTxt = "legacy";
     }
   
     if (state.farmingV6Contract && token?.owner) {
       const farmInfo = await safeGetFarm(mapState.selectedTokenId);
       v6Active = !!(farmInfo?.ok && farmInfo?.isActive);
   
       if (v6Active) {
         farmVersionTxt = "V6 Active";
   
         if (Number(farmInfo?.startTime || 0) > 0) {
           farmAgeTxt = formatDuration(now - Number(farmInfo.startTime || 0));
         }
   
         try {
           const preview = await state.farmingV6Contract.previewClaim(mapState.selectedTokenId);
           const allowed = !!readTupleValue(preview, "allowed", 1, false);
           const pendingAmount = readTupleValue(preview, "pendingAmount", 2, 0);
           const secondsRemaining = Number(readTupleValue(preview, "secondsRemaining", 3, 0));
   
           pendingTotalTxt = pendingAmount?.toString ? pendingAmount.toString() : String(pendingAmount || 0);
           claimTxt = allowed
             ? "READY"
             : (
                 secondsRemaining > 0
                   ? `in ${formatDuration(secondsRemaining)}`
                   : "Not ready"
               );
         } catch {
           // render anyway
         }
   
         if (farmInfo?.boostExpiry && Number(farmInfo.boostExpiry) > now) {
           boostTxt = `${formatDuration(Number(farmInfo.boostExpiry) - now)} left`;
         }
       }
     }
   
     if (!v5Active && !v6Active) {
       farmVersionTxt = "Inactive";
     }
   
     let productionHtml = "";
     let rarityDisplay = "";
   
     if (token?.owner && token?.revealed && nftReadOnlyContract) {
       try {
         const tokenIdNum = parseInt(mapState.selectedTokenId, 10);
         const rarity = token.rarity !== null && token.rarity !== undefined
           ? token.rarity
           : await nftReadOnlyContract.calculateRarity(tokenIdNum);
   
         const r = Number(rarity);
   
         rarityDisplay = `
           <div class="detail-row">
             <span class="detail-label">Rarity</span>
             <span class="detail-value ${MAP_CONST.rarityClass[r] || ""}">
               ${rarityNames[r] || "Unknown"}
             </span>
           </div>
         `;
   
         const production = getProduction(r, 0);
         productionHtml = `<div class="detail-row"><span class="detail-label">Production</span></div>`;
   
         for (const [res, amount] of Object.entries(production)) {
           productionHtml += `
             <div class="detail-row">
               <span class="detail-label">${res}</span>
               <span class="detail-value">${amount}/d</span>
             </div>
           `;
         }
       } catch {
         // ignore rarity problems
       }
     }
   
     if (blockDetailDiv) {
       if (token?.owner) {
         blockDetailDiv.innerHTML = `
           <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${mapState.selectedTokenId}</span></div>
           <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value">${shortenAddress(owner)}</span></div>
           <div class="detail-row"><span class="detail-label">Revealed</span><span class="detail-value">${token.revealed ? "✅" : "❌"}</span></div>
           ${rarityDisplay}
           <div class="detail-row"><span class="detail-label">Farming</span><span class="detail-value">${farmVersionTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Farm age</span><span class="detail-value">${farmAgeTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Farm boost</span><span class="detail-value">${boostTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Protection</span><span class="detail-value">${protectionTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Protection level</span><span class="detail-value">${protectionLevelTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Protection tier</span><span class="detail-value">${protectionTierTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Protection slot</span><span class="detail-value">${protectionSlotTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Protector</span><span class="detail-value">${protectionOwnerTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Claim-ready</span><span class="detail-value">${claimTxt}</span></div>
           <div class="detail-row"><span class="detail-label">Pending</span><span class="detail-value">${pendingTotalTxt}</span></div>
           ${productionHtml}
         `;
       } else {
         blockDetailDiv.innerHTML = `<p style="color:#98a9b9;">Block #${mapState.selectedTokenId} not minted</p>`;
       }
     }
   
     if (actionPanel) {
       actionPanel.style.display = token?.owner ? "block" : "none";
     }
   
     clearActionArea();
     populateAttackerSelect();
     updateMercenaryProfileDisplay();
     setProtectionInfoText(token, now);
   
     if (farmBoostStatusEl) {
       farmBoostStatusEl.innerText = v6Active
         ? (boostTxt !== "inactive" ? `✅ ${boostTxt}` : "❌ Inactive")
         : "—";
     }
   
     const isOwner =
       !!state.userAddress &&
       !!owner &&
       owner.toLowerCase() === state.userAddress.toLowerCase();
   
     if (!isOwner && token?.owner) {
       if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
   
       if (publicActionsDiv) {
         publicActionsDiv.innerHTML = "";
         publicActionsDiv.style.display = "none";
       }
   
       configureMercenaryForForeignMode({
         showPanel: hasActiveProtection || hasExpiredProtection,
         cleanupAllowed: hasExpiredProtection
       });
   
       if (boostCenter) boostCenter.style.display = "block";
       if (boostOptions) boostOptions.style.display = "none";
       if (buyBoostBtn) buyBoostBtn.style.display = "none";
       if (pirateBoostInput) pirateBoostInput.style.display = "block";
   
       await refreshSelectedTargetAttackPreview();
       return;
     }
   
     if (isOwner) {
       configureMercenaryForOwnerMode({
         cleanupAllowed: hasExpiredProtection
       });
   
       if (publicActionsDiv) {
         publicActionsDiv.innerHTML = "";
         publicActionsDiv.style.display = "none";
       }
   
       let btns = "";
   
       if (!token?.revealed) {
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
       }
   
       if (ownerActionsDiv) {
         ownerActionsDiv.innerHTML = btns;
       }
   
       if (boostCenter) {
         boostCenter.style.display = "block";
       }
   
       if (boostOptions) {
         boostOptions.style.display = v6Active ? "flex" : "none";
       }
   
       if (buyBoostBtn) {
         buyBoostBtn.style.display = v6Active ? "block" : "none";
         setButtonState(buyBoostBtn, v6Active);
       }
   
       if (pirateBoostInput) {
         pirateBoostInput.style.display = "none";
       }
   
       return;
     }
   
     if (boostOptions) boostOptions.style.display = "none";
     if (buyBoostBtn) buyBoostBtn.style.display = "none";
     if (pirateBoostInput) pirateBoostInput.style.display = "none";
   }
   