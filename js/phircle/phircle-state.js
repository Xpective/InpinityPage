import { ID_STRIDE, MAX_ROW, RARITY_DAILY_OUTPUT, RARITY_PRODUCTION } from './phircle-config.js';

// ⚙️ BUSINESS RULES (on-chain Modell)
export const MAX_FARM_PAYOUT_DAYS = 7;   // Farm zahlt max. 7 Tage aus
export const MAX_ATTACKS_PER_WALLET = 3; // Max. 3 Angriffe pro Wallet

export const minted = new Map();
export const farms = new Set();
export const farmStartTimes = new Map();
export const farmLastClaimTimes = new Map();
export const farmAttackedBy = new Map();   // tokenId → { attackerId, resource, timestamp, executed }
export const attackedTokenIds = new Set();  // für schnelles Lookup
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
  apiErrorCount: 0,
  // NEU: Angriffe pro Wallet tracken
  attacksUsedByWallet: new Map(), // wallet → count
  // NEU: Farm-Attack-Modus
  showAttackedFarms: false
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

// ============================================================
// 🆕 FARM-PAYOUT LOGIC (7-TAGE-CAP)
// ============================================================
export function calculateFarmDurationDays(tokenId) {
  const start = farmStartTimes.get(tokenId);
  if (!start) return 0;
  return Math.max(0, (Date.now() - start) / (24 * 60 * 60 * 1000));
}

export function calculateEffectiveFarmDays(tokenId) {
  const lastClaim = farmLastClaimTimes.get(tokenId);
  const base = lastClaim || farmStartTimes.get(tokenId);
  if (!base) return 0;
  const days = Math.max(0, (Date.now() - base) / (24 * 60 * 60 * 1000));
  return Math.min(days, MAX_FARM_PAYOUT_DAYS); // 🆕 Cap auf 7 Tage
}

// Compound-Wachstum, aber MIT 7-Tage-Limit
// growthRate = 0.03 (3%/Tag) – an dein Contract-Modell anpassen!
export function calculateDynamicReward(rarity, days, growthRate = 0.03) {
  const base = RARITY_DAILY_OUTPUT[rarity] || 0;
  const effDays = Math.min(days, MAX_FARM_PAYOUT_DAYS); // 🆕 Cap
  if (effDays <= 0) return 0;
  if (growthRate === 0) return base * effDays;
  const r = 1 + growthRate;
  return base * (Math.pow(r, effDays) - 1) / (r - 1);
}

// 🆕 Kompletter Breakdown für UI – zeigt actual vs. effective
export function getFarmRewardBreakdown(rarity, tokenId) {
  const actualDays = calculateFarmDurationDays(tokenId);
  const effectiveDays = calculateEffectiveFarmDays(tokenId);
  const isCapped = actualDays > MAX_FARM_PAYOUT_DAYS;
  const baseReward = (RARITY_DAILY_OUTPUT[rarity] || 0) * effectiveDays;
  const dynamicReward = calculateDynamicReward(rarity, effectiveDays);
  const bonus = dynamicReward - baseReward;
  const lostDays = isCapped ? actualDays - MAX_FARM_PAYOUT_DAYS : 0;
  return {
    actualDays, effectiveDays, isCapped, lostDays,
    baseReward, dynamicReward, bonus,
    maxPayoutDays: MAX_FARM_PAYOUT_DAYS
  };
}

// 🆕 Claim-Tracking
export function markFarmClaimed(tokenId) {
  farmLastClaimTimes.set(tokenId, Date.now());
}
export function isFarmClaimed(tokenId) {
  return farmLastClaimTimes.has(tokenId);
}
export function clearFarmClaimed(tokenId) {
  farmLastClaimTimes.delete(tokenId);
}

// 🆕 Farm-Attack-Tracking
export function markFarmAttacked(tokenId, info) {
  farmAttackedBy.set(tokenId, { ...info, timestamp: Date.now() });
  attackedTokenIds.add(tokenId);
}
export function isFarmAttacked(tokenId) {
  return attackedTokenIds.has(tokenId);
}
export function getFarmAttackedInfo(tokenId) {
  return farmAttackedBy.get(tokenId) || null;
}

// 🆕 Attack-Limit pro Wallet
export function getAttacksUsed(wallet) {
  if (!wallet) return 0;
  return state.attacksUsedByWallet.get(wallet.toLowerCase()) || 0;
}
export function canStartAttack(wallet) {
  return getAttacksUsed(wallet) < MAX_ATTACKS_PER_WALLET;
}
export function incrementAttacksUsed(wallet) {
  if (!wallet) return 0;
  const w = wallet.toLowerCase();
  const curr = state.attacksUsedByWallet.get(w) || 0;
  const next = curr + 1;
  state.attacksUsedByWallet.set(w, next);
  return next;
}
export function resetAttacksUsed(wallet) {
  if (!wallet) return;
  state.attacksUsedByWallet.set(wallet.toLowerCase(), 0);
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  if (s < 86400) return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;
}