/* =========================================================
   INPINITY MAP – V5 ONLY
   - FarmingV5 und PiratesV5 als einzige aktive Contracts
   - Subgraph nur für V5 Entities (farmV5S, attackV5S)
   - Preview-Funktionen für alle Aktionen
   - Keine V4-Reads mehr
   ========================================================= */

/* ==================== KONFIGURATION (NUR V5) ==================== */
const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
const BASE_BLOCK_SIZE = 24;

// ====== V5 Contracts ======
const NFT_ADDRESS = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";
const RESOURCE_TOKEN_ADDRESS = "0x71E76a6065197acdd1a4d6B736712F80D1Fd3D8b";
const INPI_ADDRESS = "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D";
const PITRONE_ADDRESS = "0x7240Ec5B3Ba944888E186c74D0f8B4F5F71c9AE8";

const FARMING_V5_ADDRESS = "0xe0246dC9c553E9cD741013C21BD217912a9DA0B2";
const PIRATES_V5_ADDRESS = "0xe76b03A848dE22DdbbF34994e650d2E887426879";
const MERCENARY_V2_ADDRESS = "0xFEa09ccA75dbc63cc8053739A61777Bd13fC6Bc2";
const PARTNERSHIP_V2_ADDRESS = "0xb18323efE4Cc8c36e10D664E287b4e2c82Fe3ad9";

/* ==================== ABIs (V5) ==================== */
const NFT_ABI = [
  "function revealBlock(uint256 tokenId, bytes32[] piProof, bytes32[] phiProof, uint8 piDigit, uint8 phiDigit) external",
  "function calculateRarity(uint256 tokenId) view returns (uint8)",
  "function getBlockPosition(uint256 tokenId) view returns (uint256 row, uint256 col)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)"
];

const FARMING_V5_ABI = [
  "function startFarming(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external",
  "function claimResources(uint256 tokenId) external",
  "function buyBoost(uint256 tokenId, uint256 daysAmount) external",
  "function getFarmState(uint256 tokenId) view returns ((uint256 startTime, uint256 lastAccrualTime, uint256 lastClaimTime, uint256 boostExpiry, uint256 stopTime, bool isActive))",
  "function getFarmStatusCode(uint256 tokenId) view returns (uint8)",
  "function getPending(uint256 tokenId, uint8 resourceId) view returns (uint256)",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])",
  "function getClaimableResources(uint256 tokenId) view returns (uint8[] ids, uint256[] amounts)",
  "function getBoostMultiplier(uint256 tokenId) view returns (uint256)",
  "function isClaimMature(uint256 tokenId) view returns (bool)",
  "function secondsUntilClaimable(uint256 tokenId) view returns (uint256)",
  "function previewClaim(uint256 tokenId) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining)"
];

const PIRATES_V5_ABI = [
  "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) external",
  "function executeAttack(uint256 targetTokenId, uint256 attackIndex) external",
  "function previewAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining)",
  "function previewExecuteAttack(uint256 targetTokenId, uint256 attackIndex) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining)",
  "function canAttackTarget(address attacker, uint256 targetTokenId) view returns (bool)",
  "function getRemainingAttacksToday(address attacker) view returns (uint8)",
  "function getAttackTime(uint256 attackerTokenId, uint256 targetTokenId) view returns (uint256)",
  "function getAttackCount(uint256 targetTokenId) view returns (uint256)",
  "function getAttack(uint256 targetTokenId, uint256 index) view returns (address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed, bool cancelled)",
  "function getEffectiveStealPercent(uint256 attackerTokenId, uint256 protectionLevel) view returns (uint256)",
  "function hasPirateBoost(uint256 tokenId) view returns (bool)",
  "function getPirateBoostExpiry(uint256 tokenId) view returns (uint256)"
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
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const RESOURCE_TOKEN_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
];

/* ==================== STATE ==================== */
let provider, signer, userAddress = null;
let readOnlyProvider, nftReadOnlyContract;

let tokens = {}; // jedes Token enthält: owner, revealed, farmActive, protectionActive, partnerActive, rarity (optional)
let userResources = [];
let selectedTokenId = null;
let selectedTokenOwner = null;

let userAttacks = [];
let attacksTicker = null;
let attacksPoller = null;
let dataPoller = null;

let nftContract, farmingV5Contract, piratesV5Contract, mercenaryV2Contract, partnershipV2Contract;
let inpiContract, pitroneContract, resourceTokenContract;

const canvas = document.getElementById("pyramidCanvas");
const ctx = canvas?.getContext("2d");
const container = document.getElementById("canvasContainer");
const tooltip = document.getElementById("tooltip");

const blockDetailDiv = document.getElementById("blockDetail");
const actionPanel = document.getElementById("actionPanel");
const ownerActionsDiv = document.getElementById("ownerActions");
const protectionInput = document.getElementById("protectionInput");
const attackInput = document.getElementById("attackInput");
const actionMessage = document.getElementById("actionMessage");
const userResourcesDiv = document.getElementById("userResources");

let scale = 1.0;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let pinchStartDist = 0;

// Für mobile Touch-Unterscheidung
let touchStartX = 0, touchStartY = 0;
let touchMoved = false;
const MOVE_THRESHOLD = 10; // Pixel

// Request-ID für Attack-Dropdown
let attackDropdownRequestId = 0;
let attackDropdownTimer = null;

// Schutz vor Mehrfach-Connect
let isConnecting = false;

