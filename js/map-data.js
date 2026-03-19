/* =========================================================
   MAP DATA / RESOURCES / ATTACKS – V6 + MERCENARY V4
   HARDENED VERSION
   - read-only init guarded
   - short local TTL caches
   - reduced subgraph burst
   - throttled V5 activity checks
   - safer redraw behavior
   ========================================================= */

   import { NFT_ADDRESS, resourceNames, rarityNames } from "./config.js";
   import { state } from "./state.js";
   import {
     shortenAddress,
     formatTime,
     getProduction as sharedGetProduction
   } from "./utils.js";
   import { fetchAllWithPagination } from "./subgraph.js";
   import { isTokenActiveOnV5 } from "./migration.js";
   import { mapState, getMapDom } from "./map-state.js";
   import { drawPyramid } from "./map-render.js";
   
   /* =========================================================
      LOCAL TTL SETTINGS
      ========================================================= */
   
   const MAP_DATA_TTL_MS = 12_000;
   const MAP_RESOURCES_TTL_MS = 15_000;
   const MAP_ATTACKS_TTL_MS = 10_000;
   const V5_ACTIVITY_TTL_MS = 60_000;
   const V5_CHECK_MAX_PER_PASS = 12;
   const V5_CHECK_GAP_MS = 120;
   
   /* =========================================================
      HELPERS
      ========================================================= */
   
   function bnGtZero(value) {
     try {
       return ethers.BigNumber.from(value || 0).gt(0);
     } catch {
       return false;
     }
   }
   
   function nowMs() {
     return Date.now();
   }
   
   function sleep(ms) {
     return new Promise((resolve) => setTimeout(resolve, ms));
   }
   
   function ensureMapCaches() {
     if (!mapState.v5ActivityCache) mapState.v5ActivityCache = new Map();
     if (!mapState.cachedFarmV6Map) mapState.cachedFarmV6Map = new Map();
     if (!mapState.cachedProtectionMap) mapState.cachedProtectionMap = new Map();
     if (!mapState.mercenaryProtectionByToken) mapState.mercenaryProtectionByToken = new Map();
   
     if (typeof mapState.lastMapDataLoadAt !== "number") mapState.lastMapDataLoadAt = 0;
     if (typeof mapState.lastUserResourcesLoadAt !== "number") mapState.lastUserResourcesLoadAt = 0;
     if (typeof mapState.lastUserAttacksLoadAt !== "number") mapState.lastUserAttacksLoadAt = 0;
   }
   
   function safeParseInt(value, fallback = 0) {
     const n = parseInt(value ?? fallback, 10);
     return Number.isFinite(n) ? n : fallback;
   }
   
   function shouldSkipByTtl(lastAt, ttlMs, forceFresh = false) {
     if (forceFresh) return false;
     return !!lastAt && nowMs() - lastAt < ttlMs;
   }
   
   function getTokenOwnerLower(token) {
     return String(token?.owner || "").toLowerCase();
   }
   
   function isConnectedOwner(owner) {
     return !!(
       state.userAddress &&
       owner &&
       owner.toLowerCase() === state.userAddress.toLowerCase()
     );
   }
   
   /* =========================================================
      READ ONLY
      ========================================================= */
   
   export async function initMapReadOnly() {
     if (mapState.readOnlyProvider && mapState.nftReadOnlyContract) {
       return;
     }
   
     mapState.readOnlyProvider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
   
     mapState.nftReadOnlyContract = new ethers.Contract(
       NFT_ADDRESS,
       [
         "function ownerOf(uint256 tokenId) view returns (address)",
         "function calculateRarity(uint256 tokenId) view returns (uint8)",
         "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)"
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
   
   export function getProduction(rarity, row = 0) {
     return sharedGetProduction(rarity, row);
   }
   
   /* =========================================================
      INTERNAL TOKEN BUILDERS
      ========================================================= */
   
   function createBaseTokenRecord(t) {
     return {
       owner: t.owner ? t.owner.id : null,
       revealed: !!t.revealed,
   
       farmActive: false,
       farmV6Active: false,
       farmV5Active: false,
   
       protectionActive: false,
       protectionLevel: 0,
       protectionTier: 0,
       protectionExpiry: 0,
       protectionSlotIndex: 0,
       protectionUser: null,
   
       partnerActive: false,
       rarity: null,
   
       farmStartTime: 0,
       lastClaimTime: 0,
       boostExpiry: 0,
   
       farmV5StartTime: 0,
       farmV5LastClaimTime: 0
     };
   }
   
   function applyRevealData(blockRevealedItems) {
     for (const br of blockRevealedItems || []) {
       const tokenId = String(br.tokenId);
       if (mapState.tokens[tokenId]) {
         mapState.tokens[tokenId].rarity = safeParseInt(br.rarity, null);
       }
     }
   }
   
   function applyFarmV5Data(farmV5Items) {
     for (const f of farmV5Items || []) {
       const tokenId = String(f.id);
       if (!mapState.tokens[tokenId]) continue;
   
       mapState.tokens[tokenId].farmV5Active = !!f.active;
       mapState.tokens[tokenId].farmV5StartTime = safeParseInt(f.startTime, 0);
       mapState.tokens[tokenId].farmV5LastClaimTime = safeParseInt(f.lastClaimTime, 0);
     }
   }
   
   function applyFarmV6Data(farmV6Items) {
     mapState.cachedFarmV6Map = new Map();
   
     for (const f of farmV6Items || []) {
       const tokenId = String(f.id);
       const farmEntry = {
         tokenId,
         owner: String(f.owner || "").toLowerCase(),
         startTime: safeParseInt(f.startTime, 0),
         lastAccrualTime: safeParseInt(f.lastAccrualTime, 0),
         lastClaimTime: safeParseInt(f.lastClaimTime, 0),
         boostExpiry: safeParseInt(f.boostExpiry, 0),
         stopTime: safeParseInt(f.stopTime, 0),
         active: !!f.active,
         updatedAt: safeParseInt(f.updatedAt, 0),
         blockNumber: safeParseInt(f.blockNumber, 0)
       };
   
       mapState.cachedFarmV6Map.set(tokenId, farmEntry);
   
       if (!mapState.tokens[tokenId]) continue;
   
       mapState.tokens[tokenId].farmActive = !!f.active;
       mapState.tokens[tokenId].farmV6Active = !!f.active;
       mapState.tokens[tokenId].farmStartTime = farmEntry.startTime;
       mapState.tokens[tokenId].lastClaimTime = farmEntry.lastClaimTime;
       mapState.tokens[tokenId].boostExpiry = farmEntry.boostExpiry;
     }
   }
   
   function applyProtectionData(mercenaryProtectionItems) {
     mapState.cachedProtectionMap = new Map();
     mapState.mercenaryProtectionByToken = new Map();
   
     for (const p of mercenaryProtectionItems || []) {
       const tokenId = String(p.tokenId || p.id);
       const protectionEntry = {
         tokenId,
         user: String(p.user || "").toLowerCase(),
         slotIndex: safeParseInt(p.slotIndex, 0),
         tier: safeParseInt(p.protectionTier, 0),
         level: safeParseInt(p.protectionPercent, 0),
         expiresAt: safeParseInt(p.expiry, 0),
         active: !!p.active
       };
   
       mapState.cachedProtectionMap.set(tokenId, protectionEntry);
       mapState.mercenaryProtectionByToken.set(tokenId, protectionEntry);
   
       if (!mapState.tokens[tokenId]) continue;
   
       mapState.tokens[tokenId].protectionActive = !!p.active;
       mapState.tokens[tokenId].protectionLevel = protectionEntry.level;
       mapState.tokens[tokenId].protectionTier = protectionEntry.tier;
       mapState.tokens[tokenId].protectionExpiry = protectionEntry.expiresAt;
       mapState.tokens[tokenId].protectionSlotIndex = protectionEntry.slotIndex;
       mapState.tokens[tokenId].protectionUser = protectionEntry.user;
     }
   }
   
   function applyPartnershipData(partnerItems) {
     for (const p of partnerItems || []) {
       const tokenId = String(p.id);
       if (mapState.tokens[tokenId]) {
         mapState.tokens[tokenId].partnerActive = !!p.active;
       }
     }
   }
   
   /* =========================================================
      V5 ACTIVITY CACHE / THROTTLED CHECKS
      ========================================================= */
   
   function getCachedV5Activity(tokenId) {
     ensureMapCaches();
     const entry = mapState.v5ActivityCache.get(String(tokenId));
     if (!entry) return null;
     if (entry.expiresAt <= nowMs()) {
       mapState.v5ActivityCache.delete(String(tokenId));
       return null;
     }
     return !!entry.active;
   }
   
   function setCachedV5Activity(tokenId, active) {
     ensureMapCaches();
     mapState.v5ActivityCache.set(String(tokenId), {
       active: !!active,
       expiresAt: nowMs() + V5_ACTIVITY_TTL_MS
     });
   }
   
   async function refreshOwnV5ActivityHints() {
     if (!state.userAddress) return;
   
     const ownTokenIds = Object.entries(mapState.tokens)
       .filter(([_, t]) => isConnectedOwner(t.owner))
       .map(([tokenId]) => String(tokenId));
   
     if (!ownTokenIds.length) return;
   
     let checked = 0;
   
     for (const tokenId of ownTokenIds) {
       if (checked >= V5_CHECK_MAX_PER_PASS) break;
   
       const cached = getCachedV5Activity(tokenId);
       if (cached !== null) {
         if (mapState.tokens[tokenId]) {
           mapState.tokens[tokenId].farmV5Active = !!cached || !!mapState.tokens[tokenId].farmV5Active;
         }
         continue;
       }
   
       try {
         const active = await isTokenActiveOnV5(tokenId);
         setCachedV5Activity(tokenId, active);
   
         if (mapState.tokens[tokenId] && active) {
           mapState.tokens[tokenId].farmV5Active = true;
         }
       } catch {
         setCachedV5Activity(tokenId, false);
       }
   
       checked += 1;
       await sleep(V5_CHECK_GAP_MS);
     }
   }
   
   /* =========================================================
      SUBGRAPH DATA
      ========================================================= */
   
   export async function loadMapData(options = {}) {
     ensureMapCaches();
   
     const forceFresh = !!options.forceFresh;
   
     if (shouldSkipByTtl(mapState.lastMapDataLoadAt, MAP_DATA_TTL_MS, forceFresh)) {
       return;
     }
   
     try {
       /* first lightweight base */
       const tokenItems = await fetchAllWithPagination(
         "tokens",
         "id owner { id } revealed",
         "",
         {
           cacheTtlMs: 15_000,
           forceFresh
         }
       ).catch(() => []);
   
       const blockRevealedItems = await fetchAllWithPagination(
         "blockRevealeds",
         "tokenId rarity",
         "",
         {
           cacheTtlMs: 20_000,
           forceFresh
         }
       ).catch(() => []);
   
       /* then active system overlays */
       const farmV6Items = await fetchAllWithPagination(
         "farmV6S",
         "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
         `{ active: true }`,
         {
           cacheTtlMs: 10_000,
           forceFresh
         }
       ).catch(() => []);
   
       const farmV5Items = await fetchAllWithPagination(
         "farmV5S",
         "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
         `{ active: true }`,
         {
           cacheTtlMs: 15_000,
           forceFresh
         }
       ).catch(() => []);
   
       const mercenaryProtectionItems = await fetchAllWithPagination(
         "mercenaryTokenProtectionV4S",
         `
           id
           tokenId
           user
           slotIndex
           protectionTier
           protectionPercent
           expiry
           active
           updatedAt
           blockNumber
         `,
         `{ active: true }`,
         {
           cacheTtlMs: 20_000,
           forceFresh
         }
       ).catch(() => []);
   
       const partnerItems = await fetchAllWithPagination(
         "partnerships",
         "id active",
         `{ active: true }`,
         {
           cacheTtlMs: 30_000,
           forceFresh
         }
       ).catch(() => []);
   
       mapState.tokens = {};
       mapState.cachedFarmsV6 = farmV6Items || [];
       mapState.cachedProtections = mercenaryProtectionItems || [];
   
       for (const t of tokenItems || []) {
         mapState.tokens[String(t.id)] = createBaseTokenRecord(t);
       }
   
       applyRevealData(blockRevealedItems || []);
       applyFarmV5Data(farmV5Items || []);
       applyFarmV6Data(farmV6Items || []);
       applyProtectionData(mercenaryProtectionItems || []);
       applyPartnershipData(partnerItems || []);
   
       if (state.userAddress) {
         await refreshOwnV5ActivityHints();
       }
   
       mapState.lastMapDataLoadAt = nowMs();
       drawPyramid();
     } catch (err) {
       console.error("loadMapData error:", err);
     }
   }
   
   /* =========================================================
      RESOURCES
      ========================================================= */
   
   export async function loadMapUserResources(options = {}) {
     ensureMapCaches();
   
     const forceFresh = !!options.forceFresh;
   
     if (!state.userAddress || !state.resourceTokenContract) return;
     if (shouldSkipByTtl(mapState.lastUserResourcesLoadAt, MAP_RESOURCES_TTL_MS, forceFresh)) {
       updateMapUserResourcesDisplay();
       return;
     }
   
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
   
       mapState.lastUserResourcesLoadAt = nowMs();
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
     const select = document.getElementById("attackResource");
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
   
   export async function loadMapUserAttacks(options = {}) {
     ensureMapCaches();
   
     const forceFresh = !!options.forceFresh;
   
     if (!state.userAddress) return;
     if (shouldSkipByTtl(mapState.lastUserAttacksLoadAt, MAP_ATTACKS_TTL_MS, forceFresh)) {
       displayMapUserAttacks();
       return;
     }
   
     try {
       const attacks = await fetchAllWithPagination(
         "attackV6S",
         "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed cancelled protectionLevel effectiveStealPercent stolenAmount",
         `{ attacker: "${state.userAddress.toLowerCase()}" }`,
         {
           cacheTtlMs: 10_000,
           forceFresh
         }
       );
   
       const dismissed = loadDismissedAttacks();
   
       mapState.userAttacks = (attacks || [])
         .map((a) => ({
           id: a.id,
           targetTokenId: safeParseInt(a.targetTokenId, 0),
           attackerTokenId: safeParseInt(a.attackerTokenId, 0),
           attackIndex: safeParseInt(a.attackIndex, 0),
           startTime: safeParseInt(a.startTime, 0),
           endTime: safeParseInt(a.endTime, 0),
           executed: !!a.executed,
           cancelled: !!a.cancelled,
           resource: safeParseInt(a.resource, 0),
           protectionLevel: a.protectionLevel ? safeParseInt(a.protectionLevel, 0) : 0,
           effectiveStealPercent: a.effectiveStealPercent ? safeParseInt(a.effectiveStealPercent, 0) : 0,
           stolenAmount: a.stolenAmount ? a.stolenAmount.toString() : "0"
         }))
         .filter((a) => !a.executed && !a.cancelled && !dismissed.has(a.id));
   
       mapState.lastUserAttacksLoadAt = nowMs();
   
       displayMapUserAttacks();
       startMapAttacksTicker();
       drawPyramid();
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
   
   export function getUserAttacks() {
     return mapState.userAttacks;
   }
   
   export const initReadOnly = initMapReadOnly;
   export const loadData = loadMapData;
   export const loadUserResources = loadMapUserResources;
   export const loadUserAttacks = loadMapUserAttacks;
   
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
     }, 1000);
   }
   
   export function stopMapAttacksTicker() {
     if (mapState.attacksTicker) {
       clearInterval(mapState.attacksTicker);
       mapState.attacksTicker = null;
     }
   }
   
   export function getFarmingV5Contract() {
     return state.farmingV5Contract || null;
   }
   
   export async function getV5PendingTotal(tokenId) {
     if (!state.farmingV5Contract) {
       return ethers.BigNumber.from(0);
     }
   
     try {
       const pending = await state.farmingV5Contract.pendingResources(tokenId);
       if (Array.isArray(pending)) {
         return pending.reduce(
           (acc, v) => acc.add(ethers.BigNumber.from(v || 0)),
           ethers.BigNumber.from(0)
         );
       }
       return ethers.BigNumber.from(pending || 0);
     } catch {
       return ethers.BigNumber.from(0);
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
   
       if (token.farmV6Active || token.farmActive) html += " · Farming V6";
       else if (token.farmV5Active) html += " · Farming V5";
   
       if (token.protectionActive) {
         html += ` · Protected ${token.protectionLevel}%`;
       }
   
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