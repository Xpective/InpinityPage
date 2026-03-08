/* =========================================================
   INPINITY MAP – V5 VIEW
   - passend zur neuen map.html
   - read-only map explorer
   - optional wallet awareness
   - Subgraph: tokens / farmV5S / attackV5S / protections / partnerships
   ========================================================= */

/* ==================== KONFIGURATION ==================== */
const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
const BASE_RPC_URL = "https://mainnet.base.org";
const MAX_ROW = 99;
const BLOCK_SIZE = 24;
const ROW_STRIDE = 2048;

const NFT_ADDRESS = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";

const NFT_ABI = [
  "function calculateRarity(uint256 tokenId) view returns (uint8)",
  "function getBlockPosition(uint256 tokenId) view returns (uint256 row, uint256 col)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)"
];

/* ==================== STATE ==================== */
let provider = null;
let signer = null;
let userAddress = null;

let readOnlyProvider = null;
let nftReadOnlyContract = null;

let tokens = {};
let selectedTokenId = null;

let mapScale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;

let dataPoller = null;

/* ==================== DOM ==================== */
const mapViewport = document.getElementById("mapViewport");
const mapCanvas = document.getElementById("mapCanvas");

const detailTokenId = document.getElementById("detailTokenId");
const detailCoords = document.getElementById("detailCoords");
const detailOwner = document.getElementById("detailOwner");
const detailStatus = document.getElementById("detailStatus");
const detailRarity = document.getElementById("detailRarity");

const mapSearchInput = document.getElementById("mapSearch");
const searchBlockBtn = document.getElementById("searchBlockBtn");
const jumpRowInput = document.getElementById("jumpRow");
const jumpColInput = document.getElementById("jumpCol");
const jumpToCoordsBtn = document.getElementById("jumpToCoordsBtn");
const resetViewBtn = document.getElementById("resetViewBtn");

/* ==================== KONSTANTEN ==================== */
const rarityNames = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const rarityColors = ["#cd7f32", "#c0c0c0", "#ffd700", "#e5e4e2", "#b9f2ff"];