const resourceNames = ["Oil","Lemons","Iron","Gold","Platinum","Copper","Crystal","Obsidian","Mysterium","Aether"];
const rarityNames = ["Bronze","Silver","Gold","Platinum","Diamond"];
const rarityClass = ["rarity-bronze","rarity-silver","rarity-gold","rarity-platinum","rarity-diamond"];

const rarityColors = [
  "#cd7f32", // Bronze
  "#c0c0c0", // Silber
  "#ffd700", // Gold
  "#e5e4e2", // Platin
  "#b9f2ff"  // Diamant
];

/* ==================== HELFER ==================== */
function populateAttackResourceSelect() {
  const select = document.getElementById("attackResource");
  if (!select) return;
  select.innerHTML = "";
  for (let i = 0; i < resourceNames.length; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = resourceNames[i];
    select.appendChild(option);
  }
}
populateAttackResourceSelect();

function shortenAddress(addr) { return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : ""; }
function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m";
  return Math.floor(seconds / 3600) + "h";
}
function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function getAttackStorageKey(targetTokenId) { return `attack_${targetTokenId}`; }

// BigInt‑sichere Hilfsfunktion (ethers v5 & v6)
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

/* ==================== SAFE FARM‑HELPER (V5) ==================== */
async function safeGetFarm(tokenId) {
  try {
    const f = await farmingV5Contract.getFarmState(tokenId);
    return {
      ok: true,
      startTime: Number(f.startTime ?? 0),
      lastAccrualTime: Number(f.lastAccrualTime ?? 0),
      lastClaimTime: Number(f.lastClaimTime ?? 0),
      boostExpiry: Number(f.boostExpiry ?? 0),
      stopTime: Number(f.stopTime ?? 0),
      isActive: !!f.isActive
    };
  } catch (e) {
    console.warn(`getFarmState() failed for token ${tokenId}`, e);
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

/* ==================== SAFE GETALLPENDING (V5) ==================== */
async function safeGetAllPending(tokenId) {
  try {
    const pending = await farmingV5Contract.getAllPending(tokenId);
    return { ok: true, pending, reason: "ok" };
  } catch (e) {
    console.warn(`getAllPending failed for token ${tokenId}`, e);
    return { ok: false, pending: null, reason: "pending-failed" };
  }
}

/* ==================== SAFE PIRATES‑HELPER (V5) ==================== */
async function safeCanAttack(attackerAddress, targetTokenId) {
  try {
    if (!attackerAddress || !targetTokenId) return false;
    return await piratesV5Contract.canAttackTarget(attackerAddress, targetTokenId);
  } catch (e) {
    console.warn(`canAttackTarget failed for ${targetTokenId}`, e);
    return false;
  }
}

async function safeGetRemainingAttacksToday(attackerAddress) {
  try {
    const val = await piratesV5Contract.getRemainingAttacksToday(attackerAddress);
    return Number(val.toString());
  } catch (e) {
    console.warn("getRemainingAttacksToday failed", e);
    return null;
  }
}

async function safeGetAttackTime(attackerTokenId, targetTokenId) {
  try {
    const val = await piratesV5Contract.getAttackTime(attackerTokenId, targetTokenId);
    return Number(val.toString());
  } catch (e) {
    console.warn("getAttackTime failed", e);
    return null;
  }
}

/* ==================== SUBGRAPH HELPERS (über Worker) ==================== */
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
          console.warn(`Subgraph 429, retry ${i+1}/${retries} after ${waitTime}ms`);
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
    const query = `{ ${fieldName}(first:${pageSize}, skip:${skip}${where ? ", where: " + where : ""}) { ${subfields} } }`;
    const data = await fetchSubgraph(query);
    const items = data[fieldName];
    if (!items || items.length === 0) break;
    all = all.concat(items);
    if (items.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

function getProduction(rarity, row) {
  const production = {};
  if (rarity === 0) { production.OIL=10; production.LEMONS=5; production.IRON=3; }
  else if (rarity === 1) { production.OIL=20; production.LEMONS=10; production.IRON=6; production.GOLD=1; }
  else if (rarity === 2) { production.OIL=30; production.LEMONS=15; production.IRON=9; production.GOLD=2; production.PLATINUM=1; }
  else if (rarity === 3) { production.OIL=40; production.LEMONS=20; production.IRON=12; production.GOLD=3; production.PLATINUM=2; production.CRYSTAL=1; }
  else if (rarity === 4) { production.OIL=60; production.LEMONS=30; production.IRON=18; production.GOLD=5; production.PLATINUM=3; production.CRYSTAL=2; production.MYSTERIUM=1; if (row === 0) production.AETHER=1; }
  return production;
}

/* ==================== LOAD ATTACKS (V5) ==================== */
async function loadUserAttacks() {
  if (!userAddress) return;
  try {
    const where = `{ attacker: "${userAddress.toLowerCase()}" }`;
    const attacks = await fetchAllWithPagination(
      "attackV5S",
      "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed cancelled protectionLevel effectiveStealPercent stolenAmount",
      where
    );
    
    userAttacks = attacks.map(a => ({
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
    }));
    
    // Nur aktive, nicht erledigte Angriffe anzeigen
    userAttacks = userAttacks.filter(a => !a.executed && !a.cancelled);
    
    displayUserAttacks();
    drawPyramid();
    startAttacksTicker();
  } catch (e) {
    console.error("Failed to load attacks:", e);
  }
}

function displayUserAttacks() {
  const container = document.getElementById("userAttacksList");
  if (!container) return;
  if (!userAddress) {
    container.innerHTML = '<p style="color:#98a9b9;">Connect wallet</p>';
    return;
  }
  if (userAttacks.length === 0) {
    container.innerHTML = '<p style="color:#98a9b9;">No active attacks</p>';
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  let html = "";
  userAttacks.forEach(attack => {
    const timeLeft = attack.endTime - now;
    const ready = timeLeft <= 0;
    html += `
      <div class="attack-item">
        <span>#${attack.targetTokenId} (${resourceNames[attack.resource]})</span>
        <span class="attack-status" data-endtime="${attack.endTime}" style="${ready ? "color:#51cf66;" : ""}">
          ${ready ? "Ready" : "⏳ " + formatTime(timeLeft)}
        </span>
        <button class="execute-btn"
          data-attackid="${attack.id}"
          data-targetid="${attack.targetTokenId}"
          data-attackindex="${attack.attackIndex}"
          data-resource="${attack.resource}"
          ${ready ? "" : "disabled"}
        >${ready ? "⚔️" : "⏳"}</button>
      </div>
    `;
  });
  container.innerHTML = html;
  container.querySelectorAll(".execute-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const attackId = btn.dataset.attackid;
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      const resource = parseInt(btn.dataset.resource, 10);
      await executeAttack({ id: attackId, targetTokenId, attackIndex, resource });
    });
  });
}

function startAttacksTicker() {
  if (attacksTicker) return;
  attacksTicker = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll(".attack-status").forEach(el => {
      const endTime = parseInt(el.dataset.endtime || "0", 10);
      if (!endTime) return;
      const timeLeft = endTime - now;
      if (timeLeft <= 0) {
        el.textContent = "Ready";
        el.style.color = "#51cf66";
      } else {
        el.textContent = "⏳ " + formatTime(timeLeft);
        el.style.color = "";
      }
    });
    document.querySelectorAll(".execute-btn").forEach(btn => {
      const endTimeEl = btn.parentElement?.querySelector(".attack-status");
      const endTime = endTimeEl ? parseInt(endTimeEl.dataset.endtime || "0", 10) : 0;
      const timeLeft = endTime - now;
      if (timeLeft <= 0) {
        btn.disabled = false;
        btn.textContent = "⚔️";
      } else {
        btn.disabled = true;
        btn.textContent = "⏳";
      }
    });
    drawPyramid();
  }, 1000);
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

