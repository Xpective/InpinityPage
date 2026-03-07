/* =========================================================
   INPINITY GAME – V4 ONLY – Finale Version mit allen Optimierungen
   - Tokens, Farms, Protections separat geladen (Subgraph)
   - Matching über tokenId
   - Caching von Farm-/Protection-Maps
   - Positionen immer onchain (getBlockPosition)
   - Farming-Status für Aktionen onchain
   - Request-ID für Attack-Dropdown
   - Selbstangriffsprüfung
   - Chain-Switch stabilisiert
   - Cache-Fallback
   - Nur aktive Farms geladen
   - V4‑konforme Attack‑Prüfungen (canAttackTarget, remainingAttacks, AttackTime, callStatic)
   - Safe-Wrapper für getAllPending
   ========================================================= */

/* ==================== KONFIGURATION (NUR V4) ==================== */
const NFT_ADDRESS            = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";
const FARMING_V4_ADDRESS     = "0xa7F093c893aeF7dA632e5Fa23971ad3C00Cc5bEd";
const PIRATES_V4_ADDRESS     = "0x393726fc6f54A07bca710ed7F1c93491CE7daF03";
const MERCENARY_V2_ADDRESS   = "0xFEa09ccA75dbc63cc8053739A61777Bd13fC6Bc2";
const PARTNERSHIP_V2_ADDRESS = "0xb18323efE4Cc8c36e10D664E287b4e2c82Fe3ad9";
const RESOURCE_TOKEN_ADDRESS = "0x71E76a6065197acdd1a4d6B736712F80D1Fd3D8b";
const INPI_ADDRESS           = "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D";
const PITRONE_ADDRESS        = "0x7240Ec5B3Ba944888E186c74D0f8B4F5F71c9AE8";

const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
const MAX_ROW = 99;
const PRICE_ETH  = "0.003";
const PRICE_INPI = "30";
const PRICE_ETH_MIXED  = "0.0015";
const PRICE_INPI_MIXED = "15";

const CLAIM_COOLDOWN_SEC = 24 * 60 * 60; // 24h

/* ==================== ABIs (VOLLSTÄNDIG) ==================== */
const NFT_ABI = [
  "function mintWithETH(uint256 row, uint256 col) payable",
  "function mintWithINPI(uint256 row, uint256 col) external",
  "function mintMixed(uint256 row, uint256 col) payable",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getBlockPosition(uint256 tokenId) view returns (uint256 row, uint256 col)",
  "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)",
  "function revealBlock(uint256 tokenId, bytes32[] piProof, bytes32[] phiProof, uint8 piDigit, uint8 phiDigit) external",
  "function calculateRarity(uint256 tokenId) view returns (uint8)"
];

const FARMING_V4_ABI = [
  "function startFarming(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external",
  "function claimResources(uint256 tokenId) external",
  "function farms(uint256) view returns (uint256 startTime, uint256 lastAccrualTime, uint256 boostExpiry, bool isActive)",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])",
  "function getPending(uint256 tokenId, uint8 resourceId) view returns (uint256)",
  "function getDailyProduction(uint256 tokenId) view returns (uint256[10])",
  "function getFarmInfo(uint256 tokenId) view returns ((uint256 startTime, uint256 lastAccrualTime, uint256 boostExpiry, bool isActive))",
  "function getBoostMultiplier(uint256 tokenId) view returns (uint256)",
  "function stealResources(uint256 targetTokenId, address attacker, uint8 resourceId, uint256 percent) external returns (uint256)",
  "function piratesContract() view returns (address)",
  "function partnershipContract() view returns (address)"
];

const PIRATES_V4_ABI = [
  "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resource) external",
  "function executeAttack(uint256 targetTokenId, uint256 attackIndex) external",
  "function canAttackTarget(address attacker, uint256 targetTokenId) view returns (bool)",
  "function getRemainingAttacksToday(address attacker) view returns (uint8)",
  "function getAttackTime(uint256 attackerTokenId, uint256 targetTokenId) view returns (uint256)",
  "function getAttackCount(uint256 targetTokenId) view returns (uint256)",
  "function getAttack(uint256 targetTokenId, uint256 index) view returns ((address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed))",
  "function getEffectiveStealPercent(uint256 attackerTokenId, uint256 protectionLevel) view returns (uint256)",
  "function hasPirateBoost(uint256 tokenId) view returns (bool)",
  "function getPirateBoostExpiry(uint256 tokenId) view returns (uint256)",
  "function attacks(uint256 targetTokenId, uint256 index) view returns (address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed)",
  "function attackCounter(uint256 targetTokenId) view returns (uint256)",
  "function farming() view returns (address)",
  "function mercenary() view returns (address)"
];

const MERCENARY_V2_ABI = [
  "function hireMercenaries(uint256 tokenId, uint256 protectionLevel) external",
  "function getProtectionLevel(uint256 tokenId) view returns (uint256)"
];

const PARTNERSHIP_V2_ABI = [
  "function isPartnerBlock(uint256 tokenId) view returns (bool)"
];

const INPI_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const PITRONE_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeINPI(uint256 inpiAmount) external",
  "function exchangePitrone(uint256 pitroneAmount) external",
  "function getRate() view returns (uint256)",
  "function availableINPI() view returns (uint256)",
  "function availablePitrone() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const RESOURCE_TOKEN_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
];

/* ==================== GLOBALS ==================== */
let provider, signer, userAddress;
let nftContract, farmingV4Contract, piratesV4Contract, mercenaryV2Contract, partnershipV2Contract;
let inpiContract, pitroneContract, resourceTokenContract;

let selectedPayment = "eth";
let selectedBlock = null;

let userBlocks = [];
let userAttacks = [];
let userResources = [];

// Caching für Farms und Protections (wird in loadUserBlocks befüllt)
let cachedMyFarms = [];
let cachedProtections = [];
let cachedFarmMap = new Map();
let cachedProtectionMap = new Map();

let attacksTicker = null;
let attacksPoller = null;
let isConnecting = false;

// Für Request-ID im Attack-Dropdown
let attackDropdownRequestId = 0;

// Debounce Timer für Attack-Dropdown
let attackDropdownTimer = null;

// Cache-Warmup Promise für parallele Aufrufe
let cacheWarmupPromise = null;

const resourceNames = ["Oil","Lemons","Iron","Gold","Platinum","Copper","Crystal","Obsidian","Mysterium","Aether"];
const rarityNames   = ["Bronze","Silver","Gold","Platinum","Diamond"];

/* ==================== HELPERS ==================== */
function shortenAddress(addr){ return addr ? addr.slice(0,6)+"..."+addr.slice(-4) : ""; }

function formatTime(seconds){
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return seconds+"s";
  if (seconds < 3600) return Math.floor(seconds/60)+"m";
  return Math.floor(seconds/3600)+"h";
}

