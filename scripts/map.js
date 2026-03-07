/* =========================================================
   INPINITY MAP – V4 ONLY – Finale Version mit allen Optimierungen
   - Worker für Subgraph (kein API‑Key mehr im Frontend)
   - Nur aktive Protections & Partnerships geladen
   - Debounce für Attack‑Dropdown (falls vorhanden)
   - Safe‑Wrapper für getAllPending (keine Reverts mehr)
   - Ethers v5/v6 kompatibel (BigInt‑Handling)
   - Vollständige Attack‑Prüfungen (canAttackTarget, remainingAttacks, AttackTime, callStatic)
   ========================================================= */

/* ==================== KONFIGURATION (V4) ==================== */
const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
const BASE_BLOCK_SIZE = 24;

// ====== V4 Contracts ======
const NFT_ADDRESS = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";
const RESOURCE_TOKEN_ADDRESS = "0x71E76a6065197acdd1a4d6B736712F80D1Fd3D8b";
const INPI_ADDRESS = "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D";
const PITRONE_ADDRESS = "0x7240Ec5B3Ba944888E186c74D0f8B4F5F71c9AE8";

const FARMING_V4_ADDRESS = "0xa7F093c893aeF7dA632e5Fa23971ad3C00Cc5bEd";
const PIRATES_V4_ADDRESS = "0x393726fc6f54A07bca710ed7F1c93491CE7daF03";
const MERCENARY_V2_ADDRESS = "0xFEa09ccA75dbc63cc8053739A61777Bd13fC6Bc2";

const CLAIM_COOLDOWN_SEC = 24 * 60 * 60; // 24h

/* ==================== ABIs (vollständig) ==================== */
const NFT_ABI = [
  "function revealBlock(uint256 tokenId, bytes32[] piProof, bytes32[] phiProof, uint8 piDigit, uint8 phiDigit) external",
  "function calculateRarity(uint256 tokenId) view returns (uint8)",
  "function getBlockPosition(uint256 tokenId) view returns (uint256 row, uint256 col)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)"
];

const FARMING_V4_ABI = [
  "function startFarming(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external",
  "function claimResources(uint256 tokenId) external",
  "function farms(uint256) view returns (uint256 startTime, uint256 lastAccrualTime, uint256 boostExpiry, bool isActive)",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])",
  "function getPending(uint256 tokenId, uint8 resourceId) view returns (uint256)",
  "function getDailyProduction(uint256 tokenId) view returns (uint256[10])",
  "function getFarmInfo(uint256 tokenId) view returns (uint256 startTime, uint256 lastAccrualTime, uint256 boostExpiry, bool isActive)",
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
  "function getAttack(uint256 targetTokenId, uint256 index) view returns (address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed)",
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

let nftContract, farmingV4Contract, piratesV4Contract, mercenaryV2Contract, inpiContract, pitroneContract;
let resourceTokenContract;

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
function secondsUntilClaimable(farmStartTime, nowSec) {
  if (!farmStartTime) return null;
  const age = nowSec - farmStartTime;
  return Math.max(0, CLAIM_COOLDOWN_SEC - age);
}

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