/* ==================== EXECUTE ATTACK (V5) ==================== */
async function executeAttack(attack) {
  const msgDiv = actionMessage;
  if (!msgDiv) return;

  msgDiv.innerHTML = '<span class="success">⏳ Checking attack...</span>';

  try {
    if (!piratesV5Contract) throw new Error("Connect wallet first.");

    // Preview Execute Attack
    const preview = await piratesV5Contract.previewExecuteAttack(
      attack.targetTokenId,
      attack.attackIndex
    );

    if (!preview.allowed) {
      msgDiv.innerHTML = `<span class="error">❌ Execute not allowed. Code: ${preview.code}</span>`;
      return;
    }

    msgDiv.innerHTML = '<span class="success">⏳ Executing attack...</span>';
    const tx = await piratesV5Contract.executeAttack(
      attack.targetTokenId,
      attack.attackIndex,
      { gasLimit: 350000 }
    );
    
    msgDiv.innerHTML = '<span class="success">⏳ Confirming...</span>';
    await tx.wait();
    
    msgDiv.innerHTML = '<span class="success">✅ Attack executed!</span>';

    localStorage.removeItem(getAttackStorageKey(attack.targetTokenId));
    if (attack.id) dismissAttackById(attack.id);
    
    await loadUserAttacks();
    await loadUserResources();
    await loadData();
  } catch (e) {
    console.error("executeAttack error:", e);
    let msg = e?.reason || e?.message || "Unknown error";
    msgDiv.innerHTML = `<span class="error">❌ ${msg}</span>`;
  }
}

/* ==================== LOAD MAP DATA (V5 Subgraph + Rarity) ==================== */
async function loadData() {
  try {
    const tokenItems = await fetchAllWithPagination(
      "tokens",
      "id owner { id } revealed"
    ).catch(() => []);

    tokens = {};
    tokenItems.forEach(t => {
      tokens[t.id] = {
        owner: t.owner ? t.owner.id : null,
        revealed: !!t.revealed,
        farmActive: false,
        protectionActive: false,
        partnerActive: false,
        rarity: null,
        farmStartTime: 0,
        lastClaimTime: 0,
        boostExpiry: 0
      };
    });

    const blockRevealedItems = await fetchAllWithPagination(
      "blockRevealeds",
      "tokenId rarity"
    ).catch(() => []);
    blockRevealedItems.forEach(br => {
      const tokenId = br.tokenId;
      if (tokens[tokenId]) {
        tokens[tokenId].rarity = parseInt(br.rarity, 10);
      }
    });

    // V5 Farms laden
    const farmV5Items = await fetchAllWithPagination(
      "farmV5S",
      "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
      `{ active: true }`
    ).catch(() => []);

    farmV5Items.forEach(f => {
      if (tokens[f.id]) {
        tokens[f.id].farmActive = !!f.active;
        tokens[f.id].farmStartTime = parseInt(f.startTime, 10) || 0;
        tokens[f.id].lastClaimTime = parseInt(f.lastClaimTime, 10) || 0;
        tokens[f.id].boostExpiry = parseInt(f.boostExpiry, 10) || 0;
        tokens[f.id].farmOwner = f.owner;
      }
    });

    const protectionItems = await fetchAllWithPagination(
      "protections",
      "id active",
      `{ active: true }`
    ).catch(() => []);
    protectionItems.forEach(p => { if (tokens[p.id]) tokens[p.id].protectionActive = !!p.active; });

    const partnerItems = await fetchAllWithPagination(
      "partnerships",
      "id active",
      `{ active: true }`
    ).catch(() => []);
    partnerItems.forEach(p => { if (tokens[p.id]) tokens[p.id].partnerActive = !!p.active; });

    drawPyramid();
  } catch (err) {
    console.error("Fehler beim Laden:", err);
  }
}