function formatDuration(seconds){
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function safeText(id, txt){ const el=document.getElementById(id); if(el) el.innerText=txt; }
function safeHTML(id, html){ const el=document.getElementById(id); if(el) el.innerHTML=html; }

function secondsUntilClaimable(farmStartTime, nowSec){
  if (!farmStartTime) return null;
  const age = nowSec - farmStartTime;
  return Math.max(0, CLAIM_COOLDOWN_SEC - age);
}

/* ==================== ONCHAIN POSITIONSHELPER ==================== */
async function getTokenPosition(tokenId) {
  const pos = await nftContract.getBlockPosition(tokenId);
  return { row: Number(pos.row), col: Number(pos.col) };
}

/* ==================== SAFE FARM‑HELPER (V4) ==================== */
async function safeGetFarm(tokenId) {
  try {
    const f = await farmingV4Contract.farms(tokenId);
    return {
      ok: true,
      startTime: Number(f.startTime?.toString?.() ?? f.startTime ?? 0),
      lastAccrualTime: Number(f.lastAccrualTime?.toString?.() ?? f.lastAccrualTime ?? 0),
      boostExpiry: Number(f.boostExpiry?.toString?.() ?? f.boostExpiry ?? 0),
      isActive: !!f.isActive
    };
  } catch (e) {
    console.warn(`farms() reverted for token ${tokenId}`, e);
    return {
      ok: false,
      startTime: 0,
      lastAccrualTime: 0,
      boostExpiry: 0,
      isActive: false
    };
  }
}

/* ==================== SAFE GETALLPENDING (V4) ==================== */
async function safeGetAllPending(tokenId) {
  try {
    const farm = await safeGetFarm(tokenId);

    if (!farm.ok) {
      return { ok: false, pending: null, reason: "farm-read-failed" };
    }

    if (!farm.isActive) {
      return { ok: false, pending: null, reason: "farm-inactive" };
    }

    if (!farm.startTime || farm.startTime <= 0) {
      return { ok: false, pending: null, reason: "farm-not-started" };
    }

    const pending = await farmingV4Contract.getAllPending(tokenId);
    return { ok: true, pending, reason: "ok" };
  } catch (e) {
    console.warn(`getAllPending reverted for token ${tokenId}`, e);
    return { ok: false, pending: null, reason: "pending-reverted" };
  }
}

/* ==================== SAFE PIRATES‑HELPER ==================== */
async function safeCanAttack(attackerAddress, targetTokenId) {
  try {
    return await piratesV4Contract.canAttackTarget(attackerAddress, targetTokenId);
  } catch (e) {
    console.warn("canAttackTarget failed", e);
    return false;
  }
}

async function safeGetRemainingAttacksToday(attackerAddress) {
  try {
    const val = await piratesV4Contract.getRemainingAttacksToday(attackerAddress);
    return Number(val.toString());
  } catch (e) {
    console.warn("getRemainingAttacksToday failed", e);
    return null;
  }
}

async function safeGetAttackTime(attackerTokenId, targetTokenId) {
  try {
    const val = await piratesV4Contract.getAttackTime(attackerTokenId, targetTokenId);
    return Number(val.toString());
  } catch (e) {
    console.warn("getAttackTime failed", e);
    return null;
  }
}

function isGtZero(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "bigint") return value > 0n;
  if (typeof value === "number") return value > 0;
  try {
    const bn = BigInt(value.toString());
    return bn > 0n;
  } catch {
    return false;
  }
}

/* ==================== SUBGRAPH (über Worker) ==================== */
async function fetchSubgraph(query, retries = 5, baseDelay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${WORKER_URL}/api/subgraph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (res.status === 429) {
        if (i < retries - 1) {
          const waitTime = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 700);
          console.warn(`Subgraph via worker 429, retry ${i+1}/${retries} after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(`HTTP 429 – Too Many Requests (after ${retries} retries)`);
        }
      }

      const json = await res.json();
      if (!res.ok || json.errors) {
        throw new Error(json.errors?.[0]?.message || (`HTTP ${res.status}`));
      }
      return json.data;
    } catch (e) {
      if (i === retries - 1) throw e;
      const waitTime = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 700);
      console.warn(`Subgraph via worker error (${e.message}), retry ${i+1}/${retries} after ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function fetchAllWithPagination(fieldName, subfields, where = "") {
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
  return all;
}

/* ==================== SUBGRAPH-LOADER ==================== */
async function loadMyTokensFromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return await fetchAllWithPagination(
    "tokens",
    `
      id
      revealed
      owner { id }
    `,
    `{ owner_: { id: "${owner}" } }`
  );
}

async function loadMyFarmsV4FromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return await fetchAllWithPagination(
    "farmV4S",
    `
      id
      owner
      startTime
      lastAccrualTime
      boostExpiry
      active
      blockNumber
      blockTimestamp
    `,
    `{ owner: "${owner}" }`
  );
}

// Nur aktive Farms laden
async function loadMyActiveFarmsV4FromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return await fetchAllWithPagination(
    "farmV4S",
    `
      id
      owner
      startTime
      lastAccrualTime
      boostExpiry
      active
      blockNumber
      blockTimestamp
    `,
    `{ owner: "${owner}", active: true }`
  );
}

async function loadAllActiveFarmsV4FromSubgraph(){
  return await fetchAllWithPagination(
    "farmV4S",
    `
      id
      owner
      startTime
      lastAccrualTime
      boostExpiry
      active
      blockNumber
      blockTimestamp
    `,
    `{ active: true }`
  );
}

let protectionsLoadedOnce = false;

async function loadProtectionsFromSubgraph(force = false){
  if (!force && protectionsLoadedOnce && cachedProtections.length > 0) {
    return cachedProtections;
  }

  const data = await fetchAllWithPagination(
    "protections",
    `
      id
      level
      expiresAt
      active
    `,
    `{ active: true }`
  );

  cachedProtections = data || [];
  protectionsLoadedOnce = true;
  return cachedProtections;
}

/* ==================== MAP-FUNKTIONEN ==================== */
function buildFarmMap(farms){
  const map = new Map();
  for(const farm of farms || []){
    map.set(String(farm.id), {
      tokenId: String(farm.id),
      owner: (farm.owner || "").toLowerCase(),
      startTime: Number(farm.startTime || 0),
      lastAccrualTime: Number(farm.lastAccrualTime || 0),
      boostExpiry: Number(farm.boostExpiry || 0),
      active: !!farm.active,
      blockNumber: Number(farm.blockNumber || 0),
      blockTimestamp: Number(farm.blockTimestamp || 0)
    });
  }
  return map;
}

function buildProtectionMap(protections){
  const map = new Map();
  for(const p of protections || []){
    map.set(String(p.id), {
      tokenId: String(p.id),
      level: Number(p.level || 0),
      expiresAt: Number(p.expiresAt || 0),
      active: !!p.active
    });
  }
  return map;
}

