import { ID_STRIDE, MAX_ROW, RARITY_DAILY_OUTPUT, RARITY_PRODUCTION } from './phircle-config.js';

export const minted = new Map();
export const farms = new Set();
export const farmStartTimes = new Map();
export const attacks = new Map();
export const executedAttacks = [];
export const partnerships = new Set();
export const attackHistory = [];
export const blockHistory = [];
export const activeFilters = new Set();
export const confettiParticles = [];
export const activityLog = [];

export const state = {
  activeLayer: 'rarity',
  userAddress: null,
  userSigner: null,
  isPaused: false,
  myBlocksCount: 0,
  myFarmsCount: 0,
  explosionFactor: 1.0,
  selectedAttackerId: null,
  lastClickedBlockId: null,
  hoveredBlock: null,
  soundEnabled: true,
  radarMode: false,
  historyFilter: 'all',
  apiStatus: 'loading',
};

export const view = { zoom:1, ox:0, oy:0, tZoom:1, tOx:0, tOy:0 };

export const blockId = (row, col) => ID_STRIDE * row + col;
export function idToRC(id) {
  const row = Math.floor(id / ID_STRIDE);
  const col = id - row * ID_STRIDE;
  return (row <= MAX_ROW && col >= 0 && col < 2*row+1) ? { row, col } : null;
}
export function isValidBlockId(id) { return idToRC(id) !== null; }

export function isBlockVisible(id, m) {
  if (activeFilters.size === 0) return true;
  if (activeFilters.has('mine') && (!m || m.owner !== state.userAddress)) return false;
  if (activeFilters.has('farming') && !farms.has(id)) return false;
  if (activeFilters.has('attacked') && !attacks.has(id)) return false;
  return true;
}

export function updateMyBlockCounts() {
  if (!state.userAddress) return;
  let blocks = 0, farmCount = 0;
  for (const [id, m] of minted) {
    if (m.owner && m.owner === state.userAddress) {
      blocks++;
      if (farms.has(id)) farmCount++;
    }
  }
  state.myBlocksCount = blocks;
  state.myFarmsCount = farmCount;
  const el = document.getElementById('myBlocksCount');
  if (el) el.textContent = `${blocks} (${farmCount} farms)`;
}

export function getProfitPrediction(targetRarity, resourceId, protectionLevel = 0) {
  const baseOutput = RARITY_DAILY_OUTPUT[targetRarity] ?? 0;
  const resourceShare = RARITY_PRODUCTION[targetRarity]?.length || 1;
  const perResource = baseOutput / resourceShare;
  const baseStealPercent = 0.25;
  const protectionFactor = 1 - (protectionLevel / 100);
  const effectiveStealPercent = baseStealPercent * protectionFactor;
  const estimatedSteal = Math.max(1, Math.round(perResource * effectiveStealPercent));
  return {
    estimatedSteal,
    effectiveStealPercent: Math.round(effectiveStealPercent * 100),
    profitScore: estimatedSteal > perResource * 0.15 ? 'good' : 'low',
    perResource
  };
}

export function calculateFarmDurationDays(tokenId) {
  const start = farmStartTimes.get(tokenId);
  if (!start) return 0;
  return Math.max(0, (Date.now() - start) / (24 * 60 * 60 * 1000));
}

// Compound-Wachstum: tägliche Ration steigt um growthRate pro Tag
// ⚠️ growthRate = 0.03 (3%/Tag) — muss an dein Contract-Modell angepasst werden!
export function calculateDynamicReward(rarity, days, growthRate = 0.03) {
  const base = RARITY_DAILY_OUTPUT[rarity] || 0;
  if (days <= 0) return 0;
  if (growthRate === 0) return base * days;
  const r = 1 + growthRate;
  return base * (Math.pow(r, days) - 1) / (r - 1);
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  if (s < 86400) return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;
}