/* ==================== RESSOURCEN ==================== */
async function loadUserResources() {
  if (!userAddress) return;
  await loadUserResourcesOnChain();
}

async function loadUserResourcesOnChain() {
  if (!userAddress || !resourceTokenContract) return;
  try {
    const ids = [0,1,2,3,4,5,6,7,8,9];
    const accounts = ids.map(() => userAddress);
    const balances = await resourceTokenContract.balanceOfBatch(accounts, ids);
    userResources = ids
      .map((id, idx) => ({
        resourceId: id,
        amount: balances[idx]
      }))
      .filter(r => isGtZero(r.amount));
    updateUserResourcesDisplay();
  } catch (err) {
    console.error("On-chain resource fetch failed:", err);
    userResources = [];
    updateUserResourcesDisplay();
  }
}

function updateUserResourcesDisplay() {
  if (!userResourcesDiv) return;
  if (!userAddress) {
    userResourcesDiv.innerHTML = '<p style="color:#98a9b9;">Connect wallet</p>';
    return;
  }
  if (!userResources || userResources.length === 0) {
    userResourcesDiv.innerHTML = '<p style="color:#98a9b9;">No resources</p>';
    return;
  }
  userResources.sort((a, b) => a.resourceId - b.resourceId);
  let html = "";
  for (const r of userResources) {
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

/* ==================== ZEICHNEN ==================== */
function drawPyramid() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const blockSize = BASE_BLOCK_SIZE;
  const now = Math.floor(Date.now() / 1000);
  for (let row = 0; row < 100; row++) {
    const blocksInRow = 2 * row + 1;
    const y = row * blockSize;
    for (let col = 0; col < blocksInRow; col++) {
      const tokenIdNum = row * 2048 + col;
      const tokenId = String(tokenIdNum);
      const token = tokens[tokenId];
      const x = (col - row) * blockSize;

      let fillColor = "#3a4048";
      let strokeColor = null;
      let lineWidth = 0;

      if (token && token.owner) {
        if (token.revealed && token.rarity !== null && token.rarity >= 0 && token.rarity <= 4) {
          fillColor = rarityColors[token.rarity];
        } else {
          fillColor = token.revealed ? "#c9a959" : "#2e7d5e";
        }
        if (userAddress && token.owner.toLowerCase() === userAddress.toLowerCase()) {
          fillColor = "#9b59b6";
        }

        const attack = userAttacks.find(a => String(a.targetTokenId) === tokenId);
        if (attack) {
          if (attack.endTime <= now) { strokeColor = "#e74c3c"; lineWidth = 4; }
          else { strokeColor = "#000000"; lineWidth = 4; }
        } else {
          if (token.protectionActive) { strokeColor = "#9b59b6"; lineWidth = 3; }
          else if (token.farmActive) { strokeColor = "#3498db"; lineWidth = 3; }
        }
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, blockSize, blockSize);

      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, blockSize, blockSize);
      }

      if (token && token.partnerActive) {
        ctx.save();
        ctx.translate(x + blockSize - 8, y + 8);
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText("★", -8, 4);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function centerPyramid() {
  const totalWidth = 199 * BASE_BLOCK_SIZE;
  const totalHeight = 100 * BASE_BLOCK_SIZE;
  const scaleX = (canvas.width / totalWidth) * 0.95;
  const scaleY = (canvas.height / totalHeight) * 0.95;
  scale = Math.min(scaleX, scaleY, 1.5);
  offsetX = (canvas.width - totalWidth * scale) / 2;
  offsetY = (canvas.height - totalHeight * scale) / 2;
  drawPyramid();
}

/* ==================== ATTACK PREVIEW (V5) ==================== */
async function loadAttackPreview(attackerTokenId, targetTokenId, resourceId) {
  try {
    return await piratesV5Contract.previewAttack(attackerTokenId, targetTokenId, resourceId);
  } catch (e) {
    console.warn("previewAttack failed", e);
    return null;
  }
}

/* ==================== SIDEBAR (V5) ==================== */
async function updateSidebar(tokenId) {
  selectedTokenId = tokenId;
  const token = tokens[tokenId];
  const owner = token ? token.owner : null;
  selectedTokenOwner = owner;
  
  // Basis-Info sofort laden
  const now = Math.floor(Date.now() / 1000);
  let v5Active = false;
  let farmStartTime = 0;
  let farmAgeTxt = "-";
  let claimTxt = "-";
  let pendingTotalTxt = "-";
  let boostTxt = "-";
  
  // Farm-Status laden (sicher mit V5)
  if (farmingV5Contract && token && token.owner) {
    const farmInfo = await safeGetFarm(tokenId);
    v5Active = farmInfo.ok && farmInfo.isActive;
    farmStartTime = farmInfo.startTime || 0;

    if (v5Active && farmStartTime > 0) {
      farmAgeTxt = formatDuration(now - farmStartTime);
    }

    // Preview Claim für genaue Infos
    try {
      const preview = await farmingV5Contract.previewClaim(tokenId);
      pendingTotalTxt = preview.pendingAmount ? preview.pendingAmount.toString() : "0";
      claimTxt = preview.allowed ? "READY" : (preview.secondsRemaining > 0 ? `in ${formatDuration(Number(preview.secondsRemaining))}` : "Not ready");
    } catch (e) {
      console.warn("previewClaim failed", e);
    }

    if (farmInfo.boostExpiry && farmInfo.boostExpiry > now) {
      boostTxt = "active";
    }
  }

  // Rarity und Produktion laden
  let productionHtml = "";
  let rarityDisplay = "";
  if (token && token.owner && token.revealed && nftReadOnlyContract) {
    try {
      const tokenIdNum = parseInt(tokenId, 10);
      const row = Math.floor(tokenIdNum / 2048);
      const rarity = token.rarity !== null ? token.rarity : await nftReadOnlyContract.calculateRarity(tokenIdNum);
      const r = Number(rarity);
      rarityDisplay = `<div class="detail-row"><span class="detail-label">Rarity</span><span class="detail-value ${rarityClass[r]}">${rarityNames[r]}</span></div>`;
      const production = getProduction(r, row);
      let prodText = "";
      for (const [res, amount] of Object.entries(production)) {
        prodText += `<div class="detail-row"><span class="detail-label">${res}</span><span class="detail-value">${amount}/d</span></div>`;
      }
      productionHtml = `<div class="detail-row"><span class="detail-label">Production</span></div>${prodText}`;
    } catch (_) {}
  }

  // HTML für Block-Detail
  let detailHtml = "";
  if (token && owner) {
    detailHtml = `
      <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${tokenId}</span></div>
      <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value">${shortenAddress(owner)}</span></div>
      <div class="detail-row"><span class="detail-label">Revealed</span><span class="detail-value">${token.revealed ? "✅" : "❌"}</span></div>
      ${rarityDisplay}
      <div class="detail-row"><span class="detail-label">Farming (V5)</span><span class="detail-value">${v5Active ? "Active" : "Inactive"}</span></div>
      <div class="detail-row"><span class="detail-label">Farm age</span><span class="detail-value">${farmAgeTxt}</span></div>
      <div class="detail-row"><span class="detail-label">Boost</span><span class="detail-value">${boostTxt}</span></div>
      <div class="detail-row"><span class="detail-label">Claim-ready</span><span class="detail-value">${claimTxt}</span></div>
      <div class="detail-row"><span class="detail-label">Pending</span><span class="detail-value">${pendingTotalTxt}</span></div>
      ${productionHtml}
    `;
  } else {
    detailHtml = `<p style="color:#98a9b9;">Block #${tokenId} not minted</p>`;
  }

  if (blockDetailDiv) blockDetailDiv.innerHTML = detailHtml;
  if (actionPanel) actionPanel.style.display = "block";
  if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
  if (protectionInput) protectionInput.style.display = "none";
  if (attackInput) attackInput.style.display = "none";
  if (actionMessage) actionMessage.innerHTML = "";

  // Attack-Info-Card updaten
  const targetStatusEl = document.getElementById("attackTargetStatus");
  const travelTimeEl = document.getElementById("attackTravelTime");
  const remainingEl = document.getElementById("attackRemainingToday");
  const pendingLootEl = document.getElementById("attackPendingLoot");
  const protectionEl = document.getElementById("attackProtection");
  const stealPercentEl = document.getElementById("attackStealPercent");

  // Nur wenn Block einem anderen gehört
  if (userAddress && owner && owner.toLowerCase() !== userAddress.toLowerCase()) {
    if (attackInput) attackInput.style.display = "flex";

    // Attack-Preview für den ersten Resource-Typ laden
    const ownTokens = Object.entries(tokens).filter(([id, t]) => 
      t.owner && t.owner.toLowerCase() === userAddress.toLowerCase()
    );
    
    if (ownTokens.length > 0) {
      const attackerTokenId = parseInt(ownTokens[0][0], 10);
      const targetTokenIdNum = parseInt(tokenId, 10);
      const resourceId = 0; // Default, kann später über Dropdown geändert werden
      
      const preview = await loadAttackPreview(attackerTokenId, targetTokenIdNum, resourceId);
      
      if (preview) {
        if (targetStatusEl) targetStatusEl.innerText = preview.allowed ? "✅ Attackable" : "❌ Not attackable";
        if (travelTimeEl) travelTimeEl.innerText = formatDuration(Number(preview.travelTime || 0));
        if (remainingEl) remainingEl.innerText = String(preview.remainingAttacksToday || 0);
        if (pendingLootEl) pendingLootEl.innerText = preview.pendingAmount ? preview.pendingAmount.toString() : "0";
        if (protectionEl) protectionEl.innerText = preview.protectionLevel ? `${preview.protectionLevel}%` : "0%";
        if (stealPercentEl) stealPercentEl.innerText = preview.effectiveStealPercent ? `${preview.effectiveStealPercent}%` : "0%";
      }
    }
  } 
  // Eigener Block – Owner-Actions anzeigen
  else if (userAddress && owner && owner.toLowerCase() === userAddress.toLowerCase()) {
    let btns = "";
    if (!token.revealed) btns += `<button class="action-btn" id="revealBtn">🔓 Reveal</button>`;
    if (!v5Active) btns += `<button class="action-btn" id="startFarmBtn">🌾 Start Farming</button>`;
    else {
      btns += `<button class="action-btn" id="stopFarmBtn">⏹️ Stop</button>`;
      btns += `<button class="action-btn" id="claimBtn">💰 Claim</button>`;
    }
    if (protectionInput) protectionInput.style.display = "flex";
    if (ownerActionsDiv) ownerActionsDiv.innerHTML = btns;
  } else {
    if (actionPanel) actionPanel.style.display = "none";
  }
}

/* ==================== TX HELPER ==================== */
async function sendTx(txPromise, messageDiv, successMsg) {
  if (messageDiv) messageDiv.innerHTML = '<span class="success">⏳ Sending...</span>';
  try {
    const tx = await txPromise;
    if (messageDiv) messageDiv.innerHTML = '<span class="success">⏳ Confirming...</span>';
    await tx.wait();
    if (messageDiv) messageDiv.innerHTML = `<span class="success">✅ ${successMsg}</span>`;
    await loadData();
    if (selectedTokenId) await updateSidebar(selectedTokenId);
  } catch (err) {
    console.error(err);
    if (messageDiv) messageDiv.innerHTML = `<span class="error">❌ ${err.message || "Tx failed"}</span>`;
  }
}

/* ==================== ACTIONS (V5) ==================== */
async function handleReveal() {
  if (!selectedTokenId || !selectedTokenOwner) return;
  const tokenIdNum = parseInt(selectedTokenId, 10);
  const row = Math.floor(tokenIdNum / 2048);
  const col = tokenIdNum % 2048;
  try {
    const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
    if (!response.ok) throw new Error("Proofs not found");
    const proofs = await response.json();
    const formatProof = (arr) => arr.map(item => {
      const v = (item.left ? item.left : item.right);
      return (v || "").startsWith("0x") ? v : ("0x" + v);
    });
    const piProof = formatProof(proofs.pi.proof);
    const phiProof = formatProof(proofs.phi.proof);
    await sendTx(
      nftContract.revealBlock(selectedTokenId, piProof, phiProof, proofs.pi.digit, proofs.phi.digit, { gasLimit: 500000 }),
      actionMessage,
      "Block revealed!"
    );
  } catch (e) {
    if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function handleStartFarm() {
  if (!selectedTokenId) return;
  await sendTx(
    farmingV5Contract.startFarming(selectedTokenId, { gasLimit: 500000 }),
    actionMessage,
    "Farming started."
  );
}

async function handleStopFarm() {
  if (!selectedTokenId) return;
  await sendTx(
    farmingV5Contract.stopFarming(selectedTokenId, { gasLimit: 500000 }),
    actionMessage,
    "Farming stopped."
  );
}

async function handleClaim() {
  if (!selectedTokenId) return;

  try {
    const preview = await farmingV5Contract.previewClaim(selectedTokenId);

    if (!preview.allowed) {
      actionMessage.innerHTML = `<span class="error">❌ Claim not ready. Code: ${preview.code}</span>`;
      return;
    }

    await sendTx(
      farmingV5Contract.claimResources(selectedTokenId, { gasLimit: 600000 }),
      actionMessage,
      "Resources claimed!"
    );

    await loadUserResources();
  } catch (e) {
    actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function handleProtect() {
  if (!selectedTokenId || !userAddress) return;
  const level = parseInt(document.getElementById("protectLevel")?.value, 10);
  if (!Number.isFinite(level) || level < 0 || level > 50) return alert("Invalid level (0-50)");
  try {
    const cost = level * 10;
    const amount = ethers.parseEther(String(cost));
    const allowance = await inpiContract.allowance(userAddress, MERCENARY_V2_ADDRESS);
    if (allowance < amount) {
      if (actionMessage) actionMessage.innerHTML = '<span class="success">⏳ Approving...</span>';
      const approveTx = await inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
      await approveTx.wait();
    }
    await sendTx(
      mercenaryV2Contract.hireMercenaries(selectedTokenId, level, { gasLimit: 400000 }),
      actionMessage,
      "Protection bought!"
    );
  } catch (e) {
    if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function handleAttack() {
  if (!selectedTokenId || !userAddress) return;

  const targetToken = tokens[selectedTokenId];
  if (!targetToken || !targetToken.owner) {
    actionMessage.innerHTML = '<span class="error">❌ Target block does not exist.</span>';
    return;
  }

  if (targetToken.owner.toLowerCase() === userAddress.toLowerCase()) {
    actionMessage.innerHTML = '<span class="error">❌ You cannot attack your own block.</span>';
    return;
  }

  const ownTokens = Object.entries(tokens).filter(([id, t]) => 
    t.owner && t.owner.toLowerCase() === userAddress.toLowerCase()
  );

  if (ownTokens.length === 0) {
    actionMessage.innerHTML = '<span class="error">❌ Need a block to attack from.</span>';
    return;
  }

  const attackerTokenId = parseInt(ownTokens[0][0], 10);
  const targetTokenId = parseInt(selectedTokenId, 10);
  const resource = parseInt(document.getElementById("attackResource")?.value, 10);

  try {
    // Preview Attack mit V5
    const preview = await piratesV5Contract.previewAttack(attackerTokenId, targetTokenId, resource);

    if (!preview.allowed) {
      actionMessage.innerHTML = `<span class="error">❌ Attack not allowed. Code: ${preview.code}</span>`;
      return;
    }

    actionMessage.innerHTML = `
      <span class="success">
        ⏳ Starting attack...<br>
        Travel time: ${formatDuration(Number(preview.travelTime || 0))}<br>
        Remaining today: ${Number(preview.remainingAttacksToday || 0)}
      </span>
    `;

    const tx = await piratesV5Contract.startAttack(attackerTokenId, targetTokenId, resource, {
      gasLimit: 450000
    });
    await tx.wait();

    actionMessage.innerHTML = '<span class="success">✅ Attack launched!</span>';
    localStorage.setItem(getAttackStorageKey(targetTokenId), JSON.stringify({ 
      targetTokenId, 
      resource, 
      startTime: Math.floor(Date.now() / 1000) 
    }));
    
    await loadUserAttacks();
    await loadData();
  } catch (e) {
    console.error("handleAttack error:", e);
    actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== WALLET ==================== */
async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask!");
  if (isConnecting) return;
  if (userAddress) return;

  isConnecting = true;
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    const network = await provider.getNetwork();
    if (network.chainId !== 8453n) {
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x2105",
              chainName: "Base Mainnet",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"]
            }]
          });
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          userAddress = await signer.getAddress();
        } else throw switchError;
      }
    }
    
    nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
    farmingV5Contract = new ethers.Contract(FARMING_V5_ADDRESS, FARMING_V5_ABI, signer);
    piratesV5Contract = new ethers.Contract(PIRATES_V5_ADDRESS, PIRATES_V5_ABI, signer);
    mercenaryV2Contract = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, signer);
    partnershipV2Contract = new ethers.Contract(PARTNERSHIP_V2_ADDRESS, PARTNERSHIP_V2_ABI, signer);
    inpiContract = new ethers.Contract(INPI_ADDRESS, INPI_ABI, signer);
    pitroneContract = new ethers.Contract(PITRONE_ADDRESS, PITRONE_ABI, signer);
    resourceTokenContract = new ethers.Contract(RESOURCE_TOKEN_ADDRESS, RESOURCE_TOKEN_ABI, signer);

    document.getElementById("walletAddress").innerText = shortenAddress(userAddress);
    document.getElementById("connectBtn").innerText = "Connected";

    await loadData();
    await loadUserResources();
    await loadUserAttacks();
    drawPyramid();

    if (!attacksPoller) {
      attacksPoller = setInterval(() => { loadUserAttacks(); }, 30000);
    }
    if (!dataPoller) {
      dataPoller = setInterval(() => { loadData(); }, 30000);
    }
  } catch (err) {
    console.error(err);
    alert("Connection error: " + (err?.message || err));
  } finally {
    isConnecting = false;
  }
}

async function initReadOnly() {
  readOnlyProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  nftReadOnlyContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, readOnlyProvider);
}

/* ==================== WHEEL / MOUSE / TOUCH HANDLER ==================== */
function handleWheel(e) {
  if (!canvas) return;
  e.preventDefault();
  const zoomFactor = 1.1;
  const delta = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const worldX = (mouseX - offsetX) / scale;
  const worldY = (mouseY - offsetY) / scale;
  scale = Math.max(0.2, Math.min(5, scale * delta));
  offsetX = mouseX - worldX * scale;
  offsetY = mouseY - worldY * scale;
  drawPyramid();
}

function handleMouseMove(e) {
  if (!canvas || !tooltip) return;
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - offsetX) / scale;
  const mouseY = (e.clientY - rect.top - offsetY) / scale;
  const blockSize = BASE_BLOCK_SIZE;
  let found = null;
  for (let row = 0; row < 100; row++) {
    const y = row * blockSize;
    if (mouseY < y - 5 || mouseY > y + blockSize + 5) continue;
    const minX = -row * blockSize;
    const maxX = (row + 1) * blockSize;
    if (mouseX < minX - 5 || mouseX > maxX + 5) continue;
    const col = Math.round((mouseX / blockSize) + row);
    if (col >= 0 && col <= 2 * row) { found = String(row * 2048 + col); break; }
  }
  if (found) {
    const token = tokens[found];
    let text = `<span>Block #${found}</span><br>`;
    if (token && token.owner) {
      text += `Owner: ${shortenAddress(token.owner)}<br>`;
      text += `Status: ${token.revealed ? "Revealed" : "Minted"}`;
      if (token.farmActive) text += " · Farming";
      if (token.protectionActive) text += " · Protected";
      if (token.partnerActive) text += " ⭐";
      if (token.rarity !== null) text += ` · ${rarityNames[token.rarity]}`;
      const attack = userAttacks.find(a => String(a.targetTokenId) === found);
      if (attack) {
        const now = Math.floor(Date.now() / 1000);
        if (attack.endTime <= now) text += " · 🔴 Attack ready!";
        else text += ` · ⚔️ Attacking (${formatTime(attack.endTime - now)} left)`;
      }
    } else {
      text += "Not minted";
    }
    tooltip.innerHTML = text;
    tooltip.style.opacity = 1;
    tooltip.style.left = (e.clientX + 20) + "px";
    tooltip.style.top = (e.clientY - 50) + "px";
  } else {
    tooltip.style.opacity = 0;
  }
}