/* ==================== BALANCES ==================== */
async function updateBalances(){
  if(!userAddress || !provider) return;

  const ethBal = await provider.getBalance(userAddress);
  safeText("balanceEth", parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4)+" ETH");

  try{
    const inpiBal = await inpiContract.balanceOf(userAddress);
    safeText("balanceInpi", parseFloat(ethers.utils.formatEther(inpiBal)).toFixed(0)+" INPI");
    safeText("userInpi", parseFloat(ethers.utils.formatEther(inpiBal)).toFixed(0));
  }catch(e){}

  try{
    const pitBal = await pitroneContract.balanceOf(userAddress);
    safeText("balancePit", ethers.utils.formatEther(pitBal).split(".")[0]+" PIT");
    safeText("userPitrone", ethers.utils.formatEther(pitBal).split(".")[0]);
  }catch(e){}
}

async function updatePoolInfo(){
  if(!pitroneContract) return;
  try{
    const rate = await pitroneContract.getRate();
    safeText("exchangeRate", rate.toString());

    const aInpi = await pitroneContract.availableINPI();
    safeText("poolInpi", ethers.utils.formatEther(aInpi).split(".")[0]);

    const aPit = await pitroneContract.availablePitrone();
    safeText("poolPit", ethers.utils.formatEther(aPit).split(".")[0]);
  }catch(e){}
}

/* ==================== RESOURCES ==================== */
async function loadResourceBalancesOnchain(){
  if(!userAddress || !resourceTokenContract) return;
  const ids = [...Array(10).keys()];
  const accounts = ids.map(() => userAddress);
  const balances = await resourceTokenContract.balanceOfBatch(accounts, ids);
  userResources = ids.map((id, idx) => ({
    resourceId: id,
    amount: balances[idx]
  })).filter(r => isGtZero(r.amount));
  updateUserResourcesDisplay();
}

