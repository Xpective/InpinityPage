
/* =========================================================
   INPINITY GAME – V5 UI BASIS, V6 CONTRACT BACKEND
   - Bestehende V5 Frontend-Struktur bleibt erhalten
   - FarmingV6 / PiratesV6 sind aktiv
   - FarmingV5 nur optional legacy/read-only, falls später gebraucht
   - FarmingV4 read-only nur für Migration alter Farms
   - Migration: V4 -> V6
   - Mint aus mint.html übernommen
   - Reveal direkt in game.html
   - Subgraph nutzt farmV6S / attackV6S
   - ethers v5 kompatibel
   - Wallet remember + disconnect
   ========================================================= */

/* ==================== KONFIGURATION ==================== */
const NFT_ADDRESS            = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";
const FARMING_V6_ADDRESS     = "0x55Ee68e576E97288802D3b887d79Bf7177EfCb92";
const PIRATES_V6_ADDRESS     = "0xc3A9c40fE8664A0aa9243a8DEe27ADf4E4f9e731";
const MERCENARY_V2_ADDRESS   = "0xFEa09ccA75dbc63cc8053739A61777Bd13fC6Bc2";
const PARTNERSHIP_V2_ADDRESS = "0xb18323efE4Cc8c36e10D664E287b4e2c82Fe3ad9";
const RESOURCE_TOKEN_ADDRESS = "0x71E76a6065197acdd1a4d6B736712F80D1Fd3D8b";
const INPI_ADDRESS           = "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D";
const PITRONE_ADDRESS        = "0x7240Ec5B3Ba944888E186c74D0f8B4F5F71c9AE8";

/* Legacy / Migration only */
const FARMING_V5_ADDRESS     = "0xe0246dC9c553E9cD741013C21BD217912a9DA0B2";
const PIRATES_V5_ADDRESS     = "0xe76b03A848dE22DdbbF34994e650d2E887426879";
const FARMING_V4_ADDRESS     = "0xa7F093c893aeF7dA632e5Fa23971ad3C00Cc5bEd";

const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
const MAX_ROW = 99;

const PRICE_ETH         = "0.003";
const PRICE_INPI        = "30";
const PRICE_ETH_MIXED   = "0.0015";
const PRICE_INPI_MIXED  = "15";

const CLAIM_COOLDOWN_SEC = 24 * 60 * 60;
const STORAGE_WALLET_FLAG = "inpinity_wallet_autoreconnect";

/* Active version indicators for UI */
const ACTIVE_FARM_VERSION = "v6";
const ACTIVE_ATTACK_VERSION = "v6";

/* ==================== ABIs ==================== */
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
  "function calculateRarity(uint256 tokenId) view returns (uint8)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function currentMaxRow() view returns (uint256)",
  "function isValidPosition(uint256 row, uint256 col) view returns (bool)",
  "function MINT_PRICE_ETH() view returns (uint256)",
  "function MINT_PRICE_INPI() view returns (uint256)"
];

const FARMING_V6_ABI = [
  "function startFarming(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external",
  "function claimResources(uint256 tokenId) external",
  "function buyBoost(uint256 tokenId, uint256 daysAmount) external",

  "function getFarmState(uint256 tokenId) view returns ((uint256 startTime, uint256 lastAccrualTime, uint256 lastClaimTime, uint256 boostExpiry, uint256 stopTime, bool isActive))",
  "function getFarmStatusCodeV6(uint256 tokenId) view returns (uint8)",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])",
  "function getPending(uint256 tokenId, uint8 resourceId) view returns (uint256)",
  "function getClaimableResources(uint256 tokenId) view returns (uint8[] ids, uint256[] amounts)",
  "function getBoostMultiplier(uint256 tokenId) view returns (uint256)",
  "function isClaimMature(uint256 tokenId) view returns (bool)",
  "function secondsUntilClaimable(uint256 tokenId) view returns (uint256)",
  "function hasBoost(uint256 tokenId) view returns (bool)",
  "function isFarmOwner(uint256 tokenId, address user) view returns (bool)",
  
  /* V6 additions */
  "function previewClaim(uint256 tokenId) view returns ((uint8 code,bool allowed,uint256 pendingAmount,uint256 stealAmount,uint256 travelTime,uint256 remainingAttacksToday,uint256 protectionLevel,uint256 effectiveStealPercent,uint256 secondsRemaining))",
  "function previewSteal(uint256 targetTokenId, uint8 resourceId, uint256 percentBps) view returns ((uint8 code,bool allowed,uint256 pendingAmount,uint256 stealAmount,uint256 travelTime,uint256 remainingAttacksToday,uint256 protectionLevel,uint256 effectiveStealPercent,uint256 secondsRemaining))",
  "function previewStealV6(uint256 targetTokenId, uint8 resourceId, uint256 percentBps, bool roundUpToMinimumOne) view returns ((uint8 code,bool allowed,uint256 pendingAmount,uint256 stealAmount,uint256 travelTime,uint256 remainingAttacksToday,uint256 protectionLevel,uint256 effectiveStealPercent,uint256 secondsRemaining,uint256 attackerTokenId))",
  "function stealResources(uint256 targetTokenId, address attacker, uint8 resourceId, uint256 percentBps) external returns (uint256)",
  "function getFarmActiveUntil(uint256 tokenId) view returns (uint256)",
  "function isFarmEffectivelyActive(uint256 tokenId) view returns (bool)",
  "function paused() view returns (bool)",
  "function setInpiPool(address _inpiPool) external",
  "function setPitronePool(address _pitronePool) external",
  "function setTreasury(address _treasury) external",
  "function setPartnershipContract(address _partnershipContract) external",
  "function pause() external",
  "function unpause() external"
];