function handleClick(e) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - offsetX) / scale;
  const mouseY = (e.clientY - rect.top - offsetY) / scale;
  const blockSize = BASE_BLOCK_SIZE;
  for (let row = 0; row < 100; row++) {
    const y = row * blockSize;
    if (mouseY < y || mouseY > y + blockSize) continue;
    const col = Math.round((mouseX / blockSize) + row);
    if (col >= 0 && col <= 2 * row) {
      const tokenId = String(row * 2048 + col);
      updateSidebar(tokenId);
      drawPyramid();
      break;
    }
  }
}

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
    isDragging = false;
    e.preventDefault();
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchStartDist = dist;
  }
}

function handleTouchMove(e) {
  e.preventDefault();

  if (e.touches.length === 1) {
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    const distance = Math.hypot(dx, dy);

    if (distance > MOVE_THRESHOLD) {
      touchMoved = true;
      isDragging = true;
      offsetX += dx;
      offsetY += dy;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      drawPyramid();
    }
  } else if (e.touches.length === 2) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (pinchStartDist > 0) {
      const zoomFactor = dist / pinchStartDist;
      pinchStartDist = dist;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const worldX = (mx - offsetX) / scale;
      const worldY = (my - offsetY) / scale;
      scale = Math.max(0.2, Math.min(5, scale * zoomFactor));
      offsetX = mx - worldX * scale;
      offsetY = my - worldY * scale;
      drawPyramid();
    }
  }
}