function updateUserResourcesDisplay(){
  const container = document.getElementById("userResources");
  if(!container) return;

  if(!userAddress){
    container.innerHTML = `<p style="color: var(--text-dim); grid-column: 1/-1; text-align: center;">Connect wallet to see your resource tokens.</p>`;
    return;
  }

  if(!userResources || userResources.length === 0){
    container.innerHTML = `<p style="color: var(--text-dim); grid-column: 1/-1; text-align: center;">You have no resource tokens yet. Start farming!</p>`;
    return;
  }

  userResources.sort((a,b) => a.resourceId - b.resourceId);

  let html = "";
  for(const r of userResources){
    const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
    const imgUrl = `https://inpinity.online/img/${r.resourceId}.PNG`;
    html += `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; background:#1b2630; border-radius:1rem; padding:0.5rem;">
        <img src="${imgUrl}" alt="${name}" style="width:32px; height:32px; object-fit:contain;" onerror="this.style.display='none'">
        <span style="color:#d4af37; min-width:80px; font-weight:600;">${name}</span>
        <span style="font-weight:600; color:#f0f4fa;">${r.amount.toString()}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

/* ==================== FARM (NUR V4) – Onchain für Aktionen ==================== */
async function getFarmStatus(tokenId){
  try{
    const f = await farmingV4Contract.farms(tokenId);
    return { v4Active: !!f.isActive };
  }catch(e){
    return { v4Active: false };
  }
}

async function startFarmingV4(tokenId, msgDivId="actionMessage"){
  const msgDiv = document.getElementById(msgDivId);
  if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Checking farms...</span>`;

  try {
    const farm = await farmingV4Contract.farms(tokenId);
    if (farm.isActive){
      if (msgDiv) msgDiv.innerHTML = `<span class="success">✅ Already on V4.</span>`;
      return;
    }

    if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Starting V4 farming...</span>`;
    const tx = await farmingV4Contract.startFarming(tokenId, { gasLimit: 500000 });
    await tx.wait();
    if (msgDiv) msgDiv.innerHTML = `<span class="success">✅ V4 farming started.</span>`;
  } catch (e){
    console.error(e);
    if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

/* ==================== CACHE WARMUP ==================== */
async function warmupCaches() {
  if (cacheWarmupPromise) return cacheWarmupPromise;

  cacheWarmupPromise = (async () => {
    const farms = await loadMyActiveFarmsV4FromSubgraph(userAddress);
    const protections = await loadProtectionsFromSubgraph();

    cachedMyFarms = farms || [];
    cachedProtections = protections || [];
    cachedFarmMap = buildFarmMap(cachedMyFarms);
    cachedProtectionMap = buildProtectionMap(cachedProtections);
  })();

  try {
    await cacheWarmupPromise;
  } finally {
    cacheWarmupPromise = null;
  }
}

/* ==================== BLOCKS – MIT CACHING ==================== */
async function loadUserBlocks(){
  if(!userAddress || !nftContract) return;

  const grid = document.getElementById("blocksGrid");
  if(!grid) return;

  try{
    const subgraphTokens = await loadMyTokensFromSubgraph(userAddress);
    const subgraphFarms = await loadMyActiveFarmsV4FromSubgraph(userAddress);
    const subgraphProtections = await loadProtectionsFromSubgraph();

    // Cache aktualisieren
    cachedMyFarms = subgraphFarms || [];
    cachedProtections = subgraphProtections || [];
    cachedFarmMap = buildFarmMap(cachedMyFarms);
    cachedProtectionMap = buildProtectionMap(cachedProtections);

    userBlocks = (subgraphTokens || []).map(t => String(t.id));

    if(userBlocks.length === 0){
      grid.innerHTML = `<p style="color:var(--text-dim); text-align:center;">You don’t own any blocks yet.</p>`;
      safeText("activeFarms", "0");
      return;
    }

    let html = "";
    let activeFarmsCount = 0;
    const now = Math.floor(Date.now()/1000);

    for(const token of subgraphTokens){
      const tokenId = String(token.id);

      let row = 0;
      let col = 0;
      let revealed = !!token.revealed;
      let rarityName = "";

      try{
        const pos = await nftContract.getBlockPosition(tokenId);
        row = Number(pos.row);
        col = Number(pos.col);
      }catch(e){
        console.warn("getBlockPosition failed for", tokenId, e);
      }

      let rarity = null;
      if(revealed){
        try{
          rarity = Number(await nftContract.calculateRarity(tokenId));
          rarityName = rarityNames[rarity] || "";
        }catch(e){}
      }

      const farm = cachedFarmMap.get(tokenId);
      const farmingActive = !!(farm && farm.active);
      const farmStartTime = farm ? farm.startTime : 0;
      if(farmingActive) activeFarmsCount++;

      const protection = cachedProtectionMap.get(tokenId);
      const protectionLevel = protection ? protection.level : 0;
      const protectionActive = !!(protection && protection.active && protection.expiresAt > now && protectionLevel > 0);

      // Partner-Status vorerst deaktiviert
      let partnerActive = false;

      let classNames = revealed ? "revealed" : "";
      if(farmingActive) classNames += " farming";
      if(protectionActive) classNames += " protected";
      if(selectedBlock && String(selectedBlock.tokenId) === tokenId) classNames += " selected";

      const badge = revealed
        ? `<div class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</div>`
        : `<div class="rarity">🔒 Hidden</div>`;

      const farmDurationLine = farmingActive && farmStartTime > 0
        ? `<div style="margin-top:6px; font-size:0.78rem; color: var(--text-dim);">⏱️ Farming: ${formatDuration(now - farmStartTime)}</div>`
        : "";

      html += `
        <div class="block-card ${classNames}" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">
          <div class="block-id">#${tokenId}</div>
          <div>R${row} C${col}</div>
          ${badge}
          ${farmDurationLine}
          ${partnerActive ? '<span class="star" style="position:absolute; top:-5px; right:-5px;">★</span>' : ''}
        </div>
      `;
    }

    grid.innerHTML = html;
    safeText("activeFarms", String(activeFarmsCount));

    document.querySelectorAll(".block-card").forEach(card=>{
      card.addEventListener("click", ()=>{
        selectBlock(card.dataset.tokenid, card.dataset.row, card.dataset.col);
      });
    });

    refreshBlockMarkings();
  }catch(e){
    console.error("loadUserBlocks error:", e);
    grid.innerHTML = `<p style="color:var(--accent-red); text-align:center;">Failed to load blocks.</p>`;
  }
}

async function selectBlock(tokenId, row, col){
  // Cache-Fallback mit gemeinsamer Warmup-Funktion
  if (cachedFarmMap.size === 0 || cachedProtectionMap.size === 0) {
    try {
      await warmupCaches();
    } catch(e) {
      console.warn("Cache fallback failed", e);
    }
  }

  const now = Math.floor(Date.now()/1000);

  let revealed = false;
  let rarity = null;

  try{
    const tokenData = await nftContract.blockData(tokenId);
    revealed = !!tokenData.revealed;
  }catch(e){}

  if(revealed){
    try{
      rarity = Number(await nftContract.calculateRarity(tokenId));
    }catch(e){}
  }

  // Aus dem Cache lesen (keine neuen Subgraph-Aufrufe)
  const farm = cachedFarmMap.get(String(tokenId));
  const farmingActive = !!(farm && farm.active);
  const farmStartTime = farm ? farm.startTime : 0;
  const boostExpiry = farm ? farm.boostExpiry : 0;

  const protection = cachedProtectionMap.get(String(tokenId));
  const protectionLevel = protection ? protection.level : 0;
  const protectionActive = !!(protection && protection.active && protection.expiresAt > now && protectionLevel > 0);

  let partnerActive = false;

  selectedBlock = {
    tokenId: String(tokenId),
    row: Number(row),
    col: Number(col),
    revealed,
    rarity,
    farmingActive,
    protectionLevel,
    protectionActive,
    partnerActive,
    farmStartTime,
    boostExpiry
  };

  document.getElementById("selectedBlockInfo").style.display = "block";

  const farmDur = (farmingActive && farmStartTime > 0)
    ? ` · ⏱️ ${formatDuration(now - farmStartTime)}`
    : "";

  safeText("selectedBlockText", `Block #${tokenId} (R${row}, C${col})${farmDur}`);
  document.getElementById("blockActions").style.display = "block";
  document.getElementById("noBlockSelected").style.display = "none";
  safeText("selectedActionToken", `Block #${tokenId}`);

  const revealBtn = document.getElementById("revealBtn");
  revealBtn.disabled = revealed;
  revealBtn.style.opacity = revealed ? "0.3" : "1";

  const startBtn = document.getElementById("farmingStartBtn");
  const stopBtn  = document.getElementById("farmingStopBtn");
  startBtn.disabled = farmingActive;
  stopBtn.disabled  = !farmingActive;

  const resDiv = document.getElementById("blockResources");
  if(revealed && rarity !== null){
    const production = getProduction(rarity, Number(row));
    let h = "";
    for(const [res, amount] of Object.entries(production)){
      h += `<div class="resource-item">${res}: ${amount}/day</div>`;
    }

    if(protectionActive){
      h += `<div class="resource-item">Protection: ${protectionLevel}%</div>`;
    }
    if(boostExpiry > now){
      h += `<div class="resource-item">Boost: active</div>`;
    }

    resDiv.innerHTML = h;
  }else{
    resDiv.innerHTML = "<p>Reveal block to see resources.</p>";
  }

  document.querySelectorAll(".block-card").forEach(c => c.classList.remove("selected"));
  const sel = document.querySelector(`.block-card[data-tokenid="${tokenId}"]`);
  if(sel) sel.classList.add("selected");
}

function getProduction(rarity,row){
  const p={};
  if(rarity===0){ p.OIL=10;p.LEMONS=5;p.IRON=3; }
  else if(rarity===1){ p.OIL=20;p.LEMONS=10;p.IRON=6;p.GOLD=1; }
  else if(rarity===2){ p.OIL=30;p.LEMONS=15;p.IRON=9;p.GOLD=2;p.PLATINUM=1; }
  else if(rarity===3){ p.OIL=40;p.LEMONS=20;p.IRON=12;p.GOLD=3;p.PLATINUM=2;p.CRYSTAL=1; }
  else if(rarity===4){
    p.OIL=60;p.LEMONS=30;p.IRON=18;p.GOLD=5;p.PLATINUM=3;p.CRYSTAL=2;p.MYSTERIUM=1;
    if(row===0) p.AETHER=1;
  }
  return p;
}

/* ==================== ATTACK-HELPER (onchain Position) ==================== */
function productionToAllowedResourceIds(productionObj) {
  const map = {
    OIL: 0, LEMONS: 1, IRON: 2, GOLD: 3, PLATINUM: 4,
    COPPER: 5, CRYSTAL: 6, OBSIDIAN: 7, MYSTERIUM: 8, AETHER: 9
  };
  return Object.keys(productionObj)
    .map(key => map[key])
    .filter(id => Number.isFinite(id));
}

async function getStealableResourcesForTarget(targetTokenId) {
  let farmingActive = false;
  let farmStartTime = 0;

  try {
    const f = await farmingV4Contract.farms(targetTokenId);
    farmingActive = !!f.isActive;
    farmStartTime = Number(f.startTime.toString());
  } catch (e) {}

  const now = Math.floor(Date.now()/1000);
  const claimIn = farmStartTime ? secondsUntilClaimable(farmStartTime, now) : null;

  let revealed = false;
  try {
    const d = await nftContract.blockData(targetTokenId);
    revealed = !!d.revealed;
  } catch (e) {}

  if (!revealed) {
    return {
      farmingActive,
      farmStartTime,
      claimIn,
      revealed: false,
      allowed: [0, 1, 2],
      reason: "Target not revealed yet"
    };
  }

  let rarity = 0;
  const { row } = await getTokenPosition(targetTokenId);
  try {
    rarity = Number(await nftContract.calculateRarity(targetTokenId));
  } catch (e) {}

  const prod = getProduction(rarity, row);
  const allowed = productionToAllowedResourceIds(prod);

  // Nur informativ pending holen (kein Revert)
  const pendingInfo = await safeGetAllPending(targetTokenId);
  const pendingArr = pendingInfo.ok ? pendingInfo.pending : null;

  return {
    farmingActive,
    farmStartTime,
    claimIn,
    revealed: true,
    rarity,
    allowed,
    pendingArr,
    pendingReason: pendingInfo.reason,
    reason: "OK"
  };
}

function scheduleAttackDropdownRefresh() {
  clearTimeout(attackDropdownTimer);
  attackDropdownTimer = setTimeout(() => {
    refreshAttackDropdown();
  }, 400);
}

async function refreshAttackDropdown() {
  const requestId = ++attackDropdownRequestId;

  const row = parseInt(document.getElementById("attackRow")?.value, 10);
  const col = parseInt(document.getElementById("attackCol")?.value, 10);
  const select = document.getElementById("attackResourceSelect");
  const msg = document.getElementById("attackMessage");

  if (!select) return;

  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row > MAX_ROW || col < 0 || col > 2 * row) {
    select.innerHTML = "";
    if (msg) msg.innerHTML = "";
    return;
  }

  const targetTokenId = row * 2048 + col;

  if (!userAddress || !nftContract || !farmingV4Contract) {
    select.innerHTML = "";
    [0, 1, 2].forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = resourceNames[id];
      select.appendChild(opt);
    });
    return;
  }

  msg.innerHTML = `<span class="success">⏳ Analyzing target...</span>`;

  const info = await getStealableResourcesForTarget(targetTokenId);
  if (requestId !== attackDropdownRequestId) return;

  const now = Math.floor(Date.now()/1000);

  let farmLine = "";
  if (!info.farmingActive) {
    farmLine = "❌ Farming inactive → likely 0 loot.";
  } else if (info.claimIn !== null && info.claimIn > 0) {
    farmLine = `⏳ Farming age: ${formatDuration(now - info.farmStartTime)} · Loot builds up (claim-ready in ${formatDuration(info.claimIn)}).`;
  } else if (info.claimIn === 0) {
    farmLine = `✅ Farming age: ${formatDuration(now - info.farmStartTime)} · Loot window is active.`;
  } else {
    farmLine = "✅ Farming active.";
  }

  let pendingLine = "";
  if (info.pendingArr && info.pendingArr.length !== undefined) {
    let total = ethers.BigNumber.from(0);
    for (let i = 0; i < info.pendingArr.length; i++) {
      total = total.add(info.pendingArr[i]);
    }
    pendingLine = total.isZero()
      ? "⚠️ Pending: 0"
      : `✅ Pending total: ${total.toString()}`;
  } else {
    if (info.pendingReason === "farm-inactive") {
      pendingLine = "⚠️ No pending view: farm inactive.";
    } else if (info.pendingReason === "farm-not-started") {
      pendingLine = "⚠️ No pending view: farm not started.";
    } else {
      pendingLine = "⚠️ Pending unavailable for this target.";
    }
  }

  if (requestId !== attackDropdownRequestId) return;

  msg.innerHTML = `
    <span class="${!info.farmingActive ? 'error' : 'success'}">
      ${farmLine}<br>${pendingLine}
    </span>
  `;

  select.innerHTML = "";
  info.allowed.forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = resourceNames[id] + (info.revealed ? "" : " (safe)");
    select.appendChild(opt);
  });
}

