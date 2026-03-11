/* =========================================================
   SUBGRAPH QUERIES – V6 + MERCENARY V3
   ========================================================= */

   import { WORKER_URL } from "./config.js";
   import { debugLog } from "./utils.js";
   
   export async function fetchSubgraph(query, retries = 5, baseDelay = 1200) {
     for (let i = 0; i < retries; i++) {
       try {
         const res = await fetch(`${WORKER_URL}/api/subgraph`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ query })
         });
   
         const json = await res.json();
         if (!res.ok || json.errors) {
           throw new Error(json?.errors?.[0]?.message || `HTTP ${res.status}`);
         }
   
         return json.data;
       } catch (e) {
         if (i === retries - 1) throw e;
         const wait = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 500);
         await new Promise(r => setTimeout(r, wait));
       }
     }
   }
   
   export async function fetchAllWithPagination(fieldName, subfields, where = "") {
     const pageSize = 1000;
     let skip = 0;
     let all = [];
   
     while (true) {
       const q = `{ ${fieldName}(first:${pageSize}, skip:${skip}${where ? ", where:" + where : ""}) { ${subfields} } }`;
       const data = await fetchSubgraph(q);
       const items = data[fieldName];
   
       if (!items || items.length === 0) break;
       all = all.concat(items);
       if (items.length < pageSize) break;
       skip += pageSize;
     }
   
     debugLog(`Fetched ${all.length} ${fieldName} items`);
     return all;
   }
   
   export async function loadMyTokensFromSubgraph(wallet) {
     const owner = wallet.toLowerCase();
     return fetchAllWithPagination(
       "tokens",
       `id revealed owner { id }`,
       `{ owner_: { id: "${owner}" } }`
     );
   }
   
   export async function loadMyFarmsV6FromSubgraph(wallet) {
     const owner = wallet.toLowerCase();
     return fetchAllWithPagination(
       "farmV6S",
       `id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber`,
       `{ owner: "${owner}" }`
     );
   }
   
   export async function loadMyAttacksV6FromSubgraph(wallet) {
     const owner = wallet.toLowerCase();
     return fetchAllWithPagination(
       "attackV6S",
       `id attacker attackerTokenId targetTokenId attackIndex resource startTime endTime executed cancelled protectionLevel effectiveStealPercent stolenAmount`,
       `{ attacker: "${owner}" }`
     );
   }
   
   /* =========================================================
      MERCENARY V3 SUBGRAPH
      ========================================================= */
   
   export async function loadMercenaryTokenProtectionsV3() {
     return fetchAllWithPagination(
       "mercenaryTokenProtectionV3S",
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
       `{ active: true }`
     );
   }
   
   export async function loadMercenaryProfileV3(wallet) {
     const id = wallet.toLowerCase();
     const q = `{
       defenderProfileV3(id: "${id}") {
         id
         user
         points
         rank
         rankName
         discountBps
         totalProtectedDays
         successfulDefenses
         sameBlockExtensions
         cleanupActions
         emergencyMovesUsed
         slotsUnlocked
         freeCleanupCredits
         bastionTitle
         updatedAt
         blockNumber
       }
     }`;
   
     const data = await fetchSubgraph(q);
     return data.defenderProfileV3 || null;
   }
   
   export async function loadMercenarySlotsV3(wallet) {
     const user = wallet.toLowerCase();
     return fetchAllWithPagination(
       "mercenarySlotV3S",
       `
         id
         user
         slotIndex
         tokenId
         startTime
         expiry
         cooldownUntil
         emergencyReadyAt
         protectionTier
         protectionPercent
         active
         lastReason
         updatedAt
         blockNumber
       `,
       `{ user: "${user}" }`
     );
   }
   
   /* =========================================================
      CACHE BUILDERS
      ========================================================= */
   
   export function buildFarmV6Map(farms) {
     const map = new Map();
     for (const farm of farms || []) {
       map.set(String(farm.id), {
         tokenId: String(farm.id),
         owner: String(farm.owner || "").toLowerCase(),
         startTime: Number(farm.startTime || 0),
         lastAccrualTime: Number(farm.lastAccrualTime || 0),
         lastClaimTime: Number(farm.lastClaimTime || 0),
         boostExpiry: Number(farm.boostExpiry || 0),
         stopTime: Number(farm.stopTime || 0),
         active: !!farm.active,
         updatedAt: Number(farm.updatedAt || 0),
         blockNumber: Number(farm.blockNumber || 0)
       });
     }
     return map;
   }
   
   export function buildMercenaryProtectionMap(protections) {
     const map = new Map();
     const now = Math.floor(Date.now() / 1000);
   
     for (const p of protections || []) {
       const tokenId = String(p.tokenId || p.id);
       const expiresAt = Number(p.expiry || 0);
       const level = Number(p.protectionPercent || 0);
       const active = !!p.active && expiresAt > now;
   
       map.set(tokenId, {
         tokenId,
         user: String(p.user || "").toLowerCase(),
         slotIndex: Number(p.slotIndex || 0),
         level,
         tier: Number(p.protectionTier || 0),
         expiresAt,
         active
       });
     }
   
     return map;
   }