/* ==================== HELFER ==================== */
function shortenAddress(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

function tokenIdFromRowCol(row, col) {
  return row * ROW_STRIDE + col;
}

function rowColFromTokenId(tokenId) {
  const id = Number(tokenId);
  return {
    row: Math.floor(id / ROW_STRIDE),
    col: id % ROW_STRIDE
  };
}

function safeText(el, value) {
  if (el) el.textContent = value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isOwnedByUser(owner) {
  return !!(userAddress && owner && owner.toLowerCase() === userAddress.toLowerCase());
}

function getTokenStatusLabel(token) {
  if (!token || !token.owner) return "Not minted";

  const parts = [];
  parts.push(token.revealed ? "Revealed" : "Minted");

  if (token.farmActive) parts.push("Farming");
  if (token.protectionActive) parts.push("Protected");
  if (token.partnerActive) parts.push("Partner");
  if (token.attackActive) parts.push("Under Attack");
  if (token.attackReady) parts.push("Attack Ready");

  return parts.join(" · ");
}

function getBlockFill(token) {
  if (!token || !token.owner) {
    return "rgba(255,255,255,0.08)";
  }

  if (isOwnedByUser(token.owner)) {
    return "rgba(155, 89, 182, 0.75)";
  }

  if (token.revealed && token.rarity !== null && token.rarity >= 0 && token.rarity <= 4) {
    return rarityColors[token.rarity];
  }

  return token.revealed ? "#c9a959" : "#2e7d5e";
}

function getBlockBorder(token) {
  if (!token || !token.owner) {
    return "rgba(255,255,255,0.10)";
  }

  if (token.attackReady) return "#e74c3c";
  if (token.attackActive) return "#7f5bd6";
  if (token.protectionActive) return "#a66cff";
  if (token.farmActive) return "#46d6a2";
  if (token.revealed) return "var(--quinary-color)";
  return "rgba(255,255,255,0.14)";
}

function getBlockGlow(token) {
  if (!token || !token.owner) return "none";

  if (token.attackReady) return "0 0 16px rgba(201, 90, 90, 0.45)";
  if (token.attackActive) return "0 0 14px rgba(127, 91, 214, 0.34)";
  if (token.protectionActive) return "0 0 14px rgba(166, 108, 255, 0.34)";
  if (token.farmActive) return "0 0 14px rgba(70, 214, 162, 0.34)";
  if (token.revealed) return "0 0 10px rgba(27, 130, 170, 0.22)";
  return "none";
}

/* ==================== SUBGRAPH ==================== */
async function fetchSubgraph(query, retries = 5, baseDelay = 1200) {
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
      const waitTime = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 500);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function fetchAllWithPagination(fieldName, subfields, where = "") {
  const pageSize = 1000;
  let skip = 0;
  let all = [];

  while (true) {
    const query = `{ ${fieldName}(first:${pageSize}, skip:${skip}${where ? `, where:${where}` : ""}) { ${subfields} } }`;
    const data = await fetchSubgraph(query);
    const items = data[fieldName];

    if (!items || items.length === 0) break;
    all = all.concat(items);
    if (items.length < pageSize) break;

    skip += pageSize;
  }

  return all;
}

/* ==================== READ-ONLY INIT ==================== */
async function initReadOnly() {
  readOnlyProvider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
  nftReadOnlyContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, readOnlyProvider);
}

/* ==================== OPTIONAL WALLET ==================== */
async function initWalletIfAvailable() {
  if (!window.ethereum) return;

  try {
    if (!window.ethereum.selectedAddress) return;

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
  } catch (e) {
    console.warn("Wallet init skipped:", e);
  }
}

/* ==================== DATA LOAD ==================== */
async function loadData() {
  try {
    const tokenItems = await fetchAllWithPagination(
      "tokens",
      "id owner { id } revealed"
    ).catch(() => []);

    const farmItems = await fetchAllWithPagination(
      "farmV5S",
      "id active startTime boostExpiry lastClaimTime",
      `{ active: true }`
    ).catch(() => []);

    const protectionItems = await fetchAllWithPagination(
      "protections",
      "id active",
      `{ active: true }`
    ).catch(() => []);

    const partnerItems = await fetchAllWithPagination(
      "partnerships",
      "id active",
      `{ active: true }`
    ).catch(() => []);

    const attackItems = await fetchAllWithPagination(
      "attackV5S",
      "id targetTokenId endTime executed cancelled",
      `{ executed: false, cancelled: false }`
    ).catch(() => []);

    const revealedItems = await fetchAllWithPagination(
      "blockRevealeds",
      "tokenId rarity"
    ).catch(() => []);

    const nextTokens = {};

    tokenItems.forEach(t => {
      nextTokens[String(t.id)] = {
        owner: t.owner?.id || null,
        revealed: !!t.revealed,
        rarity: null,
        farmActive: false,
        protectionActive: false,
        partnerActive: false,
        attackActive: false,
        attackReady: false,
        startTime: 0,
        boostExpiry: 0,
        lastClaimTime: 0
      };
    });

    revealedItems.forEach(r => {
      const tokenId = String(r.tokenId);
      if (nextTokens[tokenId]) {
        nextTokens[tokenId].rarity = Number(r.rarity);
      }
    });

    farmItems.forEach(f => {
      const tokenId = String(f.id);
      if (nextTokens[tokenId]) {
        nextTokens[tokenId].farmActive = !!f.active;
        nextTokens[tokenId].startTime = Number(f.startTime || 0);
        nextTokens[tokenId].boostExpiry = Number(f.boostExpiry || 0);
        nextTokens[tokenId].lastClaimTime = Number(f.lastClaimTime || 0);
      }
    });

    protectionItems.forEach(p => {
      const tokenId = String(p.id);
      if (nextTokens[tokenId]) {
        nextTokens[tokenId].protectionActive = !!p.active;
      }
    });

    partnerItems.forEach(p => {
      const tokenId = String(p.id);
      if (nextTokens[tokenId]) {
        nextTokens[tokenId].partnerActive = !!p.active;
      }
    });

    const now = Math.floor(Date.now() / 1000);

    attackItems.forEach(a => {
      const tokenId = String(a.targetTokenId);
      if (nextTokens[tokenId]) {
        nextTokens[tokenId].attackActive = true;
        nextTokens[tokenId].attackReady = Number(a.endTime || 0) <= now;
      }
    });

    tokens = nextTokens;

    renderMap();

    if (selectedTokenId) {
      await updateSidebar(selectedTokenId);
    }
  } catch (err) {
    console.error("loadData error:", err);
  }
}

/* ==================== MAP RENDER ==================== */
function ensureCanvasSize() {
  if (!mapCanvas || !mapViewport) return;

  const totalWidth = 199 * BLOCK_SIZE;
  const totalHeight = 100 * BLOCK_SIZE;

  mapCanvas.style.width = `${totalWidth}px`;
  mapCanvas.style.height = `${totalHeight}px`;
}

function renderMap() {
  if (!mapCanvas) return;

  ensureCanvasSize();
  mapCanvas.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let row = 0; row <= MAX_ROW; row++) {
    const blocksInRow = 2 * row + 1;
    const y = row * BLOCK_SIZE;

    for (let col = 0; col < blocksInRow; col++) {
      const x = (col - row) * BLOCK_SIZE + (99 * BLOCK_SIZE);
      const tokenId = String(tokenIdFromRowCol(row, col));
      const token = tokens[tokenId];

      const block = document.createElement("button");
      block.type = "button";
      block.className = "map-block";
      block.dataset.tokenId = tokenId;
      block.dataset.row = String(row);
      block.dataset.col = String(col);

      if (selectedTokenId === tokenId) {
        block.classList.add("is-selected");
      }
      if (token?.farmActive) block.classList.add("is-farming");
      if (token?.protectionActive) block.classList.add("is-protected");
      if (token?.attackActive) block.classList.add("is-attacking");
      if (token?.attackReady) block.classList.add("is-executable");
      if (token?.revealed) block.classList.add("is-revealed");
      if (!token?.owner) block.classList.add("is-empty");

      block.style.left = `${x}px`;
      block.style.top = `${y}px`;
      block.style.width = `${BLOCK_SIZE - 2}px`;
      block.style.height = `${BLOCK_SIZE - 2}px`;
      block.style.background = getBlockFill(token);
      block.style.border = `1px solid ${getBlockBorder(token)}`;
      block.style.boxShadow = getBlockGlow(token);

      if (token?.partnerActive) {
        block.textContent = "★";
      } else if (token?.revealed && token?.rarity !== null) {
        block.textContent = "";
      } else {
        block.textContent = "";
      }

      block.title = `#${tokenId} · R${row} C${col}`;
      block.addEventListener("click", () => handleBlockClick(tokenId));

      fragment.appendChild(block);
    }
  }

  mapCanvas.appendChild(fragment);
  applyTransform();
}