/* ==================== ATTACKS (V4) – Verbesserte Query ==================== */
function initAttackResourceSelect(){
  const select = document.getElementById("attackResourceSelect");
  if(!select) return;
  select.innerHTML = "";
  for(let i=0; i<resourceNames.length; i++){
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = resourceNames[i];
    select.appendChild(opt);
  }
}

async function loadUserAttacks() {
  if (!userAddress) return;

  try {
    const where = `{ attacker: "${userAddress.toLowerCase()}", executed: false }`;

    const attacks = await fetchAllWithPagination(
      "attackV4S",
      `
        id
        attacker
        attackerTokenId
        targetTokenId
        attackIndex
        startTime
        endTime
        resource
        executed
        protectionLevel
        effectiveStealPercent
        stolenAmount
      `,
      where
    );

    userAttacks = (attacks || []).map(a => ({
      id: a.id,
      targetTokenId: parseInt(a.targetTokenId, 10),
      attackerTokenId: parseInt(a.attackerTokenId, 10),
      attackIndex: parseInt(a.attackIndex, 10),
      startTime: parseInt(a.startTime, 10),
      endTime: parseInt(a.endTime, 10),
      executed: !!a.executed,
      resource: parseInt(a.resource, 10),
      protectionLevel: a.protectionLevel ? parseInt(a.protectionLevel,10) : 0,
      effectiveStealPercent: a.effectiveStealPercent ? parseInt(a.effectiveStealPercent,10) : 0,
      stolenAmount: a.stolenAmount ? a.stolenAmount.toString() : "0"
    }));

    const dismissed = loadDismissedAttacks();
    userAttacks = userAttacks.filter(a => !dismissed.has(a.id));

    displayUserAttacks();
    refreshBlockMarkings();
    startAttacksTicker();
  } catch (e) {
    console.error("Failed to load attacks:", e);
  }
}