const PIRATES_V6_ABI = [
  "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) external",
  "function executeAttack(uint256 targetTokenId, uint256 attackIndex) external",

  "function previewAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",
  "function previewExecuteAttack(uint256 targetTokenId, uint256 attackIndex) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",

  "function canAttackTarget(address attacker, uint256 targetTokenId) view returns (bool)",
  "function getRemainingAttacksToday(address attacker) view returns (uint8)",
  "function getAttackTime(uint256 attackerTokenId, uint256 targetTokenId) view returns (uint256)",
  "function getAttackCount(uint256 targetTokenId) view returns (uint256)",
  "function getAttack(uint256 targetTokenId, uint256 index) view returns ((address attacker,uint256 attackerTokenId,uint256 targetTokenId,uint256 startTime,uint256 endTime,uint8 resource,bool executed,bool cancelled))",
  "function getEffectiveStealPercent(uint256 attackerTokenId, uint256 protectionLevel) view returns (uint256)",
  "function hasPirateBoost(uint256 tokenId) view returns (bool)",
  "function getPirateBoostExpiry(uint256 tokenId) view returns (uint256)",
  "function roundUpToMinimumOne() view returns (bool)",
  
  /* V6 additions */
  "function buyPirateBoost(uint256 tokenId, uint256 daysAmount) external",
  "function cancelOwnPendingAttack(uint256 targetTokenId, uint256 attackIndex) external",
  "function pause() external",
  "function unpause() external",
  "function paused() view returns (bool)",
  "function setFarming(address _farming) external",
  "function setMercenary(address _mercenary) external",
  "function setTreasury(address _treasury) external",
  "function setPitronePool(address _pitronePool) external",
  "function setInpiPool(address _inpiPool) external"
];

const FARMING_V4_ABI = [
  "function farms(uint256) view returns (uint256 startTime, uint256 lastAccrualTime, uint256 boostExpiry, bool isActive)",
  "function getAllPending(uint256 tokenId) view returns (uint256[10])",
  "function claimResources(uint256 tokenId) external",
  "function stopFarming(uint256 tokenId) external"
];

const MERCENARY_V2_ABI = [
  "function hireMercenaries(uint256 tokenId, uint256 protectionLevel) external",
  "function getProtectionLevel(uint256 tokenId) view returns (uint256)",
  "function protections(uint256 tokenId) view returns (uint256 level, uint256 expiry, uint256 cost)",
  "function extendProtection(uint256 tokenId) external",
  "function cleanExpiredProtection(uint256 tokenId) external",
  "function INPI() view returns (address)"
];

const PARTNERSHIP_V2_ABI = [
  "function isPartnerBlock(uint256 tokenId) view returns (bool)",
  "function getPartnerBlock(uint256 partnerId) view returns (uint256)",
  "function partners(uint256 partnerId) view returns (string name, address tokenAddress, uint256 blockId, uint256 startTime, uint256 endTime, bool active)",
  "function partnerIndex(address tokenAddress) view returns (uint256)",
  "function farming() view returns (address)",
  "function inpinityNFT() view returns (address)"
];

const INPI_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)"
];

const PITRONE_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeINPI(uint256 inpiAmount) external",
  "function exchangePitrone(uint256 pitroneAmount) external",
  "function getRate() view returns (uint256)",
  "function availableINPI() view returns (uint256)",
  "function availablePitrone() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function exchangeRate() view returns (uint256)",
  "function inpiReserve() view returns (uint256)",
  "function addLiquidity(uint256 inpiAmount, uint256 pitroneAmount) external",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

const RESOURCE_TOKEN_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function OIL() view returns (uint256)",
  "function LEMONS() view returns (uint256)",
  "function IRON() view returns (uint256)",
  "function GOLD() view returns (uint256)",
  "function PLATINUM() view returns (uint256)",
  "function COPPER() view returns (uint256)",
  "function CRYSTAL() view returns (uint256)",
  "function OBSIDIAN() view returns (uint256)",
  "function MYSTERIUM() view returns (uint256)",
  "function AETHER() view returns (uint256)"
];

/* ==================== GLOBALS ==================== */
let provider, signer, userAddress = null;
let nftContract, farmingV6Contract, piratesV6Contract, mercenaryV2Contract, partnershipV2Contract;
let inpiContract, pitroneContract, resourceTokenContract, farmingV4Contract;

/* optional legacy */
let farmingV5Contract = null;
let piratesV5Contract = null;

let selectedPayment = "eth";
let selectedBlock = null;

let userBlocks = [];
let userAttacks = [];
let userResources = [];

let cachedFarmsV6 = [];
let cachedProtections = [];
let cachedFarmV6Map = new Map();
let cachedProtectionMap = new Map();

let attacksTicker = null;
let attacksPoller = null;
let isConnecting = false;

let attackDropdownRequestId = 0;
let attackDropdownTimer = null;

const resourceNames = ["Oil","Lemons","Iron","Gold","Platinum","Copper","Crystal","Obsidian","Mysterium","Aether"];
const rarityNames   = ["Bronze","Silver","Gold","Platinum","Diamond"];

/* ==================== HELPERS ==================== */
function shortenAddress(addr){
  return addr ? addr.slice(0,6) + "..." + addr.slice(-4) : "";
}

function safeText(id, txt){
  const el = document.getElementById(id);
  if(el) el.innerText = txt;
}

function safeHTML(id, html){
  const el = document.getElementById(id);
  if(el) el.innerHTML = html;
}

function safeValue(id, val){
  const el = document.getElementById(id);
  if(el) el.value = val;
}

function formatTime(seconds){
  seconds = Math.max(0, Number(seconds || 0));
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m";
  return Math.floor(seconds / 3600) + "h";
}