/* ==================== SAFE FARM‑HELPER (V4) ==================== */
async function safeGetFarm(tokenId) {
  try {
    const f = await farmingV4Contract.farms(tokenId);
    return {
      ok: true,
      startTime: Number(f.startTime ?? 0),
      lastAccrualTime: Number(f.lastAccrualTime ?? 0),
      boostExpiry: Number(f.boostExpiry ?? 0),
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
    console.warn(`getAllPending reverted for token ${tokenId}:`, e);
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

/* ==================== LOAD ATTACKS (V4) ==================== */
async function loadUserAttacks() {
  if (!userAddress) return;
  try {
    const where = `{ attacker: "${userAddress.toLowerCase()}", executed: false }`;
    const attacks = await fetchAllWithPagination(
      "attackV4S",
      "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed protectionLevel effectiveStealPercent stolenAmount",
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
      resource: parseInt(a.resource, 10),
      protectionLevel: a.protectionLevel ? parseInt(a.protectionLevel, 10) : 0,
      effectiveStealPercent: a.effectiveStealPercent ? parseInt(a.effectiveStealPercent, 10) : 0,
      stolenAmount: a.stolenAmount ? a.stolenAmount.toString() : "0"
    }));
    const dismissed = loadDismissedAttacks();
    userAttacks = userAttacks.filter(a => !dismissed.has(a.id));
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

/* ==================== EXECUTE ATTACK (V4) ==================== */
async function executeAttack(attack) {
  const msgDiv = actionMessage;
  if (!msgDiv) return;
  msgDiv.innerHTML = '<span class="success">⏳ Checking target resources...</span>';
  try {
    if (!piratesV4Contract) throw new Error("Connect wallet first.");

    // Farm‑Status prüfen
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
      msgDiv.innerHTML = '<span class="error">💰 No loot – owner claimed or wrong resource.</span>';
      return;
    }

    // Simulation mit callStatic
    try {
      await piratesV4Contract.callStatic.executeAttack(
        attack.targetTokenId,
        attack.attackIndex
      );
    } catch (simError) {
      msgDiv.innerHTML = `<span class="error">❌ Execute would fail: ${simError.reason || simError.message}</span>`;
      return;
    }

    msgDiv.innerHTML = '<span class="success">⏳ Executing attack...</span>';
    const tx = await piratesV4Contract.executeAttack(
      attack.targetTokenId,
      attack.attackIndex,
      { gasLimit: 350000 }
    );
    msgDiv.innerHTML = '<span class="success">⏳ Confirming...</span>';
    await tx.wait();
    msgDiv.innerHTML = '<span class="success">✅ Attack executed! Resources stolen.</span>';

    localStorage.removeItem(getAttackStorageKey(attack.targetTokenId));
    if (attack.id) dismissAttackById(attack.id);
    await loadUserAttacks();
    await loadUserResources();
    await loadData();
  } catch (e) {
    console.error("executeAttack error:", e);
    let msg = e?.reason || e?.message || "Unknown error";
    if ((msg + "").includes("execution reverted")) {
      if (attack.id) dismissAttackById(attack.id);
      await loadUserAttacks();
      msgDiv.innerHTML = '<span class="error">❌ Attack failed – nothing to steal. Good luck next time.</span>';
      return;
    }
    msgDiv.innerHTML = `<span class="error">❌ ${msg}</span>`;
  }
}

/* ==================== LOAD MAP DATA (V4 Subgraph + Rarity) ==================== */
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
        rarity: null
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

    const farmV4Items = await fetchAllWithPagination(
      "farmV4S",
      "id owner startTime lastAccrualTime boostExpiry active",
      `{ active: true }`
    ).catch(() => []);

    farmV4Items.forEach(f => {
      if (tokens[f.id]) {
        tokens[f.id].farmActive = f.active;
        tokens[f.id].farmStartTime = parseInt(f.startTime, 10);
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

/* ==================== ATTACK-DROPDOWN (nur wenn Inputs existieren) ==================== */
function productionToAllowedResourceIds(productionObj) {
  const map = { OIL:0, LEMONS:1, IRON:2, GOLD:3, PLATINUM:4, COPPER:5, CRYSTAL:6, OBSIDIAN:7, MYSTERIUM:8, AETHER:9 };
  return Object.keys(productionObj).map(key => map[key]).filter(id => Number.isFinite(id));
}

async function getTokenPosition(tokenId) {
  const contract = nftContract || nftReadOnlyContract;
  if (!contract) throw new Error("NFT contract not ready");
  const pos = await contract.getBlockPosition(tokenId);
  return { row: Number(pos.row), col: Number(pos.col) };
}

async function getStealableResourcesForTarget(targetTokenId) {
  let farmingActive = false;
  let farmStartTime = 0;

  try {
    const f = await farmingV4Contract.farms(targetTokenId);
    farmingActive = !!f.isActive;
    farmStartTime = Number(f.startTime);
  } catch (e) {}

  const now = Math.floor(Date.now() / 1000);
  const claimIn = farmStartTime ? secondsUntilClaimable(farmStartTime, now) : null;

  const contract = nftContract || nftReadOnlyContract;
  if (!contract) {
    return { farmingActive, farmStartTime, claimIn, revealed: false, allowed: [0, 1, 2] };
  }

  let revealed = false;
  try {
    const d = await contract.blockData(targetTokenId);
    revealed = !!d.revealed;
  } catch (e) {}

  if (!revealed) {
    return { farmingActive, farmStartTime, claimIn, revealed: false, allowed: [0, 1, 2] };
  }

  let rarity = 0;
  const { row } = await getTokenPosition(targetTokenId);

  try {
    rarity = Number(await contract.calculateRarity(targetTokenId));
  } catch (e) {
    console.warn("Failed to get rarity, using 0");
  }

  const prod = getProduction(rarity, row);
  let allowed = productionToAllowedResourceIds(prod);
  if (allowed.length === 0) allowed = [0,1,2,3,4,5,6,7,8,9];

  const pendingInfo = await safeGetAllPending(targetTokenId);
  const pendingArr = pendingInfo.ok ? pendingInfo.pending : null;
  const pendingReason = pendingInfo.reason;

  return {
    farmingActive,
    farmStartTime,
    claimIn,
    revealed: true,
    rarity,
    allowed,
    pendingArr,
    pendingReason,
    reason: "OK"
  };
}

function scheduleAttackDropdownRefresh() {
  if (!document.getElementById("attackRow") || !document.getElementById("attackCol")) return;
  clearTimeout(attackDropdownTimer);
  attackDropdownTimer = setTimeout(() => {
    refreshAttackDropdown();
  }, 400);
}

async function refreshAttackDropdown() {
  const requestId = ++attackDropdownRequestId;
  const select = document.getElementById("attackResource");
  const msg = actionMessage;
  if (!select || !selectedTokenId) return;

  const targetTokenId = parseInt(selectedTokenId, 10);

  if (!userAddress || !farmingV4Contract) {
    select.innerHTML = "";
    [0,1,2].forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = resourceNames[id];
      select.appendChild(opt);
    });
    return;
  }

  msg.innerHTML = `<span class="success">⏳ Analyzing...</span>`;

  const info = await getStealableResourcesForTarget(targetTokenId);
  if (requestId !== attackDropdownRequestId) return;

  const now = Math.floor(Date.now() / 1000);
  let farmLine = "";
  if (!info.farmingActive) farmLine = "❌ Farming inactive";
  else if (info.claimIn !== null && info.claimIn > 0) farmLine = `⏳ Ready in ${formatDuration(info.claimIn)}`;
  else if (info.claimIn === 0) farmLine = `✅ Loot window active`;
  else farmLine = "✅ Farming active";

  let pendingLine = "";
  if (info.pendingArr && info.pendingArr.length !== undefined) {
    let total = 0n;
    for (let i = 0; i < info.pendingArr.length; i++) {
      total += BigInt(info.pendingArr[i]?.toString() || 0);
    }
    pendingLine = total === 0n ? "⚠️ 0 pending" : `✅ ${total.toString()} pending`;
  } else {
    if (info.pendingReason === "farm-inactive") {
      pendingLine = "⚠️ Farm inactive";
    } else if (info.pendingReason === "farm-not-started") {
      pendingLine = "⚠️ Farm not started";
    } else {
      pendingLine = "⚠️ Pending unavailable";
    }
  }

  if (requestId !== attackDropdownRequestId) return;

  msg.innerHTML = `<span class="${!info.farmingActive ? 'error' : 'success'}">${farmLine}<br>${pendingLine}</span>`;

  select.innerHTML = "";
  info.allowed.forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = resourceNames[id] + (info.revealed ? "" : " (safe)");
    select.appendChild(opt);
  });
}

/* ==================== SIDEBAR (V4) ==================== */
async function updateSidebar(tokenId) {
  selectedTokenId = tokenId;
  const token = tokens[tokenId];
  const owner = token ? token.owner : null;
  selectedTokenOwner = owner;
  let v4Active = false;
  let farmStartTime = 0;
  let claimIn = null;
  let pendingArr = null;
  let pendingReason = "not-requested";

  if (farmingV4Contract) {
    const farmInfo = await safeGetFarm(tokenId);
    v4Active = farmInfo.ok && farmInfo.isActive;
    farmStartTime = farmInfo.startTime || 0;

    if (v4Active && farmStartTime > 0) {
      const now = Math.floor(Date.now() / 1000);
      claimIn = secondsUntilClaimable(farmStartTime, now);
      const pendingInfo = await safeGetAllPending(tokenId);
      pendingArr = pendingInfo.ok ? pendingInfo.pending : null;
      pendingReason = pendingInfo.reason;
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const farmAgeTxt = (v4Active && farmStartTime) ? formatDuration(now - farmStartTime) : "-";
  const claimTxt = (claimIn === null) ? "-" : (claimIn > 0 ? ("in " + formatDuration(claimIn)) : "READY");

  let pendingTotalTxt = "-";
  if (pendingArr && pendingArr.length !== undefined) {
    let total = 0n;
    for (let i = 0; i < pendingArr.length; i++) {
      total += BigInt(pendingArr[i]?.toString() || 0);
    }
    pendingTotalTxt = total === 0n ? "0" : total.toString();
  } else if (pendingReason === "farm-inactive") {
    pendingTotalTxt = "inactive";
  } else if (pendingReason === "farm-not-started") {
    pendingTotalTxt = "not started";
  }

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

  let detailHtml = "";
  if (token && owner) {
    detailHtml = `
      <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${tokenId}</span></div>
      <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value">${shortenAddress(owner)}</span></div>
      <div class="detail-row"><span class="detail-label">Revealed</span><span class="detail-value">${token.revealed ? "✅" : "❌"}</span></div>
      ${rarityDisplay}
      <div class="detail-row"><span class="detail-label">Farming (V4)</span><span class="detail-value">${v4Active ? "Active" : "Inactive"}</span></div>
      <div class="detail-row"><span class="detail-label">Farm age</span><span class="detail-value">${farmAgeTxt}</span></div>
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

  // Felder in der Attack-Info-Card aktualisieren (falls vorhanden)
  const targetStatusEl = document.getElementById("attackTargetStatus");
  const travelTimeEl = document.getElementById("attackTravelTime");
  const remainingEl = document.getElementById("attackRemainingToday");
  const pendingLootEl = document.getElementById("attackPendingLoot");

  if (userAddress && owner && owner.toLowerCase() !== userAddress.toLowerCase() && attackInput) {
    // Nur wenn der Block einem anderen gehört und wir Attack-Input haben
    attackInput.style.display = "flex";
    refreshAttackDropdown();

    if (targetStatusEl) targetStatusEl.innerText = "Checking...";
    if (travelTimeEl) travelTimeEl.innerText = "—";
    if (remainingEl) remainingEl.innerText = "—";
    if (pendingLootEl) pendingLootEl.innerText = "—";

    // Zusätzliche Attack‑Infos laden (falls gewünscht)
    (async () => {
      if (!userAddress || !piratesV4Contract) return;
      const targetTokenIdNum = parseInt(tokenId, 10);
      const ownTokens = Object.entries(tokens).filter(([id, t]) => t.owner && t.owner.toLowerCase() === userAddress.toLowerCase());
      if (ownTokens.length === 0) return;

      const attackerTokenId = parseInt(ownTokens[0][0], 10);
      const [canAttack, remaining, attackTime] = await Promise.all([
        safeCanAttack(userAddress, targetTokenIdNum),
        safeGetRemainingAttacksToday(userAddress),
        safeGetAttackTime(attackerTokenId, targetTokenIdNum)
      ]);

      if (targetStatusEl) targetStatusEl.innerText = canAttack ? "✅ Attackable" : "❌ Not attackable";
      if (remainingEl) remainingEl.innerText = remaining !== null ? String(remaining) : "?";
      if (travelTimeEl) travelTimeEl.innerText = attackTime ? formatDuration(attackTime) : "—";

      const pendingInfo = await safeGetAllPending(targetTokenIdNum);
      let total = 0n;
      if (pendingInfo.ok && pendingInfo.pending) {
        for (let i = 0; i < pendingInfo.pending.length; i++) {
          total += BigInt(pendingInfo.pending[i]?.toString() || 0);
        }
      }
      if (pendingLootEl) pendingLootEl.innerText = total === 0n ? "0" : total.toString();
    })();

  } else if (userAddress && owner && owner.toLowerCase() === userAddress.toLowerCase()) {
    // Eigener Block – Owner-Actions anzeigen
    let btns = "";
    if (!token.revealed) btns += `<button class="action-btn" id="revealBtn">🔓 Reveal</button>`;
    if (!v4Active) btns += `<button class="action-btn" id="startFarmBtn">🌾 Start Farming (V4)</button>`;
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

/* ==================== ACTIONS (V4) ==================== */
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
  if (actionMessage) actionMessage.innerHTML = '<span class="success">⏳ Starting V4...</span>';
  try {
    const farm = await farmingV4Contract.farms(selectedTokenId);
    if (farm.isActive) {
      if (actionMessage) actionMessage.innerHTML = '<span class="success">✅ Already active on V4</span>';
      return;
    }
    const tx = await farmingV4Contract.startFarming(selectedTokenId, { gasLimit: 500000 });
    await tx.wait();
    if (actionMessage) actionMessage.innerHTML = '<span class="success">✅ V4 farming started</span>';
    await loadData();
    await updateSidebar(selectedTokenId);
  } catch (e) {
    console.error(e);
    if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function handleStopFarm() {
  if (!selectedTokenId) return;
  if (actionMessage) actionMessage.innerHTML = '<span class="success">⏳ Stopping V4...</span>';
  try {
    await sendTx(farmingV4Contract.stopFarming(selectedTokenId, { gasLimit: 500000 }), actionMessage, "Farming stopped.");
  } catch (e) {
    if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

async function handleClaim() {
  if (!selectedTokenId) return;
  if (actionMessage) actionMessage.innerHTML = '<span class="success">⏳ Claiming V4...</span>';
  try {
    const pendingInfo = await safeGetAllPending(selectedTokenId);
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
      if (actionMessage) actionMessage.innerHTML = '<span class="error">❌ Nothing to claim.</span>';
      return;
    }

    await sendTx(farmingV4Contract.claimResources(selectedTokenId, { gasLimit: 600000 }), actionMessage, "Resources claimed!");
    await loadUserResources();
  } catch (e) {
    if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
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
    if (actionMessage) actionMessage.innerHTML = '<span class="error">❌ Target block does not exist.</span>';
    return;
  }

  const ownTokens = Object.entries(tokens).filter(([id, t]) => t.owner && t.owner.toLowerCase() === userAddress.toLowerCase());
  if (ownTokens.length === 0) {
    if (actionMessage) actionMessage.innerHTML = '<span class="error">❌ Need a block to attack from</span>';
    return;
  }

  if (targetToken.owner.toLowerCase() === userAddress.toLowerCase()) {
    if (actionMessage) actionMessage.innerHTML = '<span class="error">❌ You cannot attack your own block.</span>';
    return;
  }

  const attackerTokenId = parseInt(ownTokens[0][0], 10);
  const targetTokenId = parseInt(selectedTokenId, 10);
  const resource = parseInt(document.getElementById("attackResource")?.value, 10);

  if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
    if (actionMessage) actionMessage.innerHTML = '<span class="error">❌ Invalid resource selected.</span>';
    return;
  }

  // V4‑Prüfungen
  try {
    if (!piratesV4Contract) throw new Error("Pirates contract not ready");

    const [canAttack, remainingAttacks, attackTime] = await Promise.all([
      safeCanAttack(userAddress, targetTokenId),
      safeGetRemainingAttacksToday(userAddress),
      safeGetAttackTime(attackerTokenId, targetTokenId)
    ]);

    if (!canAttack) {
      actionMessage.innerHTML = '<span class="error">❌ Contract says this target cannot be attacked right now.</span>';
      return;
    }

    if (remainingAttacks !== null && remainingAttacks <= 0) {
      actionMessage.innerHTML = '<span class="error">❌ No attacks remaining today.</span>';
      return;
    }

    if (attackTime === null) {
      actionMessage.innerHTML = '<span class="error">❌ Attack path/time unavailable.</span>';
      return;
    }

    // Simulation mit callStatic
    try {
      await piratesV4Contract.callStatic.startAttack(attackerTokenId, targetTokenId, resource);
    } catch (simError) {
      actionMessage.innerHTML = `<span class="error">❌ Attack would fail: ${simError.reason || simError.message}</span>`;
      return;
    }

    // Felder in der Attack-Info-Card aktualisieren (falls vorhanden)
    const travelTimeEl = document.getElementById("attackTravelTime");
    const remainingEl = document.getElementById("attackRemainingToday");
    if (travelTimeEl) travelTimeEl.innerText = formatDuration(attackTime);
    if (remainingEl) remainingEl.innerText = String(remainingAttacks);

    actionMessage.innerHTML = `
      <span class="success">
        ⏳ Starting attack...<br>
        Travel time: ${formatDuration(attackTime)}<br>
        Remaining today: ${remainingAttacks}
      </span>
    `;

    const tx = await piratesV4Contract.startAttack(attackerTokenId, targetTokenId, resource, { gasLimit: 450000 });
    await tx.wait();

    actionMessage.innerHTML = '<span class="success">✅ Attack launched!</span>';
    localStorage.setItem(getAttackStorageKey(targetTokenId), JSON.stringify({ targetTokenId, resource, startTime: Math.floor(Date.now() / 1000) }));
    await loadUserAttacks();
  } catch (e) {
    console.error("handleAttack error:", e);
    actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== WALLET (mit isConnecting) ==================== */
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
    farmingV4Contract = new ethers.Contract(FARMING_V4_ADDRESS, FARMING_V4_ABI, signer);
    piratesV4Contract = new ethers.Contract(PIRATES_V4_ADDRESS, PIRATES_V4_ABI, signer);
    mercenaryV2Contract = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, signer);
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

// Attack-Dropdown nur, wenn Inputs existieren (in der Map normalerweise nicht)
if (document.getElementById("attackRow") && document.getElementById("attackCol")) {
  document.getElementById("attackRow").addEventListener("input", scheduleAttackDropdownRefresh);
  document.getElementById("attackCol").addEventListener("input", scheduleAttackDropdownRefresh);
}

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