function applyTransform() {
  if (!mapCanvas) return;
  mapCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${mapScale})`;
  mapCanvas.style.transformOrigin = "0 0";
}

function resetView() {
  if (!mapViewport || !mapCanvas) return;

  ensureCanvasSize();

  const viewportW = mapViewport.clientWidth;
  const viewportH = mapViewport.clientHeight;

  const contentW = 199 * BLOCK_SIZE;
  const contentH = 100 * BLOCK_SIZE;

  const scaleX = viewportW / contentW;
  const scaleY = viewportH / contentH;

  mapScale = Math.min(scaleX, scaleY, 2.2) * 0.96;

  offsetX = (viewportW - contentW * mapScale) / 2;
  offsetY = (viewportH - contentH * mapScale) / 2;

  applyTransform();
}

function centerOnToken(tokenId) {
  if (!mapViewport) return;

  const { row, col } = rowColFromTokenId(tokenId);
  const x = (col - row) * BLOCK_SIZE + (99 * BLOCK_SIZE) + BLOCK_SIZE / 2;
  const y = row * BLOCK_SIZE + BLOCK_SIZE / 2;

  const viewportW = mapViewport.clientWidth;
  const viewportH = mapViewport.clientHeight;

  offsetX = viewportW / 2 - x * mapScale;
  offsetY = viewportH / 2 - y * mapScale;

  applyTransform();
}

async function handleBlockClick(tokenId) {
  selectedTokenId = String(tokenId);
  renderMap();
  await updateSidebar(selectedTokenId);
}
/* ==================== SIDEBAR ==================== */
async function updateSidebar(tokenId) {
  const token = tokens[String(tokenId)];
  const { row, col } = rowColFromTokenId(tokenId);

  safeText(detailTokenId, `#${tokenId}`);
  safeText(detailCoords, `R${row} · C${col}`);

  if (!token || !token.owner) {
    safeText(detailOwner, "—");
    safeText(detailStatus, "Not minted");
    safeText(detailRarity, "—");
    return;
  }

  safeText(detailOwner, shortenAddress(token.owner));
  safeText(detailStatus, getTokenStatusLabel(token));

  if (token.revealed && token.rarity !== null && token.rarity >= 0 && token.rarity <= 4) {
    safeText(detailRarity, rarityNames[token.rarity]);
  } else if (token.revealed) {
    safeText(detailRarity, "Revealed");
  } else {
    safeText(detailRarity, "Hidden");
  }
}