function formatDuration(seconds){
  seconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function bn(value){
  return ethers.BigNumber.isBigNumber(value) ? value : ethers.BigNumber.from(value || 0);
}

function bnIsZero(value){
  try { return bn(value).isZero(); } catch { return true; }
}

function bnGtZero(value){
  try { return bn(value).gt(0); } catch { return false; }
}

function debugLog(message, data = null){
  const logDiv = document.getElementById("debugLog");
  let line = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (data !== null){
    try {
      line += " " + JSON.stringify(data).slice(0, 300);
    } catch {
      line += " " + String(data);
    }
  }
  if (logDiv) {
    logDiv.innerHTML = line + "\n" + logDiv.innerHTML;
  }
  console.log(message, data);
}

function setWalletUIConnected(addr){
  safeHTML("walletStatus", "🟢 Connected");
  safeHTML("walletAddress", shortenAddress(addr));

  const connectBtn = document.getElementById("connectWallet");
  if(connectBtn) connectBtn.innerText = "Wallet Connected";

  const disconnectBtn = document.getElementById("disconnectWallet");
  if(disconnectBtn) disconnectBtn.disabled = false;
}

function setWalletUIDisconnected(){
  safeHTML("walletStatus", "🔴 Not connected");
  safeHTML("walletAddress", "—");

  safeText("balanceEth", "0 ETH");
  safeText("balanceInpi", "0 INPI");
  safeText("balancePit", "0 PIT");
  safeText("userInpi", "0");
  safeText("userPitrone", "0");
  safeText("activeFarms", "0");

  const connectBtn = document.getElementById("connectWallet");
  if(connectBtn) connectBtn.innerText = "Connect Wallet";

  const disconnectBtn = document.getElementById("disconnectWallet");
  if(disconnectBtn) disconnectBtn.disabled = true;

  const blocksGrid = document.getElementById("blocksGrid");
  if(blocksGrid){
    blocksGrid.innerHTML = `<p class="empty-state">Connect wallet to see your blocks.</p>`;
  }

  const userAttacksList = document.getElementById("userAttacksList");
  if(userAttacksList){
    userAttacksList.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
  }

  const userResourcesEl = document.getElementById("userResources");
  if(userResourcesEl){
    userResourcesEl.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
  }

  const selectedBlockInfo = document.getElementById("selectedBlockInfo");
  const blockActions = document.getElementById("blockActions");
  const noBlockSelected = document.getElementById("noBlockSelected");

  if(selectedBlockInfo) selectedBlockInfo.style.display = "none";
  if(blockActions) blockActions.style.display = "none";
  if(noBlockSelected) noBlockSelected.style.display = "block";

  safeValue("protectTokenId", "");
}

function getProduction(rarity, row){
  const p = {};
  if(rarity === 0){ p.OIL=10; p.LEMONS=5; p.IRON=3; }
  else if(rarity === 1){ p.OIL=20; p.LEMONS=10; p.IRON=6; p.GOLD=1; }
  else if(rarity === 2){ p.OIL=30; p.LEMONS=15; p.IRON=9; p.GOLD=2; p.PLATINUM=1; }
  else if(rarity === 3){ p.OIL=40; p.LEMONS=20; p.IRON=12; p.GOLD=3; p.PLATINUM=2; p.CRYSTAL=1; }
  else if(rarity === 4){
    p.OIL=60; p.LEMONS=30; p.IRON=18; p.GOLD=5; p.PLATINUM=3; p.CRYSTAL=2; p.MYSTERIUM=1;
    if(row === 0) p.AETHER = 1;
  }
  return p;
}

async function getTokenPosition(tokenId){
  const pos = await nftContract.getBlockPosition(tokenId);
  return { row: Number(pos.row), col: Number(pos.col) };
}

/* ==================== SUBGRAPH ==================== */
async function fetchSubgraph(query, retries = 5, baseDelay = 1200){
  for(let i = 0; i < retries; i++){
    try{
      const res = await fetch(`${WORKER_URL}/api/subgraph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      const json = await res.json();
      if(!res.ok || json.errors){
        throw new Error(json?.errors?.[0]?.message || `HTTP ${res.status}`);
      }
      return json.data;
    }catch(e){
      if(i === retries - 1) throw e;
      const waitTime = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 500);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function fetchAllWithPagination(fieldName, subfields, where = ""){
  const pageSize = 1000;
  let skip = 0;
  let all = [];

  while(true){
    const q = `{ ${fieldName}(first:${pageSize}, skip:${skip}${where ? ", where:" + where : ""}) { ${subfields} } }`;
    const data = await fetchSubgraph(q);
    const items = data[fieldName];

    if(!items || items.length === 0) break;
    all = all.concat(items);
    if(items.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function loadMyTokensFromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return fetchAllWithPagination(
    "tokens",
    `id revealed owner { id }`,
    `{ owner_: { id: "${owner}" } }`
  );
}

// Graph entity pluralization is generated as farmV6S / attackV6S (capital S)
async function loadMyFarmsV6FromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return fetchAllWithPagination(
    "farmV6S",
    `id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber`,
    `{ owner: "${owner}" }`
  );
}

async function loadProtectionsFromSubgraph(){
  return fetchAllWithPagination(
    "protections",
    `id level expiresAt active`,
    `{ active: true }`
  );
}

async function loadMyAttacksV6FromSubgraph(wallet){
  const owner = wallet.toLowerCase();
  return fetchAllWithPagination(
    "attackV6S",
    `id attacker attackerTokenId targetTokenId attackIndex resource startTime endTime executed cancelled protectionLevel effectiveStealPercent stolenAmount`,
    `{ attacker: "${owner}" }`
  );
}

function buildFarmV6Map(farms){
  const map = new Map();
  for(const farm of farms || []){
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

/* ==================== ONCHAIN FARM HELPERS ==================== */
async function getFarmStateActive(tokenId){
  try{
    const state = await farmingV6Contract.getFarmState(tokenId);
    return {
      ok: true,
      startTime: Number(state.startTime),
      lastAccrualTime: Number(state.lastAccrualTime),
      lastClaimTime: Number(state.lastClaimTime),
      boostExpiry: Number(state.boostExpiry),
      stopTime: Number(state.stopTime),
      isActive: !!state.isActive
    };
  }catch(e){
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

async function getFarmStateV4(tokenId){
  if(!farmingV4Contract) return { ok:false, isActive:false };
  try{
    const f = await farmingV4Contract.farms(tokenId);
    return {
      ok: true,
      startTime: Number(f.startTime?.toString?.() ?? f.startTime ?? 0),
      lastAccrualTime: Number(f.lastAccrualTime?.toString?.() ?? f.lastAccrualTime ?? 0),
      boostExpiry: Number(f.boostExpiry?.toString?.() ?? f.boostExpiry ?? 0),
      isActive: !!f.isActive
    };
  }catch(e){
    return { ok:false, isActive:false };
  }
}

/* ==================== BALANCES ==================== */
async function updateBalances(){
  if(!userAddress || !provider) return;

  const ethBal = await provider.getBalance(userAddress);
  safeText("balanceEth", parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4) + " ETH");

  try{
    const inpiBal = await inpiContract.balanceOf(userAddress);
    const inpiTxt = parseFloat(ethers.utils.formatEther(inpiBal)).toFixed(0);
    safeText("balanceInpi", inpiTxt + " INPI");
    safeText("userInpi", inpiTxt);
  }catch(e){}

  try{
    const pitBal = await pitroneContract.balanceOf(userAddress);
    const pitTxt = ethers.utils.formatEther(pitBal).split(".")[0];
    safeText("balancePit", pitTxt + " PIT");
    safeText("userPitrone", pitTxt);
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
  })).filter(r => bnGtZero(r.amount));

  updateUserResourcesDisplay();
}

function updateUserResourcesDisplay(){
  const container = document.getElementById("userResources");
  if(!container) return;

  if(!userAddress){
    container.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
    return;
  }

  if(!userResources || userResources.length === 0){
    container.innerHTML = `<p class="empty-state">You have no resource tokens yet. Start farming!</p>`;
    return;
  }

  userResources.sort((a,b) => a.resourceId - b.resourceId);

  let html = "";
  for(const r of userResources){
    const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
    const imgUrl = `https://inpinity.online/img/${r.resourceId}.PNG`;
    html += `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; background:#1b2630; border-radius:1rem; padding:0.65rem;">
        <img src="${imgUrl}" alt="${name}" style="width:32px;height:32px;object-fit:contain;" onerror="this.style.display='none'">
        <span style="color:#d4af37; min-width:80px; font-weight:600;">${name}</span>
        <span style="font-weight:600; color:#f0f4fa;">${r.amount.toString()}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

/* ==================== BLOCKS ==================== */
async function loadUserBlocks(){
  if(!userAddress || !nftContract) return;

  const grid = document.getElementById("blocksGrid");
  if(!grid) return;

  try{
    const subgraphTokens = await loadMyTokensFromSubgraph(userAddress);
    const subgraphFarmsV6 = await loadMyFarmsV6FromSubgraph(userAddress);
    const subgraphProtections = await loadProtectionsFromSubgraph();

    cachedFarmsV6 = subgraphFarmsV6 || [];
    cachedProtections = subgraphProtections || [];
    cachedFarmV6Map = buildFarmV6Map(cachedFarmsV6);
    cachedProtectionMap = buildProtectionMap(cachedProtections);

    userBlocks = (subgraphTokens || []).map(t => String(t.id));

    if(userBlocks.length === 0){
      grid.innerHTML = `<p class="empty-state">You don’t own any blocks yet.</p>`;
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
      }catch(e){}

      let rarity = null;
      if(revealed){
        try{
          rarity = Number(await nftContract.calculateRarity(tokenId));
          rarityName = rarityNames[rarity] || "";
        }catch(e){}
      }

      const farm = cachedFarmV6Map.get(tokenId);
      const farmingActive = !!(farm && farm.active);
      if(farmingActive) activeFarmsCount++;

      const protection = cachedProtectionMap.get(tokenId);
      const protectionLevel = protection ? protection.level : 0;
      const protectionActive = !!(protection && protection.active && protection.expiresAt > now && protectionLevel > 0);

      let classNames = revealed ? "revealed" : "hidden";
      if(farmingActive) classNames += " farming";
      if(protectionActive) classNames += " protected";
      if(selectedBlock && String(selectedBlock.tokenId) === tokenId) classNames += " selected";

      const badge = revealed
        ? `<div class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</div>`
        : `<div class="rarity-badge hidden-badge">🔒 Hidden</div>`;

      const farmDurationLine = farmingActive && farm.startTime > 0
        ? `<div style="margin-top:6px; font-size:0.78rem; color: var(--text-dim);">⏱️ Farming: ${formatDuration(now - farm.startTime)}</div>`
        : "";

      const revealButton = !revealed
        ? `<button class="reveal-block-btn" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">🔓 Reveal</button>`
        : "";

      html += `
        <div class="block-card ${classNames}" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">
          <div class="block-id">#${tokenId}</div>
          <div>R${row} C${col}</div>
          ${badge}
          ${farmDurationLine}
          ${revealButton}
        </div>
      `;
    }

    grid.innerHTML = html;
    safeText("activeFarms", String(activeFarmsCount));

    document.querySelectorAll(".block-card").forEach(card=>{
      card.addEventListener("click", async (e)=>{
        if(e.target.classList.contains("reveal-block-btn")) return;
        await selectBlock(card.dataset.tokenid, card.dataset.row, card.dataset.col);
      });
    });

    document.querySelectorAll(".reveal-block-btn").forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        e.stopPropagation();
        const tokenId = btn.dataset.tokenid;
        const row = btn.dataset.row;
        const col = btn.dataset.col;
        await selectBlock(tokenId, row, col);
        await revealSelected();
      });
    });

    refreshBlockMarkings();
  }catch(e){
    console.error("loadUserBlocks error:", e);
    grid.innerHTML = `<p style="color:var(--accent-danger); text-align:center;">Failed to load blocks.</p>`;
  }
}

