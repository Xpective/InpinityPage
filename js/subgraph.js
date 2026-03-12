/* =========================================================
   SUBGRAPH QUERIES – V6 + MERCENARY V4
   ========================================================= */

   import { WORKER_URL, MERCENARY_RANK_LABELS } from "./config.js";
   import { debugLog } from "./utils.js";
   
   /* =========================================================
      CORE FETCH
      ========================================================= */
   
   export async function fetchSubgraph(query, retries = 5, baseDelay = 1200) {
     for (let i = 0; i < retries; i++) {
       try {
         const res = await fetch(`${WORKER_URL}/api/subgraph`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ query })
         });
   
         const json = await res.json().catch(() => ({}));
   
         if (!res.ok || json.errors) {
           throw new Error(json?.errors?.[0]?.message || `HTTP ${res.status}`);
         }
   
         return json.data || {};
       } catch (e) {
         if (i === retries - 1) throw e;
   
         const wait = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 500);
         await new Promise((r) => setTimeout(r, wait));
       }
     }
   
     return {};
   }
   
   export async function fetchAllWithPagination(fieldName, subfields, where = "") {
     const pageSize = 1000;
     let skip = 0;
     let all = [];
   
     while (true) {
       const q = `{
         ${fieldName}(first:${pageSize}, skip:${skip}${where ? ", where:" + where : ""}) {
           ${subfields}
         }
       }`;
   
       const data = await fetchSubgraph(q);
       const items = data?.[fieldName];
   
       if (!items || items.length === 0) break;
   
       all = all.concat(items);
   
       if (items.length < pageSize) break;
       skip += pageSize;
     }
   
     debugLog(`Fetched ${all.length} ${fieldName} items`);
     return all;
   }
   
   /* =========================================================
      TOKENS / FARMS / ATTACKS
      ========================================================= */
   
   export async function loadMyTokensFromSubgraph(wallet) {
     const owner = String(wallet || "").toLowerCase();
   
     return fetchAllWithPagination(
       "tokens",
       `
         id
         revealed
         owner { id }
       `,
       `{ owner_: { id: "${owner}" } }`
     );
   }
   
   export async function loadMyFarmsV6FromSubgraph(wallet) {
     const owner = String(wallet || "").toLowerCase();
   
     return fetchAllWithPagination(
       "farmV6S",
       `
         id
         owner
         startTime
         lastAccrualTime
         lastClaimTime
         boostExpiry
         stopTime
         active
         updatedAt
         blockNumber
       `,
       `{ owner: "${owner}" }`
     );
   }
   
   export async function loadMyAttacksV6FromSubgraph(wallet) {
     const owner = String(wallet || "").toLowerCase();
   
     return fetchAllWithPagination(
       "attackV6S",
       `
         id
         attacker
         attackerTokenId
         targetTokenId
         attackIndex
         resource
         startTime
         endTime
         executed
         cancelled
         protectionLevel
         effectiveStealPercent
         stolenAmount
       `,
       `{ attacker: "${owner}" }`
     );
   }
   
   /* =========================================================
      MERCENARY V4 SUBGRAPH
      ========================================================= */
   
   function normalizeRankName(rank, rankName) {
     if (rankName && String(rankName).trim()) return String(rankName).trim();
   
     const idx = Number(rank || 0);
     return MERCENARY_RANK_LABELS[idx] || "Watchman";
   }
   
   function normalizeMercenaryProfile(profile) {
     if (!profile) return null;
   
     const points = Number(profile.points || profile.defenderPoints || 0);
     const rank = Number(profile.rank || 0);
     const slotsUnlocked = Math.max(1, Number(profile.slotsUnlocked || 1));
     const discountBps = Number(profile.discountBps || 0);
     const bastionTitle = String(profile.bastionTitle || "");
   
     return {
       id: String(profile.id || profile.user || "").toLowerCase(),
       user: String(profile.user || profile.id || "").toLowerCase(),
   
       points,
       defenderPoints: points,
   
       rank,
       rankName: normalizeRankName(rank, profile.rankName),
   
       discountBps,
       totalProtectedDays: Number(profile.totalProtectedDays || 0),
       successfulDefenses: Number(profile.successfulDefenses || 0),
       sameBlockExtensions: Number(profile.sameBlockExtensions || 0),
       cleanupActions: Number(profile.cleanupActions || 0),
       emergencyMovesUsed: Number(profile.emergencyMovesUsed || 0),
   
       slotsUnlocked,
       freeCleanupCredits: Number(profile.freeCleanupCredits || 0),
   
       bastionTitle,
   
       updatedAt: Number(profile.updatedAt || 0),
       blockNumber: Number(profile.blockNumber || 0),
       transactionHash: profile.transactionHash || null
     };
   }
   
   function normalizeMercenarySlot(slot) {
     const now = Math.floor(Date.now() / 1000);
     const expiry = Number(slot.expiry || 0);
   
     return {
       id: String(slot.id || ""),
       user: String(slot.user || "").toLowerCase(),
       slotIndex: Number(slot.slotIndex || 0),
       tokenId: String(slot.tokenId || "0"),
       startTime: Number(slot.startTime || 0),
       expiry,
       expiresAt: expiry,
       cooldownUntil: Number(slot.cooldownUntil || 0),
       emergencyReadyAt: Number(slot.emergencyReadyAt || 0),
       protectionTier: Number(slot.protectionTier || 0),
       protectionPercent: Number(slot.protectionPercent || 0),
       active: !!slot.active && expiry > now,
       rawActive: !!slot.active,
       lastReason: String(slot.lastReason || ""),
       updatedAt: Number(slot.updatedAt || 0),
       blockNumber: Number(slot.blockNumber || 0),
       transactionHash: slot.transactionHash || null
     };
   }
   
   export async function loadMercenaryTokenProtectionsV4() {
     return fetchAllWithPagination(
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
         transactionHash
       `,
       `{ active: true }`
     );
   }
   
   export async function loadMercenaryProfileV4(wallet) {
     const id = String(wallet || "").toLowerCase();
   
     const q = `{
       defenderProfileV4(id: "${id}") {
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
         transactionHash
       }
     }`;
   
     const data = await fetchSubgraph(q);
     return normalizeMercenaryProfile(data?.defenderProfileV4 || null);
   }
   
   export async function loadMercenarySlotsV4(wallet) {
     const user = String(wallet || "").toLowerCase();
   
     const rows = await fetchAllWithPagination(
       "mercenarySlotV4S",
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
         transactionHash
       `,
       `{ user: "${user}" }`
     );
   
     return (rows || []).map(normalizeMercenarySlot);
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
   
   export function buildProtectionMapV4(protections) {
     const map = new Map();
     const now = Math.floor(Date.now() / 1000);
   
     for (const p of protections || []) {
       const tokenId = String(p.tokenId || p.id);
       const expiresAt = Number(p.expiry || p.expiresAt || 0);
       const level = Number(p.protectionPercent || p.level || 0);
       const active = !!p.active && expiresAt > now;
   
       map.set(tokenId, {
         tokenId,
         user: String(p.user || "").toLowerCase(),
         slotIndex: Number(p.slotIndex || 0),
         level,
         protectionPercent: level,
         tier: Number(p.protectionTier || p.tier || 0),
         expiresAt,
         expiry: expiresAt,
         active,
         updatedAt: Number(p.updatedAt || 0),
         blockNumber: Number(p.blockNumber || 0),
         transactionHash: p.transactionHash || null
       });
     }
   
     return map;
   }
   
   export function buildMercenarySlotMapV4(slots) {
     const map = new Map();
     const now = Math.floor(Date.now() / 1000);
   
     for (const raw of slots || []) {
       const slot = normalizeMercenarySlot(raw);
       const slotIndex = Number(slot.slotIndex || 0);
       const user = String(slot.user || "").toLowerCase();
       const id = `${user}-${slotIndex}`;
   
       map.set(id, {
         id,
         user,
         slotIndex,
         tokenId: String(slot.tokenId || "0"),
         startTime: Number(slot.startTime || 0),
         expiry: Number(slot.expiry || 0),
         expiresAt: Number(slot.expiry || 0),
         cooldownUntil: Number(slot.cooldownUntil || 0),
         emergencyReadyAt: Number(slot.emergencyReadyAt || 0),
         protectionTier: Number(slot.protectionTier || 0),
         protectionPercent: Number(slot.protectionPercent || 0),
         active: !!slot.rawActive && Number(slot.expiry || 0) > now,
         rawActive: !!slot.rawActive,
         lastReason: String(slot.lastReason || ""),
         updatedAt: Number(slot.updatedAt || 0),
         blockNumber: Number(slot.blockNumber || 0),
         transactionHash: slot.transactionHash || null
       });
     }
   
     return map;
   }
   
   export function buildDefenderProfileMapV4(profile) {
     const map = new Map();
     const normalized = normalizeMercenaryProfile(profile);
   
     if (!normalized || !normalized.id) return map;
   
     map.set(String(normalized.id).toLowerCase(), {
       id: String(normalized.id).toLowerCase(),
       user: String(normalized.user || "").toLowerCase(),
   
       points: Number(normalized.points || 0),
       defenderPoints: Number(normalized.defenderPoints || normalized.points || 0),
   
       rank: Number(normalized.rank || 0),
       rankName: String(normalized.rankName || "Watchman"),
       discountBps: Number(normalized.discountBps || 0),
   
       totalProtectedDays: Number(normalized.totalProtectedDays || 0),
       successfulDefenses: Number(normalized.successfulDefenses || 0),
       sameBlockExtensions: Number(normalized.sameBlockExtensions || 0),
       cleanupActions: Number(normalized.cleanupActions || 0),
       emergencyMovesUsed: Number(normalized.emergencyMovesUsed || 0),
   
       slotsUnlocked: Number(normalized.slotsUnlocked || 1),
       freeCleanupCredits: Number(normalized.freeCleanupCredits || 0),
   
       bastionTitle: String(normalized.bastionTitle || ""),
       updatedAt: Number(normalized.updatedAt || 0),
       blockNumber: Number(normalized.blockNumber || 0),
       transactionHash: normalized.transactionHash || null
     });
   
     return map;
   }