/* =========================================================
   MAP DATA / RESOURCES / ATTACKS
   ========================================================= */

   import { NFT_ADDRESS, resourceNames, rarityNames } from "./config.js";
   import { state } from "./state.js";
   import {
     byId,
     shortenAddress,
     formatTime,
     formatDuration
   } from "./utils.js";
   import { fetchAllWithPagination } from "./subgraph.js";
   import { isTokenActiveOnV5 } from "./migration.js";
   import { mapState, getMapDom } from "./map-state.js";
   import { drawPyramid } from "./map-render.js";
   
   function bnGtZero(value) {
     try {
       return ethers.BigNumber.from(value || 0).gt(0);
     } catch {
       return false;
     }
   }
   
   /* =========================================================
      READ ONLY
      ========================================================= */
   
   export async function initMapReadOnly() {
     mapState.readOnlyProvider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
   
     mapState.nftReadOnlyContract = new ethers.Contract(
       NFT_ADDRESS,
       [
         "function ownerOf(uint256 tokenId) view returns (address)",
         "function calculateRarity(uint256 tokenId) view returns (uint8)"
       ],
       mapState.readOnlyProvider
     );
   }
   
   export function getReadOnlyNFTContract() {
     return mapState.nftReadOnlyContract;
   }
   
   export function getAllMapTokens() {
     return mapState.tokens;
   }
   
   export async function safeGetFarm(tokenId) {
     try {
       if (!state.farmingV6Contract) {
         throw new Error("FarmingV6 contract not initialized");
       }
   
       const f = await state.farmingV6Contract.getFarmState(tokenId);
   
       return {
         ok: true,
         startTime: Number(f.startTime ?? 0),
         lastAccrualTime: Number(f.lastAccrualTime ?? 0),
         lastClaimTime: Number(f.lastClaimTime ?? 0),
         boostExpiry: Number(f.boostExpiry ?? 0),
         stopTime: Number(f.stopTime ?? 0),
         isActive: !!f.isActive
       };
     } catch {
       return {
         ok: false,
         startTime: 0,
         lastAccrualTime: 0,
         lastClaimTime: 0,
         boostExpiry: 0,
         stopTime: 0,
         isActive: false
       };
     }
   }
   
   /* =========================================================
      ATTACK HELPERS
      ========================================================= */
   
   export function normalizeAttackTuple(a) {
     return {
       attacker: a.attacker ?? a[0],
       attackerTokenId: Number(a.attackerTokenId ?? a[1] ?? 0),
       targetTokenId: Number(a.targetTokenId ?? a[2] ?? 0),
       startTime: Number(a.startTime ?? a[3] ?? 0),
       endTime: Number(a.endTime ?? a[4] ?? 0),
       resource: Number(a.resource ?? a[5] ?? 0),
       executed: Boolean(a.executed ?? a[6]),
       cancelled: Boolean(a.cancelled ?? a[7])
     };
   }
   
   export function getAttackStorageKey(targetTokenId) {
     return `attack_${targetTokenId}`;
   }
   
   export function dismissAttackById(attackId) {
     const key = "dismissedAttacks";
     const arr = JSON.parse(localStorage.getItem(key) || "[]");
     if (!arr.includes(attackId)) arr.push(attackId);
     localStorage.setItem(key, JSON.stringify(arr));
   }
   
   export function loadDismissedAttacks() {
     return new Set(JSON.parse(localStorage.getItem("dismissedAttacks") || "[]"));
   }
   
   export function isOwnToken(tokenId) {
     const token = mapState.tokens[String(tokenId)];
     return !!(
       state.userAddress &&
       token &&
       token.owner &&
       token.owner.toLowerCase() === state.userAddress.toLowerCase()
     );
   }
   
   export function isForeignToken(tokenId) {
     const token = mapState.tokens[String(tokenId)];
     return !!(
       state.userAddress &&
       token &&
       token.owner &&
       token.owner.toLowerCase() !== state.userAddress.toLowerCase()
     );
   }
   
   export async function getPreferredAttackerTokenId() {
    if (!state.userAddress) return null;
  
    if (
      mapState.selectedAttackAttackerTokenId &&
      isOwnToken(mapState.selectedAttackAttackerTokenId)
    ) {
      return parseInt(mapState.selectedAttackAttackerTokenId, 10);
    }
  
    if (mapState.selectedTokenId && isOwnToken(mapState.selectedTokenId)) {
      return parseInt(mapState.selectedTokenId, 10);
    }
  
    const ownTokens = Object.entries(mapState.tokens).filter(([_, t]) =>
      t.owner && t.owner.toLowerCase() === state.userAddress.toLowerCase()
    );
  
    if (!ownTokens.length) return null;
  
    mapState.selectedAttackAttackerTokenId = String(ownTokens[0][0]);
    return parseInt(ownTokens[0][0], 10);
  }
   
   export function getProduction(rarity) {
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
   
   /* =========================================================
      SUBGRAPH DATA
      ========================================================= */
   
   export async function loadMapData() {
     try {
       const [
         tokenItems,
         blockRevealedItems,
         farmV5Items,
         farmV6Items,
         protectionItems,
         partnerItems
       ] = await Promise.all([
         fetchAllWithPagination("tokens", "id owner { id } revealed").catch(() => []),
         fetchAllWithPagination("blockRevealeds", "tokenId rarity").catch(() => []),
         fetchAllWithPagination(
           "farmV5S",
           "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
           `{ active: true }`
         ).catch(() => []),
         fetchAllWithPagination(
           "farmV6S",
           "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
           `{ active: true }`
         ).catch(() => []),
         fetchAllWithPagination("protections", "id active expiresAt level", `{ active: true }`).catch(() => []),
         fetchAllWithPagination("partnerships", "id active", `{ active: true }`).catch(() => [])
       ]);
   
       mapState.tokens = {};
   
       tokenItems.forEach((t) => {
         mapState.tokens[String(t.id)] = {
           owner: t.owner ? t.owner.id : null,
           revealed: !!t.revealed,
           farmActive: false,
           farmV5Active: false,
           protectionActive: false,
           protectionLevel: 0,
           protectionExpiry: 0,
           partnerActive: false,
           rarity: null,
           farmStartTime: 0,
           lastClaimTime: 0,
           boostExpiry: 0,
           farmV5StartTime: 0,
           farmV5LastClaimTime: 0
         };
       });
   
       blockRevealedItems.forEach((br) => {
         const tokenId = String(br.tokenId);
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].rarity = parseInt(br.rarity, 10);
         }
       });
   
       farmV5Items.forEach((f) => {
         const tokenId = String(f.id);
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].farmV5Active = !!f.active;
           mapState.tokens[tokenId].farmV5StartTime = parseInt(f.startTime || "0", 10);
           mapState.tokens[tokenId].farmV5LastClaimTime = parseInt(f.lastClaimTime || "0", 10);
         }
       });
   
       farmV6Items.forEach((f) => {
         const tokenId = String(f.id);
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].farmActive = !!f.active;
           mapState.tokens[tokenId].farmStartTime = parseInt(f.startTime || "0", 10);
           mapState.tokens[tokenId].lastClaimTime = parseInt(f.lastClaimTime || "0", 10);
           mapState.tokens[tokenId].boostExpiry = parseInt(f.boostExpiry || "0", 10);
         }
       });
   
       protectionItems.forEach((p) => {
         const tokenId = String(p.id);
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].protectionActive = !!p.active;
           mapState.tokens[tokenId].protectionLevel = parseInt(p.level || "0", 10);
           mapState.tokens[tokenId].protectionExpiry = parseInt(p.expiresAt || "0", 10);
         }
       });
   
       partnerItems.forEach((p) => {
         const tokenId = String(p.id);
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].partnerActive = !!p.active;
         }
       });
   
       if (state.userAddress) {
         const ownTokenIds = Object.entries(mapState.tokens)
           .filter(([_, t]) => t.owner && t.owner.toLowerCase() === state.userAddress.toLowerCase())
           .map(([tokenId]) => tokenId);
   
         const checks = await Promise.all(
           ownTokenIds.map(async (tokenId) => {
             try {
               return { tokenId, active: await isTokenActiveOnV5(tokenId) };
             } catch {
               return { tokenId, active: false };
             }
           })
         );
   
         checks.forEach(({ tokenId, active }) => {
           if (mapState.tokens[tokenId] && active) {
             mapState.tokens[tokenId].farmV5Active = true;
           }
         });
       }
   
       drawPyramid();
     } catch (err) {
       console.error("loadMapData error:", err);
     }
   }
   
   /* =========================================================
      RESOURCES
      ========================================================= */
   
   export async function loadMapUserResources() {
     if (!state.userAddress || !state.resourceTokenContract) return;
   
     try {
       const ids = [...Array(10).keys()];
       const accounts = ids.map(() => state.userAddress);
       const balances = await state.resourceTokenContract.balanceOfBatch(accounts, ids);
   
       mapState.userResources = ids
         .map((id, idx) => ({
           resourceId: id,
           amount: balances[idx]
         }))
         .filter((r) => bnGtZero(r.amount));
   
       updateMapUserResourcesDisplay();
     } catch (err) {
       console.error("loadMapUserResources error:", err);
       mapState.userResources = [];
       updateMapUserResourcesDisplay();
     }
   }
   
   export function updateMapUserResourcesDisplay() {
     const { userResourcesDiv } = getMapDom();
     if (!userResourcesDiv) return;
   
     if (!state.userAddress) {
       userResourcesDiv.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
       return;
     }
   
     if (!mapState.userResources.length) {
       userResourcesDiv.innerHTML = `<p style="color:#98a9b9;">No resources</p>`;
       return;
     }
   
     mapState.userResources.sort((a, b) => a.resourceId - b.resourceId);
   
     let html = "";
     for (const r of mapState.userResources) {
       const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
       const imgUrl = `https://inpinity.online/img/${r.resourceId}.PNG`;
   
       html += `
         <div class="resource-row">
           <img src="${imgUrl}" alt="${name}" class="resource-icon" onerror="this.style.display='none'">
           <span class="resource-name">${name}</span>
           <span class="resource-amount">${r.amount.toString()}</span>
         </div>
       `;
     }
   
     userResourcesDiv.innerHTML = html;
   }
   
   /* =========================================================
      ATTACK RESOURCE SELECT
      ========================================================= */
   
   export function populateAttackResourceSelect(resourceIds = null, selectedValue = null) {
     const select = byId("attackResource");
     if (!select) return;
   
     select.innerHTML = "";
   
     const ids = Array.isArray(resourceIds)
       ? resourceIds
       : resourceNames.map((_, i) => i);
   
     if (!ids.length) {
       const option = document.createElement("option");
       option.value = "";
       option.textContent = "No loot available";
       option.disabled = true;
       option.selected = true;
       select.appendChild(option);
       select.disabled = true;
       return;
     }
   
     select.disabled = false;
   
     ids.forEach((id, idx) => {
       const option = document.createElement("option");
       option.value = String(id);
       option.textContent = resourceNames[id] || `Resource ${id}`;
   
       if (selectedValue !== null && Number(selectedValue) === Number(id)) {
         option.selected = true;
       } else if (selectedValue === null && idx === 0) {
         option.selected = true;
       }
   
       select.appendChild(option);
     });
   }
   
   export async function getAttackableResourceIds(attackerTokenId, targetTokenId) {
     if (!state.piratesV6Contract) return [];
   
     const previews = await Promise.allSettled(
       resourceNames.map((_, i) =>
         state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, i)
       )
     );
   
     const ids = [];
     previews.forEach((res, i) => {
       if (res.status === "fulfilled" && res.value && res.value.allowed) {
         ids.push(i);
       }
     });
   
     return ids;
   }
   
   /* =========================================================
      ATTACKS
      ========================================================= */
   
   export async function loadMapUserAttacks() {
     if (!state.userAddress) return;
   
     try {
       const attacks = await fetchAllWithPagination(
         "attackV6S",
         "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed cancelled protectionLevel effectiveStealPercent stolenAmount",
         `{ attacker: "${state.userAddress.toLowerCase()}" }`
       );
   
       const dismissed = loadDismissedAttacks();
   
       mapState.userAttacks = attacks
         .map((a) => ({
           id: a.id,
           targetTokenId: parseInt(a.targetTokenId, 10),
           attackerTokenId: parseInt(a.attackerTokenId, 10),
           attackIndex: parseInt(a.attackIndex, 10),
           startTime: parseInt(a.startTime, 10),
           endTime: parseInt(a.endTime, 10),
           executed: !!a.executed,
           cancelled: !!a.cancelled,
           resource: parseInt(a.resource, 10),
           protectionLevel: a.protectionLevel ? parseInt(a.protectionLevel, 10) : 0,
           effectiveStealPercent: a.effectiveStealPercent ? parseInt(a.effectiveStealPercent, 10) : 0,
           stolenAmount: a.stolenAmount ? a.stolenAmount.toString() : "0"
         }))
         .filter((a) => !a.executed && !a.cancelled && !dismissed.has(a.id));
   
       displayMapUserAttacks();
       drawPyramid();
       startMapAttacksTicker();
     } catch (e) {
       console.error("loadMapUserAttacks error:", e);
     }
   }
   
   export function displayMapUserAttacks() {
     const { userAttacksList } = getMapDom();
     if (!userAttacksList) return;
   
     if (!state.userAddress) {
       userAttacksList.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
       return;
     }
   
     if (!mapState.userAttacks.length) {
       userAttacksList.innerHTML = `<p style="color:#98a9b9;">No active attacks</p>`;
       return;
     }
   
     const now = Math.floor(Date.now() / 1000);
   
     userAttacksList.innerHTML = mapState.userAttacks.map((attack) => {
       const timeLeft = attack.endTime - now;
       const ready = timeLeft <= 0;
   
       return `
         <div class="attack-item">
           <span>#${attack.targetTokenId} (${resourceNames[attack.resource]})</span>
           <span class="attack-status" data-endtime="${attack.endTime}" style="${ready ? "color:#51cf66;" : ""}">
             ${ready ? "Ready" : "⏳ " + formatTime(timeLeft)}
           </span>
           <div class="attack-actions">
             <button
               class="execute-btn"
               data-attackid="${attack.id}"
               data-targetid="${attack.targetTokenId}"
               data-attackindex="${attack.attackIndex}"
               data-resource="${attack.resource}"
               ${ready ? "" : "disabled"}
             >${ready ? "⚔️" : "⏳"}</button>
             <button
               class="cancel-attack-btn"
               data-targetid="${attack.targetTokenId}"
               data-attackindex="${attack.attackIndex}"
               title="Cancel attack"
             >✖️</button>
           </div>
         </div>
       `;
     }).join("");
   }
   
   export function startMapAttacksTicker() {
     if (mapState.attacksTicker) return;
   
     mapState.attacksTicker = setInterval(() => {
       const now = Math.floor(Date.now() / 1000);
   
       document.querySelectorAll(".attack-status").forEach((el) => {
         const endTime = parseInt(el.dataset.endtime || "0", 10);
         const timeLeft = endTime - now;
   
         if (timeLeft <= 0) {
           el.textContent = "Ready";
           el.style.color = "#51cf66";
         } else {
           el.textContent = "⏳ " + formatTime(timeLeft);
           el.style.color = "";
         }
       });
   
       document.querySelectorAll(".execute-btn").forEach((btn) => {
         const attackRow = btn.closest(".attack-item");
         const statusEl = attackRow?.querySelector(".attack-status");
         const endTime = parseInt(statusEl?.dataset.endtime || "0", 10);
         const timeLeft = endTime - now;
   
         btn.disabled = timeLeft > 0;
         btn.textContent = timeLeft <= 0 ? "⚔️" : "⏳";
       });
   
       drawPyramid();
     }, 1000);
   }
   
   export function stopMapAttacksTicker() {
     if (mapState.attacksTicker) {
       clearInterval(mapState.attacksTicker);
       mapState.attacksTicker = null;
     }
   }
   
   /* =========================================================
      ATTACK PREVIEW
      ========================================================= */
   
   export async function refreshSelectedTargetAttackPreview() {
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
     const { attackInput } = getMapDom();
   
     if (!mapState.selectedTokenId || !state.userAddress || !isForeignToken(mapState.selectedTokenId)) {
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
       const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resourceId);
   
       if (targetStatusEl) {
         if (preview.allowed) {
           targetStatusEl.innerText = "✅ Attack allowed";
         } else if (Number(preview.pendingAmount || 0) === 0) {
           targetStatusEl.innerText = "⚠️ No loot available";
         } else {
           targetStatusEl.innerText = `❌ Blocked (Code ${preview.code})`;
         }
       }
   
       if (travelTimeEl) travelTimeEl.innerText = formatDuration(Number(preview.travelTime || 0));
       if (remainingEl) remainingEl.innerText = String(Number(preview.remainingAttacksToday || 0));
       if (pendingLootEl) pendingLootEl.innerText = (preview.pendingAmount || 0).toString();
       if (stealAmountEl) stealAmountEl.innerText = (preview.stealAmount || 0).toString();
       if (protectionEl) protectionEl.innerText = `${Number(preview.protectionLevel || 0)}%`;
       if (stealPercentEl) stealPercentEl.innerText = `${Number(preview.effectiveStealPercent || 0)}%`;
       if (attackBtn) attackBtn.disabled = !preview.allowed;
     } catch (e) {
       console.warn("previewAttack failed", e);
       if (targetStatusEl) targetStatusEl.innerText = "⚠️ Preview failed";
       if (attackBtn) attackBtn.disabled = true;
     }
   }
   
   /* =========================================================
      TOOLTIP
      ========================================================= */
   
   export function getMapTooltipHtml(foundTokenId) {
     const token = mapState.tokens[foundTokenId];
     let html = `<span>Block #${foundTokenId}</span><br>`;
   
     if (token && token.owner) {
       html += `Owner: ${shortenAddress(token.owner)}<br>`;
       html += `Status: ${token.revealed ? "Revealed" : "Minted"}`;
   
       if (token.farmActive) html += " · Farming V6";
       else if (token.farmV5Active) html += " · Farming V5";
   
       if (token.protectionActive) html += " · Protected";
       if (token.partnerActive) html += " ⭐";
       if (token.rarity !== null) html += ` · ${rarityNames[token.rarity]}`;
   
       const attack = mapState.userAttacks.find((a) => String(a.targetTokenId) === foundTokenId);
       if (attack) {
         const now = Math.floor(Date.now() / 1000);
         html += attack.endTime <= now
           ? " · 🔴 Attack ready!"
           : ` · ⚔️ Attacking (${formatTime(attack.endTime - now)} left)`;
       }
     } else {
       html += "Not minted";
     }
   
     return html;
   }