async function selectBlock(tokenId, row, col){
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

  const farm = cachedFarmV6Map.get(String(tokenId));
  const farmingActive = !!(farm && farm.active);
  const farmStartTime = farm ? farm.startTime : 0;
  const boostExpiry = farm ? farm.boostExpiry : 0;

  const protection = cachedProtectionMap.get(String(tokenId));
  const protectionLevel = protection ? protection.level : 0;
  const protectionActive = !!(protection && protection.active && protection.expiresAt > now && protectionLevel > 0);

  selectedBlock = {
    tokenId: String(tokenId),
    row: Number(row),
    col: Number(col),
    revealed,
    rarity,
    farmingActive,
    protectionLevel,
    protectionActive,
    farmStartTime,
    boostExpiry
  };

  const selectedBlockInfo = document.getElementById("selectedBlockInfo");
  const blockActions = document.getElementById("blockActions");
  const noBlockSelected = document.getElementById("noBlockSelected");
  const selectedBlockMeta = document.getElementById("selectedBlockMeta");

  if(selectedBlockInfo) selectedBlockInfo.style.display = "block";
  if(blockActions) blockActions.style.display = "block";
  if(noBlockSelected) noBlockSelected.style.display = "none";

  const farmDur = (farmingActive && farmStartTime > 0)
    ? ` · ⏱️ ${formatDuration(now - farmStartTime)}`
    : "";

  safeText("selectedBlockText", `Block #${tokenId} (R${row}, C${col})${farmDur}`);
  safeText("selectedActionToken", `Block #${tokenId}`);
  safeValue("protectTokenId", tokenId);

  const revealBtn = document.getElementById("revealBtn");
  if(revealBtn){
    revealBtn.disabled = revealed;
    revealBtn.style.opacity = revealed ? "0.3" : "1";
  }

  const startBtn = document.getElementById("farmingStartBtn");
  const stopBtn  = document.getElementById("farmingStopBtn");
  if(startBtn) startBtn.disabled = farmingActive;
  if(stopBtn) stopBtn.disabled = !farmingActive;

  let hasV4Farm = false;
  if(farmingV4Contract) {
    const v4Farm = await getFarmStateV4(tokenId);
    hasV4Farm = v4Farm.ok && v4Farm.isActive;
  }

  const migrateBtn = document.getElementById("migrateFarmBtn");
  if(migrateBtn){
    if(hasV4Farm && !farmingActive){
      migrateBtn.style.display = "inline-block";
      migrateBtn.disabled = false;
    } else {
      migrateBtn.style.display = "none";
    }
  }

  const resDiv = document.getElementById("blockResources");
  if(resDiv){
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
  }

  if(selectedBlockMeta){
    let meta = [];
    meta.push(`V6 farming: ${farmingActive ? "active" : "inactive"}`);
    if(hasV4Farm) meta.push(`V4 → V6 migration available`);
    if(protectionActive) meta.push(`Protection ${protectionLevel}%`);
    if(boostExpiry > now) meta.push(`Boost active`);
    selectedBlockMeta.style.display = "block";
    selectedBlockMeta.innerHTML = meta.join(" · ");
  }

  document.querySelectorAll(".block-card").forEach(c => c.classList.remove("selected"));
  const sel = document.querySelector(`.block-card[data-tokenid="${tokenId}"]`);
  if(sel) sel.classList.add("selected");
}