/* ==================== SEARCH / JUMP ==================== */
async function handleSearchBlock() {
  const raw = mapSearchInput?.value?.trim();
  if (!raw) return;

  const tokenId = Number(raw);
  if (!Number.isFinite(tokenId) || tokenId < 0) return;

  selectedTokenId = String(tokenId);
  renderMap();
  centerOnToken(tokenId);
  await updateSidebar(tokenId);
}

async function handleJumpToCoords() {
  const row = Number(jumpRowInput?.value);
  const col = Number(jumpColInput?.value);

  if (!Number.isFinite(row) || !Number.isFinite(col)) return;
  if (row < 0 || row > MAX_ROW) return;
  if (col < 0 || col > 2 * row) return;

  const tokenId = tokenIdFromRowCol(row, col);
  selectedTokenId = String(tokenId);

  renderMap();
  centerOnToken(tokenId);
  await updateSidebar(tokenId);
}

/* ==================== MAP INTERACTION ==================== */
function handleWheelZoom(e) {
  if (!mapViewport) return;

  e.preventDefault();

  const rect = mapViewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - offsetX) / mapScale;
  const worldY = (mouseY - offsetY) / mapScale;

  const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
  const newScale = clamp(mapScale * zoomFactor, 0.35, 4);

  offsetX = mouseX - worldX * newScale;
  offsetY = mouseY - worldY * newScale;
  mapScale = newScale;

  applyTransform();
}

function handlePointerDown(e) {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOriginX = offsetX;
  dragOriginY = offsetY;

  if (mapViewport) {
    mapViewport.style.cursor = "grabbing";
  }
}

function handlePointerMove(e) {
  if (!isDragging) return;

  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  offsetX = dragOriginX + dx;
  offsetY = dragOriginY + dy;

  applyTransform();
}

function handlePointerUp() {
  isDragging = false;

  if (mapViewport) {
    mapViewport.style.cursor = "grab";
  }
}

/* ==================== TOUCH SUPPORT ==================== */
let touchStartDistance = 0;
let touchStartScale = 1;