function handleTouchEnd(e) {
  if (e.touches.length === 0) {
    if (!touchMoved && !isDragging) {
      const fakeClick = { clientX: touchStartX, clientY: touchStartY };
      handleClick(fakeClick);
    }
    isDragging = false;
    pinchStartDist = 0;
    touchMoved = false;
  }
}

/* ==================== Sidebar Drag/Resize ==================== */
const legendPanel = document.getElementById("legendPanel");
const dragHandle = document.getElementById("dragHandle");
const resizeHandle = document.getElementById("resizeHandle");
const collapseBtn = document.getElementById("collapseBtn");
const resetPosBtn = document.getElementById("resetPosBtn");
const legendContent = document.getElementById("legendContent");

let isDraggingPanel = false;
let dragStartX = 0, dragStartY = 0, panelStartLeft = 0, panelStartTop = 0;

if (dragHandle) {
  dragHandle.addEventListener("mousedown", (e) => {
    if (!legendPanel) return;
    isDraggingPanel = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    const rect = legendPanel.getBoundingClientRect();
    panelStartLeft = rect.left; panelStartTop = rect.top;
    legendPanel.style.transition = "none";
    e.preventDefault();
  });
}

window.addEventListener("mousemove", (e) => {
  if (!isDraggingPanel || !legendPanel) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  legendPanel.style.left = (panelStartLeft + dx) + "px";
  legendPanel.style.top = (panelStartTop + dy) + "px";
  legendPanel.style.right = "auto";
});