function displayUserAttacks(){
  const container = document.getElementById("userAttacksList");
  if(!container) return;

  if(!userAddress){
    container.innerHTML = `<p style="color: var(--text-dim);">Connect wallet to see your attacks.</p>`;
    return;
  }
  if(userAttacks.length === 0){
    container.innerHTML = `<p style="color: var(--text-dim);">No active attacks.</p>`;
    return;
  }

  const now = Math.floor(Date.now()/1000);
  let html = "";

  userAttacks.forEach(attack=>{
    const timeLeft = attack.endTime - now;

    html += `
      <div class="attack-item" data-endtime="${attack.endTime}">
        <div>
          <div><strong>Target #${attack.targetTokenId}</strong> (${resourceNames[attack.resource]})</div>
          <div style="font-size:0.9rem; color: var(--text-dim);">
            <span class="attack-status" data-endtime="${attack.endTime}">
              ${timeLeft<=0 ? "Ready to execute" : ("⏳ "+formatTime(timeLeft)+" remaining")}
            </span>
          </div>
        </div>
        <div style="min-width:140px; display:flex; justify-content:flex-end;">
          <button class="execute-btn"
            data-attackid="${attack.id}"
            data-targetid="${attack.targetTokenId}"
            data-attackindex="${attack.attackIndex}"
            ${timeLeft<=0 ? "" : "disabled"}
            style="${timeLeft<=0 ? "" : "opacity:0.4;cursor:not-allowed;"}"
          >${timeLeft<=0 ? "⚔️ Execute" : "⏳ Waiting"}</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  document.querySelectorAll(".execute-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(btn.disabled) return;
      const attackId = btn.dataset.attackid;
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      await executeAttack({ id: attackId, targetTokenId, attackIndex });
    });
  });
}

function startAttacksTicker(){
  if(attacksTicker) return;

  attacksTicker = setInterval(()=>{
    const now = Math.floor(Date.now()/1000);

    document.querySelectorAll(".attack-status").forEach(el=>{
      const endTime = parseInt(el.dataset.endtime || "0",10);
      if(!endTime) return;
      const timeLeft = endTime - now;
      if(timeLeft<=0){
        el.textContent="Ready to execute";
        el.style.color="#51cf66";
      }else{
        el.textContent="⏳ "+formatTime(timeLeft)+" remaining";
        el.style.color="";
      }
    });

    document.querySelectorAll(".attack-item").forEach(item=>{
      const endTime = parseInt(item.dataset.endtime || "0",10);
      const btn = item.querySelector(".execute-btn");
      if(!btn) return;
      const timeLeft = endTime - now;

      if(timeLeft<=0){
        btn.disabled=false;
        btn.textContent="⚔️ Execute";
        btn.style.opacity="1";
        btn.style.cursor="pointer";
      }else{
        btn.disabled=true;
        btn.textContent="⏳ Waiting";
        btn.style.opacity="0.4";
        btn.style.cursor="not-allowed";
      }
    });

    refreshBlockMarkings();
  }, 1000);
}

function refreshBlockMarkings(){
   document.querySelectorAll(".block-card").forEach(card=>{
   card.classList.remove("attacking","executable");
  });

  const now = Math.floor(Date.now()/1000);

  userAttacks.forEach(attack=>{
    const card = document.querySelector(`.block-card[data-tokenid="${attack.targetTokenId}"]`);
    if(!card) return;

    if(attack.endTime <= now) card.classList.add("executable");
    else card.classList.add("attacking");
  });
}

/* ==================== DISMISS ==================== */
function dismissAttackById(attackId) {
  const key = "dismissedAttacks";
  const arr = JSON.parse(localStorage.getItem(key) || "[]");
  if (!arr.includes(attackId)) arr.push(attackId);
  localStorage.setItem(key, JSON.stringify(arr));
}

function loadDismissedAttacks() {
  return new Set(JSON.parse(localStorage.getItem("dismissedAttacks") || "[]"));
}

/* ==================== EXECUTE ATTACK (PiratesV4) ==================== */
async function executeAttack(attack){
  const msgDiv = document.getElementById("attackMessage");
  if(!msgDiv) return;

  msgDiv.innerHTML = '<span class="success">⏳ Checking target resources...</span>';
  try {
    if (!piratesV4Contract) throw new Error("Connect wallet first.");

    // Farming-Status prüfen
    const farm = await farmingV4Contract.farms(attack.targetTokenId);
    if (!farm.isActive) {
      msgDiv.innerHTML = '<span class="error">❌ Farming inactive – owner stopped.</span>';
      return;
    }

    // Pending mit safeGetAllPending prüfen
    const pendingInfo = await safeGetAllPending(attack.targetTokenId);
    const hasLoot = pendingInfo.ok &&
                    pendingInfo.pending &&
                    pendingInfo.pending.length > attack.resource &&
                    isGtZero(pendingInfo.pending[attack.resource]);

    if (!hasLoot) {
      msgDiv.innerHTML = '<span class="error">❌ No loot – owner claimed or wrong resource.</span>';
      return;
    }

    // Simulation der executeAttack
    try {
      await piratesV4Contract.callStatic.executeAttack(
        attack.targetTokenId,
        attack.attackIndex
      );
    } catch (simError) {
      console.error("executeAttack simulation failed:", simError);
      msgDiv.innerHTML = `<span class="error">❌ Execute would fail: ${simError.reason || simError.message}</span>`;
      return;
    }

    msgDiv.innerHTML = '<span class="success">⏳ Executing attack...</span>';

    const tx = await piratesV4Contract.executeAttack(
      attack.targetTokenId,
      attack.attackIndex,
      { gasLimit: 350000 }
    );

    msgDiv.innerHTML = '<span class="success">⏳ Confirming transaction...</span>';
    await tx.wait();

    msgDiv.innerHTML = '<span class="success">✅ Attack executed!</span>';

    if (attack.id) dismissAttackById(attack.id);

    await loadUserAttacks();
    await loadResourceBalancesOnchain();
    await updateBalances();
    refreshBlockMarkings();
  } catch(e){
    console.error("ExecuteAttack error:", e);
    let msg = e?.reason || e?.message || "Unknown error";
    if ((msg+"").includes("execution reverted")) {
      if (attack.id) dismissAttackById(attack.id);
      await loadUserAttacks();
      msgDiv.innerHTML = '<span class="error">❌ Attack failed – nothing to steal or contract rule blocked it.</span>';
      return;
    }
    msgDiv.innerHTML = `<span class="error">❌ ${msg}</span>`;
  }
}

/* ==================== ACTIONS ==================== */
async function revealSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const { tokenId,row,col } = selectedBlock;
  const msgDiv = document.getElementById("actionMessage");
  msgDiv.innerHTML = `<span class="success">⏳ Loading proofs...</span>`;

  try{
    const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
    if(!response.ok) throw new Error("Proofs not found");
    const proofs = await response.json();

    const formatProof = (arr) => arr.map(item=>{
      const v = (item.left ? item.left : item.right);
      return v.startsWith("0x") ? v : ("0x"+v);
    });

    const piProof  = formatProof(proofs.pi.proof);
    const phiProof = formatProof(proofs.phi.proof);

    const tx = await nftContract.revealBlock(tokenId, piProof, phiProof, proofs.pi.digit, proofs.phi.digit, { gasLimit: 500000 });
    msgDiv.innerHTML = `<span class="success">⏳ Revealing...</span>`;
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Block revealed! 🎉</span>`;
    await loadUserBlocks();
    await selectBlock(tokenId,row,col);
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function startFarmingSelected(){
  if(!selectedBlock) return alert("No block selected.");
  await startFarmingV4(selectedBlock.tokenId, "actionMessage");
  await loadUserBlocks();
  await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
}

async function stopFarmingSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const st = await getFarmStatus(selectedBlock.tokenId);
    if(!st.v4Active) {
      msgDiv.innerHTML = '<span class="error">❌ Not farming on V4.</span>';
      return;
    }

    const tx = await farmingV4Contract.stopFarming(selectedBlock.tokenId, { gasLimit: 500000 });
    msgDiv.innerHTML = `<span class="success">⏳ Stopping farming...</span>`;
    await tx.wait();
    msgDiv.innerHTML = `<span class="success">⏹️ Farming stopped.</span>`;

    await loadUserBlocks();
    await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function claimSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const st = await getFarmStatus(selectedBlock.tokenId);
    if(!st.v4Active) {
      msgDiv.innerHTML = '<span class="error">❌ Not farming on V4.</span>';
      return;
    }

    const pendingInfo = await safeGetAllPending(selectedBlock.tokenId);
    let hasAnything = false;
    if (pendingInfo.ok && pendingInfo.pending && pendingInfo.pending.length !== undefined) {
      for (let i = 0; i < pendingInfo.pending.length; i++) {
        if (isGtZero(pendingInfo.pending[i])) {
          hasAnything = true;
          break;
        }
      }
    }
    if (!hasAnything) {
      msgDiv.innerHTML = '<span class="error">❌ Nothing to claim.</span>';
      return;
    }

    const tx = await farmingV4Contract.claimResources(selectedBlock.tokenId, { gasLimit: 600000 });
    msgDiv.innerHTML = `<span class="success">⏳ Claiming resources...</span>`;
    await tx.wait();
    msgDiv.innerHTML = `<span class="success">💰 Resources claimed!</span>`;
    await loadResourceBalancesOnchain();
    await loadUserBlocks();
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function attack(){
  const attackRowEl = document.getElementById("attackRow");
  const attackColEl = document.getElementById("attackCol");
  const msgDiv = document.getElementById("attackMessage");

  if (!attackRowEl || !attackColEl) {
    if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ Attack inputs not found.</span>`;
    return;
  }

  const targetRow = parseInt(attackRowEl.value, 10);
  const targetCol = parseInt(attackColEl.value, 10);

  if (!Number.isFinite(targetRow) || !Number.isFinite(targetCol)) {
    alert("Enter target coordinates");
    return;
  }

  const targetTokenId = targetRow * 2048 + targetCol;

  try {
    const owner = await nftContract.ownerOf(targetTokenId);
    if (owner.toLowerCase() === userAddress.toLowerCase()) {
      msgDiv.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
      return;
    }
  } catch(e) {
    msgDiv.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
    return;
  }

  const balance = await nftContract.balanceOf(userAddress);
  if (balance.toNumber() === 0) {
    alert("You need a block to attack from");
    return;
  }

  const attackerTokenId = selectedBlock
    ? parseInt(selectedBlock.tokenId, 10)
    : (await nftContract.tokenOfOwnerByIndex(userAddress, 0)).toNumber();

  const resource = parseInt(document.getElementById("attackResourceSelect").value, 10);
  if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
    msgDiv.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
    return;
  }

  try {
    msgDiv.innerHTML = `<span class="success">⏳ Checking attack rules...</span>`;

    const [canAttack, remainingAttacks, attackTime] = await Promise.all([
      safeCanAttack(userAddress, targetTokenId),
      safeGetRemainingAttacksToday(userAddress),
      safeGetAttackTime(attackerTokenId, targetTokenId)
    ]);

    if (!canAttack) {
      msgDiv.innerHTML = `<span class="error">❌ Contract says this target cannot be attacked right now.</span>`;
      return;
    }

    if (remainingAttacks !== null && remainingAttacks <= 0) {
      msgDiv.innerHTML = `<span class="error">❌ No attacks remaining today.</span>`;
      return;
    }

    if (attackTime === null) {
      msgDiv.innerHTML = `<span class="error">❌ Attack path/time unavailable.</span>`;
      return;
    }

    try {
      await piratesV4Contract.callStatic.startAttack(attackerTokenId, targetTokenId, resource);
    } catch (simError) {
      console.error("startAttack simulation failed:", simError);
      msgDiv.innerHTML = `<span class="error">❌ Attack would fail: ${simError.reason || simError.message}</span>`;
      return;
    }

    msgDiv.innerHTML = `
      <span class="success">
        ⏳ Starting attack...<br>
        Travel time: ${formatDuration(attackTime)}<br>
        Remaining today: ${remainingAttacks}
      </span>
    `;

    const tx = await piratesV4Contract.startAttack(
      attackerTokenId,
      targetTokenId,
      resource,
      { gasLimit: 450000 }
    );

    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack started! Check back later.</span>`;

    localStorage.setItem(`attack_${targetTokenId}`, JSON.stringify({
      targetTokenId,
      resource,
      startTime: Math.floor(Date.now()/1000)
    }));

    await loadUserAttacks();
    refreshBlockMarkings();
  } catch(e) {
    console.error("startAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

async function protect(){
  const tokenId = parseInt(document.getElementById("protectTokenId").value);
  const level = parseInt(document.getElementById("protectLevel").value);
  if(isNaN(tokenId)||isNaN(level)) return alert("Invalid input");

  const msgDiv = document.getElementById("protectMessage");
  msgDiv.innerHTML = `<span class="success">⏳ Hiring mercenaries...</span>`;

  try{
    const owner = await nftContract.ownerOf(tokenId);
    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
      return;
    }

    const cost = level * 10;
    const amount = ethers.utils.parseEther(cost.toString());
    const allowance = await inpiContract.allowance(userAddress, MERCENARY_V2_ADDRESS);
    if(allowance.lt(amount)){
      const approveTx = await inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
      await approveTx.wait();
    }
    const tx = await mercenaryV2Contract.hireMercenaries(tokenId, level, { gasLimit: 400000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Protection active for 3.14 days.</span>`;
    await loadUserBlocks();
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

/* ==================== EXCHANGE ==================== */
async function exchangeINPI(){
  const msgDiv = document.getElementById("exchangeMessage");
  if (!userAddress) { msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`; return; }

  const inpiAmount = parseFloat(document.getElementById("inpiAmount").value);
  if (isNaN(inpiAmount) || inpiAmount <= 0) return alert("Invalid amount");

  const amountWei = ethers.utils.parseEther(inpiAmount.toString());
  msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;

  try {
    const inpiBal = await inpiContract.balanceOf(userAddress);
    if (inpiBal.lt(amountWei)) throw new Error("Insufficient INPI balance");

    const allowance = await inpiContract.allowance(userAddress, PITRONE_ADDRESS);
    if (allowance.lt(amountWei)) {
      msgDiv.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
      const approveTx = await inpiContract.approve(PITRONE_ADDRESS, amountWei);
      await approveTx.wait();
    }

    const tx = await pitroneContract.exchangeINPI(amountWei, { gasLimit: 400000 });
    msgDiv.innerHTML = `<span class="success">⏳ Transaction sent...</span>`;
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
    await updateBalances();
    await updatePoolInfo();
  } catch (e) {
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function exchangePit(){
  const msgDiv = document.getElementById("exchangeMessage");
  if (!userAddress) { msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`; return; }

  const pitAmount = parseFloat(document.getElementById("pitAmount").value);
  if (isNaN(pitAmount) || pitAmount <= 0) return alert("Invalid amount");

  const amountWei = ethers.utils.parseEther(pitAmount.toString());
  msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;

  try {
    const allowance = await pitroneContract.allowance(userAddress, PITRONE_ADDRESS);

    const tx = await pitroneContract.exchangePitrone(amountWei, { gasLimit: 400000 });
    msgDiv.innerHTML = `<span class="success">⏳ Transaction sent...</span>`;
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
    await updateBalances();
    await updatePoolInfo();
  } catch (e) {
    msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

/* ==================== WALLET ==================== */
async function connectWallet(){
  if(!window.ethereum) return alert("Please install MetaMask!");
  if(isConnecting) return;
  if(userAddress) return;

  isConnecting = true;

  try{
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    if(network.chainId !== 8453){
      try{
        await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId:"0x2105" }] });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
      }catch(e){
        throw e;
      }
    }

    nftContract          = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
    farmingV4Contract    = new ethers.Contract(FARMING_V4_ADDRESS, FARMING_V4_ABI, signer);
    piratesV4Contract    = new ethers.Contract(PIRATES_V4_ADDRESS, PIRATES_V4_ABI, signer);
    mercenaryV2Contract  = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, signer);
    partnershipV2Contract= new ethers.Contract(PARTNERSHIP_V2_ADDRESS, PARTNERSHIP_V2_ABI, signer);
    inpiContract         = new ethers.Contract(INPI_ADDRESS, INPI_ABI, signer);
    pitroneContract      = new ethers.Contract(PITRONE_ADDRESS, PITRONE_ABI, signer);
    resourceTokenContract= new ethers.Contract(RESOURCE_TOKEN_ADDRESS, RESOURCE_TOKEN_ABI, signer);

    safeHTML("walletStatus","🟢 Connected");
    safeHTML("walletAddress", shortenAddress(userAddress));
    document.getElementById("connectWallet").innerText = "Wallet Connected";

    initAttackResourceSelect();

    await updateBalances();
    await updatePoolInfo();
    await loadResourceBalancesOnchain();
    await loadUserBlocks();

    // Attacks leicht verzögert laden
    setTimeout(() => {
      loadUserAttacks();
    }, 1500);

    if(!attacksPoller){
      attacksPoller = setInterval(async ()=>{
        try {
          await loadUserAttacks();
          refreshBlockMarkings();
        } catch(e) {
          console.warn("attacks poll failed", e);
        }
      }, 45000);
    }

  }catch(e){
    console.error(e);
    alert("Connection error: "+e.message);
    userAddress = null;
  }finally{
    isConnecting = false;
  }
}

/* ==================== RANDOM FREE BLOCK ==================== */
async function findRandomFreeBlock(){
  const msgDiv = document.getElementById("mintMessage");
  if(!userAddress || !nftContract){
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
    return;
  }

  if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Searching a free block...</div>`;

  const MAX_ATTEMPTS = 80;

  for(let attempt=0; attempt<MAX_ATTEMPTS; attempt++){
    const row = Math.floor(Math.random() * (MAX_ROW + 1));
    const col = Math.floor(Math.random() * (2 * row + 1));
    const tokenId = row * 2048 + col;

    try{
      await nftContract.ownerOf(tokenId);
    }catch(e){
      document.getElementById("row").value = row;
      document.getElementById("col").value = col;
      if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">✅ Free block found: Row ${row}, Col ${col}. You can mint now.</div>`;
      return;
    }
  }

  if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Could not find a free block fast. Try again or pick manually.</div>`;
}

/* ==================== MINT ==================== */
async function mintBlock(){
  const msgDiv = document.getElementById("mintMessage");

  if(!userAddress || !nftContract){
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
    return;
  }

  const row = parseInt(document.getElementById("row").value, 10);
  const col = parseInt(document.getElementById("col").value, 10);

  if(Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > MAX_ROW || col < 0 || col > (2*row)){
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Invalid coordinates.</div>`;
    return;
  }

  const tokenId = row * 2048 + col;

  try{
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Checking block availability...</div>`;

    try{
      await nftContract.ownerOf(tokenId);
      if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ This block is already minted.</div>`;
      return;
    }catch(e){
      // ok: not minted
    }

    let tx;

    if(selectedPayment === "eth"){
      if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with ETH...</div>`;
      tx = await nftContract.mintWithETH(row, col, {
        value: ethers.utils.parseEther(PRICE_ETH)
      });

    }else if(selectedPayment === "inpi"){
      if(!inpiContract){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ INPI contract not ready. Connect wallet again.</div>`;
        return;
      }

      const amount = ethers.utils.parseEther(PRICE_INPI);

      const bal = await inpiContract.balanceOf(userAddress);
      if(bal.lt(amount)){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance.</div>`;
        return;
      }

      const allowance = await inpiContract.allowance(userAddress, NFT_ADDRESS);
      if(allowance.lt(amount)){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Approving INPI...</div>`;
        const approveTx = await inpiContract.approve(NFT_ADDRESS, amount);
        await approveTx.wait();
      }

      if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with INPI...</div>`;
      tx = await nftContract.mintWithINPI(row, col);

    }else if(selectedPayment === "mixed"){
      if(!inpiContract){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ INPI contract not ready. Connect wallet again.</div>`;
        return;
      }

      const ethAmount  = ethers.utils.parseEther(PRICE_ETH_MIXED);
      const inpiAmount = ethers.utils.parseEther(PRICE_INPI_MIXED);

      const bal = await inpiContract.balanceOf(userAddress);
      if(bal.lt(inpiAmount)){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance for mixed payment.</div>`;
        return;
      }

      const allowance = await inpiContract.allowance(userAddress, NFT_ADDRESS);
      if(allowance.lt(inpiAmount)){
        if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Approving INPI...</div>`;
        const approveTx = await inpiContract.approve(NFT_ADDRESS, inpiAmount);
        await approveTx.wait();
      }

      if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting (Mixed)...</div>`;
      tx = await nftContract.mintMixed(row, col, { value: ethAmount });

    }else{
      if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Unknown payment method.</div>`;
      return;
    }

    if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Transaction sent: ${tx.hash.slice(0,10)}...</div>`;
    await tx.wait();

    if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">✅ Block minted! 🎉</div>`;

    await updateBalances();
    await loadResourceBalancesOnchain();
    await loadUserBlocks();

    setTimeout(() => {
      loadUserAttacks();
    }, 1200);

    const attackRowEl = document.getElementById("attackRow");
    const attackColEl = document.getElementById("attackCol");
    if (attackRowEl?.value && attackColEl?.value) {
      scheduleAttackDropdownRefresh();
    }

  }catch(e){
    console.error("Mint error:", e);
    const msg = (e && e.message) ? e.message : "Unknown error";
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ ${msg}</div>`;
  }
}

/* ==================== EVENT LISTENERS ==================== */
document.getElementById("connectWallet")?.addEventListener("click", connectWallet);
document.getElementById("attackBtn")?.addEventListener("click", attack);
document.getElementById("protectBtn")?.addEventListener("click", protect);
document.getElementById("revealBtn")?.addEventListener("click", revealSelected);
document.getElementById("farmingStartBtn")?.addEventListener("click", startFarmingSelected);
document.getElementById("farmingStopBtn")?.addEventListener("click", stopFarmingSelected);
document.getElementById("claimBtn")?.addEventListener("click", claimSelected);
document.getElementById("exchangeInpiBtn")?.addEventListener("click", exchangeINPI);
document.getElementById("exchangePitBtn")?.addEventListener("click", exchangePit);
document.getElementById("randomBlockBtn")?.addEventListener("click", findRandomFreeBlock);
document.getElementById("mintBtn")?.addEventListener("click", mintBlock);

document.getElementById("attackRow")?.addEventListener("input", scheduleAttackDropdownRefresh);
document.getElementById("attackCol")?.addEventListener("input", scheduleAttackDropdownRefresh);

document.querySelectorAll('input[name="payment"]').forEach(radio=>{
  radio.addEventListener("change",(e)=>{ selectedPayment = e.target.value; });
});

if(window.ethereum && window.ethereum.selectedAddress){
  connectWallet();
}