/* ==================== ATTACK RESOURCE SELECT ==================== */
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

function scheduleAttackDropdownRefresh(){
  clearTimeout(attackDropdownTimer);
  attackDropdownTimer = setTimeout(() => {
    refreshAttackDropdown();
  }, 350);
}

async function refreshAttackDropdown(){
  const requestId = ++attackDropdownRequestId;

  const row = parseInt(document.getElementById("attackRow")?.value, 10);
  const col = parseInt(document.getElementById("attackCol")?.value, 10);
  const select = document.getElementById("attackResourceSelect");
  const msg = document.getElementById("attackMessage");
  const info = document.getElementById("attackRulesInfo");

  if(!select) return;

  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row > MAX_ROW || col < 0 || col > 2 * row) {
    select.innerHTML = "";
    if (msg) msg.innerHTML = "";
    if (info) info.innerHTML = `<strong>Attack Check</strong><br>Enter valid coordinates.`;
    return;
  }

  const targetTokenId = row * 2048 + col;

  if(!userAddress || !nftContract || !piratesV6Contract){
    initAttackResourceSelect();
    return;
  }

  try{
    if(msg) msg.innerHTML = `<span class="success">⏳ Analyzing target...</span>`;

    let targetOwner;
    try{
      targetOwner = await nftContract.ownerOf(targetTokenId);
    }catch(e){
      if(requestId !== attackDropdownRequestId) return;
      if(msg) msg.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
      if(info) info.innerHTML = `<strong>Attack Check</strong><br>Block not minted.`;
      return;
    }

    const balance = await nftContract.balanceOf(userAddress);
    if(balance.toNumber() === 0){
      if(requestId !== attackDropdownRequestId) return;
      if(msg) msg.innerHTML = `<span class="error">❌ You need a block to attack from.</span>`;
      if(info) info.innerHTML = `<strong>Attack Check</strong><br>No attacker block.`;
      return;
    }

    // V6: selectedBlock is the preferred attacker block.
    // Fallback to first owned token only if no block is currently selected.
    const attackerTokenId = selectedBlock
      ? parseInt(selectedBlock.tokenId, 10)
      : (await nftContract.tokenOfOwnerByIndex(userAddress, 0)).toNumber();

    const previewPromises = [];
    for(let resourceId = 0; resourceId < 10; resourceId++){
      previewPromises.push(
        piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resourceId).catch(() => null)
      );
    }

    const previews = await Promise.all(previewPromises);
    if(requestId !== attackDropdownRequestId) return;

    select.innerHTML = "";
    const allowedResources = [];

    for(let resourceId = 0; resourceId < 10; resourceId++){
      const preview = previews[resourceId];
      if(preview && preview.allowed){
        allowedResources.push(resourceId);
        const opt = document.createElement("option");
        opt.value = resourceId;
        opt.textContent = resourceNames[resourceId];
        select.appendChild(opt);
      }
    }

    if(allowedResources.length === 0){
      resourceNames.forEach((name, id) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name + " ⚠️";
        select.appendChild(opt);
      });
    }

    const previewToShow = allowedResources.length > 0 ? previews[allowedResources[0]] : previews[0];

    if(info && previewToShow){
      let html = `<strong>Attack Check</strong><br>`;
      if(targetOwner.toLowerCase() === userAddress.toLowerCase()){
        html += `<span style="color:#ff6b6b;">⚠️ Cannot attack own block</span>`;
      } else {
        html += previewToShow.allowed
          ? `<span style="color:#51cf66;">✅ Attack allowed</span><br>`
          : `<span style="color:#ff6b6b;">❌ Attack not allowed</span><br>`;

        html += `Travel time: ${formatDuration(previewToShow.travelTime)}<br>`;
        html += `Steal amount: ${previewToShow.stealAmount.toString()}<br>`;
        html += `Remaining attacks: ${previewToShow.remainingAttacksToday}<br>`;
        html += `Protection: ${previewToShow.protectionLevel}%<br>`;
        html += `Steal %: ${previewToShow.effectiveStealPercent}%<br>`;
        html += `Pending: ${previewToShow.pendingAmount.toString()}`;
      }
      info.innerHTML = html;
    }

    if(msg) msg.innerHTML = `<span class="success">✅ Target analyzed</span>`;
  }catch(e){
    console.warn("refreshAttackDropdown error:", e);
    if(requestId !== attackDropdownRequestId) return;
    if(msg) msg.innerHTML = `<span class="error">❌ Error analyzing target</span>`;
    if(info) info.innerHTML = `<strong>Attack Check</strong><br>Error: ${e.message}`;
  }
}

/* ==================== ATTACKS V6 ==================== */
async function loadUserAttacks(){
  if(!userAddress) return;

  try{
    const attacks = await loadMyAttacksV6FromSubgraph(userAddress);

    userAttacks = (attacks || []).map(a => ({
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
    })).filter(a => !a.executed && !a.cancelled);

    displayUserAttacks();
    refreshBlockMarkings();
    startAttacksTicker();
  }catch(e){
    console.error("Failed to load attacks:", e);
  }
}