window.addEventListener("mouseup", () => {
  isDraggingPanel = false;
  if (legendPanel) legendPanel.style.transition = "";
});

let isResizing = false;
if (resizeHandle) {
  resizeHandle.addEventListener("mousedown", (e) => { isResizing = true; e.preventDefault(); });
}
window.addEventListener("mousemove", (e) => {
  if (!isResizing || !legendPanel) return;
  const rect = legendPanel.getBoundingClientRect();
  const newWidth = rect.right - e.clientX;
  if (newWidth > 200 && newWidth < 520) {
    legendPanel.style.width = newWidth + "px";
    legendPanel.style.right = "auto";
  }
});
window.addEventListener("mouseup", () => { isResizing = false; });

if (collapseBtn && legendContent) {
  collapseBtn.addEventListener("click", () => {
    if (legendContent.classList.contains("collapsed")) {
      legendContent.classList.remove("collapsed");
      collapseBtn.textContent = "−";
    } else {
      legendContent.classList.add("collapsed");
      collapseBtn.textContent = "+";
    }
  });
}

if (resetPosBtn && legendPanel) {
  resetPosBtn.addEventListener("click", () => {
    legendPanel.style.left = "auto";
    legendPanel.style.top = "20px";
    legendPanel.style.right = "20px";
    legendPanel.style.width = "380px";
  });
}

/* ==================== Canvas events ==================== */
window.addEventListener("resize", () => {
  if (canvas && container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    centerPyramid();
  }
});

if (canvas) {
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleTouchEnd);
  canvas.addEventListener("touchcancel", handleTouchEnd);

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("click", handleClick);
}

window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    offsetX += dx;
    offsetY += dy;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    drawPyramid();
  } else {
    handleMouseMove(e);
  }
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  if (canvas) canvas.style.cursor = "grab";
});

/* ==================== EVENT LISTENERS ==================== */
document.getElementById("connectBtn")?.addEventListener("click", connectWallet);

// Event-Delegation für dynamisch erzeugte Buttons
document.addEventListener("click", async (e) => {
  if (e.target.id === "revealBtn") await handleReveal();
  if (e.target.id === "startFarmBtn") await handleStartFarm();
  if (e.target.id === "stopFarmBtn") await handleStopFarm();
  if (e.target.id === "claimBtn") await handleClaim();
  if (e.target.id === "protectBtn") await handleProtect();
  if (e.target.id === "attackBtn") await handleAttack();
});

/* ==================== START ==================== */
(async function init() {
  await initReadOnly();
  if (canvas && container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  await loadData();
  centerPyramid();
})();