function getTouchDistance(touches) {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function handleTouchStart(e) {
  if (!mapViewport) return;

  if (e.touches.length === 1) {
    const t = e.touches[0];
    handlePointerDown({ clientX: t.clientX, clientY: t.clientY });
  } else if (e.touches.length === 2) {
    touchStartDistance = getTouchDistance(e.touches);
    touchStartScale = mapScale;
  }
}

function handleTouchMove(e) {
  if (!mapViewport) return;

  if (e.touches.length === 1 && isDragging) {
    const t = e.touches[0];
    handlePointerMove({ clientX: t.clientX, clientY: t.clientY });
  } else if (e.touches.length === 2) {
    e.preventDefault();

    const rect = mapViewport.getBoundingClientRect();
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

    const worldX = (centerX - offsetX) / mapScale;
    const worldY = (centerY - offsetY) / mapScale;

    const currentDistance = getTouchDistance(e.touches);
    if (!touchStartDistance) return;

    const ratio = currentDistance / touchStartDistance;
    const newScale = clamp(touchStartScale * ratio, 0.35, 4);

    offsetX = centerX - worldX * newScale;
    offsetY = centerY - worldY * newScale;
    mapScale = newScale;

    applyTransform();
  }
}

function handleTouchEnd() {
  isDragging = false;
  if (mapViewport) {
    mapViewport.style.cursor = "grab";
  }
}

/* ==================== STYLE HELPERS FOR MAP BLOCKS ==================== */
function injectMapBlockStyles() {
  if (document.getElementById("map-block-runtime-styles")) return;

  const style = document.createElement("style");
  style.id = "map-block-runtime-styles";
  style.textContent = `
    .map-canvas {
      position: relative;
      will-change: transform;
    }

    .map-block {
      position: absolute;
      border-radius: 4px;
      padding: 0;
      margin: 0;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #111;
      transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      user-select: none;
    }

    .map-block:hover {
      transform: scale(1.08);
      z-index: 2;
    }

    .map-block.is-selected {
      outline: 2px solid var(--quinary-color);
      outline-offset: 1px;
      z-index: 3;
    }

    .map-block.is-empty {
      color: transparent;
    }

    .map-viewport {
      cursor: grab;
      overflow: hidden;
      touch-action: none;
    }

    .mono {
      font-family: "Roboto Mono", monospace;
    }
  `;
  document.head.appendChild(style);
}

/* ==================== POLLING ==================== */
function startPolling() {
  if (dataPoller) return;

  dataPoller = setInterval(async () => {
    await loadData();
  }, 30000);
}

/* ==================== EVENTS ==================== */
function bindEvents() {
  searchBlockBtn?.addEventListener("click", handleSearchBlock);
  jumpToCoordsBtn?.addEventListener("click", handleJumpToCoords);
  resetViewBtn?.addEventListener("click", resetView);

  mapSearchInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await handleSearchBlock();
  });

  jumpColInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await handleJumpToCoords();
  });

  mapViewport?.addEventListener("wheel", handleWheelZoom, { passive: false });

  mapViewport?.addEventListener("mousedown", handlePointerDown);
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);

  mapViewport?.addEventListener("touchstart", handleTouchStart, { passive: false });
  mapViewport?.addEventListener("touchmove", handleTouchMove, { passive: false });
  mapViewport?.addEventListener("touchend", handleTouchEnd);
  mapViewport?.addEventListener("touchcancel", handleTouchEnd);

  window.addEventListener("resize", () => {
    ensureCanvasSize();
    resetView();
  });
}

/* ==================== START ==================== */
(async function init() {
  try {
    injectMapBlockStyles();
    await initReadOnly();
    await initWalletIfAvailable();
    ensureCanvasSize();
    bindEvents();
    await loadData();
    resetView();
    startPolling();
  } catch (e) {
    console.error("map init error:", e);
  }
})();
