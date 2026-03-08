/* =========================================================
   SUBGRAPH QUERIES – V6 ONLY (farmV6S / attackV6S)
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
   
   export async function loadProtectionsFromSubgraph() {
     return fetchAllWithPagination(
       "protections",
       `id level expiresAt active`,
       `{ active: true }`
     );
   }
   
   // Cache Builders
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
   
   export function buildProtectionMap(protections) {
     const map = new Map();
     for (const p of protections || []) {
       map.set(String(p.id), {
         tokenId: String(p.id),
         level: Number(p.level || 0),
         expiresAt: Number(p.expiresAt || 0),
         active: !!p.active
       });
     }
     return map;
   }