function displayUserAttacks(){
  const container = document.getElementById("userAttacksList");
  if(!container) return;

  if(!userAddress){
    container.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
    return;
  }

  if(userAttacks.length === 0){
    container.innerHTML = `<p class="empty-state">No active attacks.</p>`;
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
              ${timeLeft<=0 ? "Ready to execute" : ("⏳ " + formatTime(timeLeft) + " remaining")}
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
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      await executeAttack(targetTokenId, attackIndex);
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
      if(timeLeft <= 0){
        el.textContent = "Ready to execute";
        el.style.color = "#51cf66";
      }else{
        el.textContent = "⏳ " + formatTime(timeLeft) + " remaining";
        el.style.color = "";
      }
    });

    document.querySelectorAll(".attack-item").forEach(item=>{
      const endTime = parseInt(item.dataset.endtime || "0",10);
      const btn = item.querySelector(".execute-btn");
      if(!btn) return;
      const timeLeft = endTime - now;

      if(timeLeft <= 0){
        btn.disabled = false;
        btn.textContent = "⚔️ Execute";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }else{
        btn.disabled = true;
        btn.textContent = "⏳ Waiting";
        btn.style.opacity = "0.4";
        btn.style.cursor = "not-allowed";
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

async function executeAttack(targetTokenId, attackIndex){
  const msgDiv = document.getElementById("attackMessage");
  if(!msgDiv) return;

  try{
    msgDiv.innerHTML = `<span class="success">⏳ Preview execute...</span>`;

    const preview = await piratesV6Contract.previewExecuteAttack(targetTokenId, attackIndex);
    if(!preview.allowed){
      msgDiv.innerHTML = `<span class="error">❌ Cannot execute: Code ${preview.code}, steal ${preview.stealAmount.toString()}</span>`;
      return;
    }

    const tx = await piratesV6Contract.executeAttack(targetTokenId, attackIndex, { gasLimit: 350000 });
    msgDiv.innerHTML = `<span class="success">⏳ Executing...</span>`;
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack executed!</span>`;
    await loadUserAttacks();
    await loadResourceBalancesOnchain();
    await updateBalances();
    refreshBlockMarkings();
  }catch(e){
    console.error("executeAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== REVEAL ==================== */
async function revealSelected(){
  if(!selectedBlock) return alert("No block selected.");

  const { tokenId, row, col } = selectedBlock;
  const msgDiv = document.getElementById("actionMessage");
  if(msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Loading proofs...</span>`;

  try{
    const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
    if(!response.ok) throw new Error("Proofs not found");

    const proofs = await response.json();

    const formatProof = (arr) => arr.map(item => {
      const v = item.left ? item.left : item.right;
      return v.startsWith("0x") ? v : ("0x" + v);
    });

    const piProof = formatProof(proofs.pi.proof);
    const phiProof = formatProof(proofs.phi.proof);

    const tx = await nftContract.revealBlock(
      tokenId,
      piProof,
      phiProof,
      proofs.pi.digit,
      proofs.phi.digit,
      { gasLimit: 800000 }
    );

    if(msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Revealing...</span>`;
    await tx.wait();

    if(msgDiv) msgDiv.innerHTML = `<span class="success">✅ Block revealed! 🎉</span>`;
    await loadUserBlocks();
    await selectBlock(tokenId, row, col);
  }catch(e){
    if(msgDiv) msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
  }
}

/* ==================== FARMING V6 ==================== */
async function startFarmingSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const state = await getFarmStateActive(selectedBlock.tokenId);
    if(state.ok && state.isActive){
      msgDiv.innerHTML = `<span class="error">❌ Already farming on V6.</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="success">⏳ Starting V6 farming...</span>`;
    const tx = await farmingV6Contract.startFarming(selectedBlock.tokenId, { gasLimit: 500000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ V6 farming started.</span>`;
    await loadUserBlocks();
    await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
  }catch(e){
    console.error(e);
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

async function stopFarmingSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const state = await getFarmStateActive(selectedBlock.tokenId);
    if(!state.ok || !state.isActive){
      msgDiv.innerHTML = `<span class="error">❌ Not farming on V6.</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="success">⏳ Stopping farming...</span>`;
    const tx = await farmingV6Contract.stopFarming(selectedBlock.tokenId, { gasLimit: 500000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">⏹️ Farming stopped.</span>`;
    await loadUserBlocks();
    await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

async function claimSelected(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const tokenId = selectedBlock.tokenId;
    const isMature = await farmingV6Contract.isClaimMature(tokenId);

    if(!isMature){
      const secondsRemaining = await farmingV6Contract.secondsUntilClaimable(tokenId);
      msgDiv.innerHTML = `<span class="error">❌ Claim not ready. Wait ${formatDuration(secondsRemaining)}.</span>`;
      return;
    }

    const pending = await farmingV6Contract.getAllPending(tokenId);
    let total = ethers.BigNumber.from(0);
    for(let i = 0; i < pending.length; i++){
      total = total.add(pending[i]);
    }

    if(total.isZero()){
      msgDiv.innerHTML = `<span class="error">❌ Nothing to claim.</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="success">⏳ Claiming resources... ${total.toString()} total</span>`;
    const tx = await farmingV6Contract.claimResources(tokenId, { gasLimit: 700000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">💰 Resources claimed!</span>`;
    await loadResourceBalancesOnchain();
    await loadUserBlocks();
    await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== MIGRATION V4 -> V6 ==================== */
async function migrateFarmToV6(){
  if(!selectedBlock) return alert("No block selected.");
  const msgDiv = document.getElementById("actionMessage");

  try{
    const tokenId = selectedBlock.tokenId;

    const v4Farm = await getFarmStateV4(tokenId);
    if(!v4Farm.ok || !v4Farm.isActive){
      msgDiv.innerHTML = `<span class="error">❌ No active V4 farm found.</span>`;
      return;
    }

    const v6Farm = await getFarmStateActive(tokenId);
    if(v6Farm.ok && v6Farm.isActive){
      msgDiv.innerHTML = `<span class="error">❌ Already farming on V6.</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="success">⏳ Checking V4 pending resources...</span>`;

    try{
      const pendingV4 = await farmingV4Contract.getAllPending(tokenId);
      let totalV4 = ethers.BigNumber.from(0);
      for(let i = 0; i < pendingV4.length; i++){
        totalV4 = totalV4.add(pendingV4[i]);
      }

      if(!totalV4.isZero()){
        msgDiv.innerHTML = `<span class="success">⏳ Claiming V4 resources first...</span>`;
        const claimTx = await farmingV4Contract.claimResources(tokenId, { gasLimit: 700000 });
        await claimTx.wait();
      }
    }catch(e){
      debugLog("V4 claim before migration skipped", e.message);
    }

    msgDiv.innerHTML = `<span class="success">⏳ Stopping V4 farming...</span>`;
    const stopTx = await farmingV4Contract.stopFarming(tokenId, { gasLimit: 500000 });
    await stopTx.wait();

    msgDiv.innerHTML = `<span class="success">⏳ Starting V6 farming...</span>`;
    const startTx = await farmingV6Contract.startFarming(tokenId, { gasLimit: 500000 });
    await startTx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Migration successful! Now farming on V6.</span>`;

    await loadResourceBalancesOnchain();
    await loadUserBlocks();
    await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
  }catch(e){
    console.error("Migration error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== ATTACK START ==================== */
async function attack(){
  const attackRowEl = document.getElementById("attackRow");
  const attackColEl = document.getElementById("attackCol");
  const msgDiv = document.getElementById("attackMessage");

  if(!attackRowEl || !attackColEl){
    if(msgDiv) msgDiv.innerHTML = `<span class="error">❌ Attack inputs not found.</span>`;
    return;
  }

  const targetRow = parseInt(attackRowEl.value, 10);
  const targetCol = parseInt(attackColEl.value, 10);

  if(!Number.isFinite(targetRow) || !Number.isFinite(targetCol)){
    alert("Enter target coordinates");
    return;
  }

  const targetTokenId = targetRow * 2048 + targetCol;

  try{
    const owner = await nftContract.ownerOf(targetTokenId);
    if(owner.toLowerCase() === userAddress.toLowerCase()){
      msgDiv.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
      return;
    }
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
    return;
  }

  const balance = await nftContract.balanceOf(userAddress);
  if(balance.toNumber() === 0){
    alert("You need a block to attack from");
    return;
  }

  // V6: selectedBlock is the preferred attacker block.
  // Fallback to first owned token only if no block is currently selected.
  const attackerTokenId = selectedBlock
    ? parseInt(selectedBlock.tokenId, 10)
    : (await nftContract.tokenOfOwnerByIndex(userAddress, 0)).toNumber();

  const resource = parseInt(document.getElementById("attackResourceSelect")?.value, 10);
  if(!Number.isFinite(resource) || resource < 0 || resource > 9){
    msgDiv.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
    return;
  }

  try{
    msgDiv.innerHTML = `<span class="success">⏳ Preview attack...</span>`;

    const preview = await piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resource);
    if(!preview.allowed){
      msgDiv.innerHTML = `<span class="error">❌ Attack not allowed: Code ${preview.code}</span>`;
      return;
    }

    msgDiv.innerHTML = `
      <span class="success">
        ⏳ Starting attack...<br>
        Travel time: ${formatDuration(preview.travelTime)}<br>
        Steal amount: ${preview.stealAmount.toString()}<br>
        Remaining today: ${preview.remainingAttacksToday}
      </span>
    `;

    const tx = await piratesV6Contract.startAttack(attackerTokenId, targetTokenId, resource, { gasLimit: 450000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack started! Check back later.</span>`;
    await loadUserAttacks();
    refreshBlockMarkings();
  }catch(e){
    console.error("startAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== PROTECT ==================== */
async function protect(){
  const tokenId = parseInt(document.getElementById("protectTokenId")?.value, 10);
  const level = parseInt(document.getElementById("protectLevel")?.value, 10);
  const msgDiv = document.getElementById("protectMessage");

  if(isNaN(tokenId) || isNaN(level)) return alert("Invalid input");

  try{
    msgDiv.innerHTML = `<span class="success">⏳ Hiring mercenaries...</span>`;

    const owner = await nftContract.ownerOf(tokenId);
    if(owner.toLowerCase() !== userAddress.toLowerCase()){
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
    if(selectedBlock && String(selectedBlock.tokenId) === String(tokenId)){
      await selectBlock(selectedBlock.tokenId, selectedBlock.row, selectedBlock.col);
    }
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== EXCHANGE ==================== */
async function exchangeINPI(){
  const msgDiv = document.getElementById("exchangeMessage");
  if(!userAddress){
    msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
    return;
  }

  const inpiAmount = parseFloat(document.getElementById("inpiAmount")?.value);
  if(isNaN(inpiAmount) || inpiAmount <= 0) return alert("Invalid amount");

  try{
    const amountWei = ethers.utils.parseEther(inpiAmount.toString());
    const inpiBal = await inpiContract.balanceOf(userAddress);
    if(inpiBal.lt(amountWei)) throw new Error("Insufficient INPI balance");

    const allowance = await inpiContract.allowance(userAddress, PITRONE_ADDRESS);
    if(allowance.lt(amountWei)){
      msgDiv.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
      const approveTx = await inpiContract.approve(PITRONE_ADDRESS, amountWei);
      await approveTx.wait();
    }

    msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
    const tx = await pitroneContract.exchangeINPI(amountWei, { gasLimit: 400000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
    await updateBalances();
    await updatePoolInfo();
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

async function exchangePit(){
  const msgDiv = document.getElementById("exchangeMessage");
  if(!userAddress){
    msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
    return;
  }

  const pitAmount = parseFloat(document.getElementById("pitAmount")?.value);
  if(isNaN(pitAmount) || pitAmount <= 0) return alert("Invalid amount");

  try{
    const amountWei = ethers.utils.parseEther(pitAmount.toString());
    msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
    const tx = await pitroneContract.exchangePitrone(amountWei, { gasLimit: 400000 });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
    await updateBalances();
    await updatePoolInfo();
  }catch(e){
    msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
  }
}

/* ==================== MINT ==================== */
async function findRandomFreeBlock(){
  const msgDiv = document.getElementById("mintMessage");

  if(!userAddress || !nftContract){
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
    return;
  }

  if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Searching a free block...</div>`;

  const MAX_ATTEMPTS = 80;

  for(let attempt = 0; attempt < MAX_ATTEMPTS; attempt++){
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

async function mintBlock(){
  const msgDiv = document.getElementById("mintMessage");

  if(!userAddress || !nftContract){
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
    return;
  }

  const row = parseInt(document.getElementById("row")?.value, 10);
  const col = parseInt(document.getElementById("col")?.value, 10);

  if(Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > MAX_ROW || col < 0 || col > (2 * row)){
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
      // free
    }

    let tx;

    if(selectedPayment === "eth"){
      if(msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with ETH...</div>`;
      tx = await nftContract.mintWithETH(row, col, {
        value: ethers.utils.parseEther(PRICE_ETH)
      });
    }else if(selectedPayment === "inpi"){
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
      const ethAmount = ethers.utils.parseEther(PRICE_ETH_MIXED);
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

    if(document.getElementById("attackRow")?.value && document.getElementById("attackCol")?.value){
      scheduleAttackDropdownRefresh();
    }
  }catch(e){
    console.error("Mint error:", e);
    if(msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ ${e.reason || e.message || "Unknown error"}</div>`;
  }
}

/* ==================== WALLET ==================== */
function clearContracts(){
  provider = null;
  signer = null;
  userAddress = null;

  nftContract = null;
  farmingV6Contract = null;
  piratesV6Contract = null;
  mercenaryV2Contract = null;
  partnershipV2Contract = null;
  inpiContract = null;
  pitroneContract = null;
  resourceTokenContract = null;
  farmingV4Contract = null;

  /* optional legacy */
  farmingV5Contract = null;
  piratesV5Contract = null;

  selectedBlock = null;
  userBlocks = [];
  userAttacks = [];
  userResources = [];
  cachedFarmsV6 = [];
  cachedProtections = [];
  cachedFarmV6Map = new Map();
  cachedProtectionMap = new Map();
}

async function setupContracts(){
  nftContract           = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
  farmingV6Contract     = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);
  piratesV6Contract     = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
  mercenaryV2Contract   = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, signer);
  partnershipV2Contract = new ethers.Contract(PARTNERSHIP_V2_ADDRESS, PARTNERSHIP_V2_ABI, signer);
  inpiContract          = new ethers.Contract(INPI_ADDRESS, INPI_ABI, signer);
  pitroneContract       = new ethers.Contract(PITRONE_ADDRESS, PITRONE_ABI, signer);
  resourceTokenContract = new ethers.Contract(RESOURCE_TOKEN_ADDRESS, RESOURCE_TOKEN_ABI, signer);

  farmingV4Contract     = new ethers.Contract(FARMING_V4_ADDRESS, FARMING_V4_ABI, signer);

  /* optional legacy, nur falls später noch read-only gebraucht */
  farmingV5Contract     = new ethers.Contract(FARMING_V5_ADDRESS, FARMING_V6_ABI, signer);
  piratesV5Contract     = new ethers.Contract(PIRATES_V5_ADDRESS, PIRATES_V6_ABI, signer);
}

async function ensureBaseNetwork(){
  const network = await provider.getNetwork();
  if(network.chainId === 8453) return;

  try{
    await window.ethereum.request({
      method:"wallet_switchEthereumChain",
      params:[{ chainId:"0x2105" }]
    });
  }catch(e){
    if(e.code === 4902){
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
    } else {
      throw e;
    }
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();
}

async function connectWallet(forceRequest = true){
  if(!window.ethereum) return alert("Please install MetaMask!");
  if(isConnecting) return;
  if(userAddress) return;

  isConnecting = true;

  try{
    provider = new ethers.providers.Web3Provider(window.ethereum);

    let accounts = [];
    if(forceRequest){
      accounts = await provider.send("eth_requestAccounts", []);
    }else{
      accounts = await provider.listAccounts();
      if(!accounts || !accounts.length){
        isConnecting = false;
        return;
      }
    }

    signer = provider.getSigner();
    userAddress = accounts[0] || await signer.getAddress();

    await ensureBaseNetwork();
    await setupContracts();

    localStorage.setItem(STORAGE_WALLET_FLAG, "1");
    setWalletUIConnected(userAddress);

    initAttackResourceSelect();

    await updateBalances();
    await updatePoolInfo();
    await loadResourceBalancesOnchain();
    await loadUserBlocks();

    setTimeout(() => {
      loadUserAttacks();
    }, 1200);

    if(!attacksPoller){
      attacksPoller = setInterval(async ()=>{
        try{
          if(!userAddress) return;
          await loadUserAttacks();
          refreshBlockMarkings();
        }catch(e){
          console.warn("attacks poll failed", e);
        }
      }, 45000);
    }

    debugLog("Wallet connected", userAddress);
  }catch(e){
    console.error(e);
    alert("Connection error: " + (e.reason || e.message));
    clearContracts();
    setWalletUIDisconnected();
  }finally{
    isConnecting = false;
  }
}

function disconnectWallet(){
  localStorage.removeItem(STORAGE_WALLET_FLAG);

  if(attacksTicker){
    clearInterval(attacksTicker);
    attacksTicker = null;
  }

  if(attacksPoller){
    clearInterval(attacksPoller);
    attacksPoller = null;
  }

  clearContracts();
  setWalletUIDisconnected();
  debugLog("Wallet disconnected");
}

/* ==================== WALLET EVENTS ==================== */
function bindEthereumEvents(){
  if(!window.ethereum || window.ethereum.__inpinityBound) return;

  window.ethereum.on("accountsChanged", async (accounts) => {
    if(!accounts || accounts.length === 0){
      disconnectWallet();
      return;
    }

    if(userAddress && accounts[0].toLowerCase() !== userAddress.toLowerCase()){
      disconnectWallet();
      await connectWallet(false);
    }
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });

  window.ethereum.__inpinityBound = true;
}

/* ==================== EVENT LISTENERS ==================== */
document.getElementById("connectWallet")?.addEventListener("click", () => connectWallet(true));
document.getElementById("disconnectWallet")?.addEventListener("click", disconnectWallet);

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
document.getElementById("migrateFarmBtn")?.addEventListener("click", migrateFarmToV6);

document.getElementById("attackRow")?.addEventListener("input", scheduleAttackDropdownRefresh);
document.getElementById("attackCol")?.addEventListener("input", scheduleAttackDropdownRefresh);

document.querySelectorAll('input[name="payment"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    selectedPayment = e.target.value;
  });
});

/* ==================== INIT ==================== */
(function initGamePage(){
  setWalletUIDisconnected();
  initAttackResourceSelect();
  bindEthereumEvents();

  const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
  if(shouldReconnect){
    connectWallet(false);
  }
})();
