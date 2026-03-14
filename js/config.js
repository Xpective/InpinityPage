/* =========================================================
   CONFIGURATION – V6 / MERCENARY V4
   ========================================================= */

/* ==================== CONTRACT ADDRESSES ==================== */

export const NFT_ADDRESS = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";

export const FARMING_V5_ADDRESS = "0xe0246dC9c553E9cD741013C21BD217912a9DA0B2";
export const PIRATES_V5_ADDRESS = "0xe76b03A848dE22DdbbF34994e650d2E887426879";

export const FARMING_V6_ADDRESS = "0x55Ee68e576E97288802D3b887d79Bf7177EfCb92";
export const PIRATES_V6_ADDRESS = "0xc3A9c40fE8664A0aa9243a8DEe27ADf4E4f9e731";

export const MERCENARY_V4_ADDRESS = "0x484d4ae1C70c938a4819B04d4b08DCBFf9639094";
export const PARTNERSHIP_V2_ADDRESS = "0xb18323efE4Cc8c36e10D664E287b4e2c82Fe3ad9";
export const RESOURCE_TOKEN_ADDRESS = "0x71E76a6065197acdd1a4d6B736712F80D1Fd3D8b";
export const INPI_ADDRESS = "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D";
export const PITRONE_ADDRESS = "0x7240Ec5B3Ba944888E186c74D0f8B4F5F71c9AE8";

/* ==================== API / GAME CONSTANTS ==================== */

export const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
export const MAX_ROW = 99;
/* UI upper bound only. Real column validation remains: col <= 2 * row */
export const MAX_COL = 198;

/* ==================== STORAGE KEYS ==================== */

export const STORAGE_WALLET_FLAG = "inpinity_wallet_autoreconnect";
export const STORAGE_ATTACKER_TOKEN_KEY = "inpinity_selected_attack_attacker";
export const STORAGE_DASHBOARD_VIEW_KEY = "inpinity_dashboard_view_mode";

/* ==================== MINT PRICES ==================== */

export const PRICE_ETH = "0.003";
export const PRICE_INPI = "30";
export const PRICE_ETH_MIXED = "0.0015";
export const PRICE_INPI_MIXED = "15";

/* ==================== TIMING ==================== */

export const CLAIM_COOLDOWN_SEC = 24 * 60 * 60;

/* ==================== RESOURCE IDS ==================== */

export const RESOURCE_IDS = {
  OIL: 0,
  LEMONS: 1,
  IRON: 2,
  GOLD: 3,
  PLATINUM: 4,
  COPPER: 5,
  CRYSTAL: 6,
  OBSIDIAN: 7,
  MYSTERIUM: 8,
  AETHER: 9
};

export const resourceNames = [
  "Oil",
  "Lemons",
  "Iron",
  "Gold",
  "Platinum",
  "Copper",
  "Crystal",
  "Obsidian",
  "Mysterium",
  "Aether"
];

export const rarityNames = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export function getResourceName(resourceId) {
  const id = Number(resourceId);
  return resourceNames[id] || `Resource ${id}`;
}

export function getResourceIconPath(resourceId) {
  return `/img/${Number(resourceId)}.png`;
}

/* ==================== FARMING BOOST ==================== */

export const FARM_BOOST_PRICE_PER_DAY = 100;
export const FARM_BOOST_MAX_DAYS = 10;
export const FARM_WINDOW_DAYS = 7;

/* ==================== PIRATE BOOST ==================== */

export const PIRATE_BOOST_PRICE_PER_DAY = 100;
export const PIRATE_BOOST_MAX_DAYS = 10;

/* =========================================================
   MERCENARY V4
   ========================================================= */

export const MERCENARY_MAX_SLOTS = 3;
export const MERCENARY_DEFAULT_SLOT_COUNT = 1;

export const MERCENARY_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export const MERCENARY_DURATION_LABELS = {
  1: "1 day",
  2: "2 days",
  3: "3 days",
  4: "4 days",
  5: "5 days",
  6: "6 days",
  7: "7 days"
};

export const MERCENARY_TIER_LABELS = {
  0: "None",
  1: "20%",
  2: "30%",
  3: "50%"
};

export const MERCENARY_RANKS = [
  {
    key: "watchman",
    label: "Watchman",
    minPoints: 0,
    maxPoints: 99,
    discountPercent: 2,
    nextRankAt: 100
  },
  {
    key: "defender",
    label: "Defender",
    minPoints: 100,
    maxPoints: 249,
    discountPercent: 4,
    nextRankAt: 250
  },
  {
    key: "guardian",
    label: "Guardian",
    minPoints: 250,
    maxPoints: 599,
    discountPercent: 6,
    nextRankAt: 600
  },
  {
    key: "citadel_keeper",
    label: "Citadel Keeper",
    minPoints: 600,
    maxPoints: 1000,
    discountPercent: 8,
    nextRankAt: 1001
  },
  {
    key: "inpinity_bastion",
    label: "Inpinity Bastion",
    minPoints: 1001,
    maxPoints: Infinity,
    discountPercent: 10,
    nextRankAt: null
  }
];

export const MERCENARY_RANK_LABELS = MERCENARY_RANKS.map((rank) => rank.label);

export const MERCENARY_SLOT2_UNLOCK_COST = {
  oil: 1000,
  lemons: 500,
  iron: 100
};

export const MERCENARY_SLOT3_UNLOCK_COST = {
  oil: 500,
  lemons: 100,
  iron: 100,
  gold: 50,
  crystal: 25,
  mysterium: 5
};

export const MERCENARY_SLOT2_UNLOCK = [
  { key: "oil", label: "Oil", amount: 1000, resourceId: RESOURCE_IDS.OIL },
  { key: "lemons", label: "Lemons", amount: 500, resourceId: RESOURCE_IDS.LEMONS },
  { key: "iron", label: "Iron", amount: 100, resourceId: RESOURCE_IDS.IRON }
];

export const MERCENARY_SLOT3_UNLOCK = [
  { key: "oil", label: "Oil", amount: 500, resourceId: RESOURCE_IDS.OIL },
  { key: "lemons", label: "Lemons", amount: 100, resourceId: RESOURCE_IDS.LEMONS },
  { key: "iron", label: "Iron", amount: 100, resourceId: RESOURCE_IDS.IRON },
  { key: "gold", label: "Gold", amount: 50, resourceId: RESOURCE_IDS.GOLD },
  { key: "crystal", label: "Crystal", amount: 25, resourceId: RESOURCE_IDS.CRYSTAL },
  { key: "mysterium", label: "Mysterium", amount: 5, resourceId: RESOURCE_IDS.MYSTERIUM }
];

export const MERCENARY_V4_COSTS = {
  1: { inpi: "8",  oil: 3,  lemons: 2, iron: 1, upfrontPoints: 2,  protectionPercent: 20, tier: 1 },
  2: { inpi: "14", oil: 4,  lemons: 3, iron: 1, upfrontPoints: 2,  protectionPercent: 20, tier: 1 },
  3: { inpi: "22", oil: 6,  lemons: 4, iron: 2, upfrontPoints: 5,  protectionPercent: 30, tier: 2 },
  4: { inpi: "29", oil: 8,  lemons: 4, iron: 2, upfrontPoints: 5,  protectionPercent: 30, tier: 2 },
  5: { inpi: "35", oil: 10, lemons: 5, iron: 3, upfrontPoints: 5,  protectionPercent: 30, tier: 2 },
  6: { inpi: "42", oil: 11, lemons: 5, iron: 3, upfrontPoints: 10, protectionPercent: 50, tier: 3 },
  7: { inpi: "50", oil: 12, lemons: 6, iron: 3, upfrontPoints: 10, protectionPercent: 50, tier: 3 }
};

export function getMercenaryV4Cost(days) {
  return MERCENARY_V4_COSTS[Number(days)] || MERCENARY_V4_COSTS[1];
}

export function getMercenaryTierByDays(days) {
  return getMercenaryV4Cost(days)?.tier || 0;
}

export function getMercenaryProtectionPercentByDays(days) {
  return getMercenaryV4Cost(days)?.protectionPercent || 0;
}

export function getMercenaryUpfrontPointsByDays(days) {
  return getMercenaryV4Cost(days)?.upfrontPoints || 0;
}

export function getMercenaryRankInfo(points = 0) {
  const p = Number(points || 0);
  return (
    MERCENARY_RANKS.find(
      (rank) => p >= rank.minPoints && p <= rank.maxPoints
    ) || MERCENARY_RANKS[0]
  );
}

export function getMercenaryNextRankThreshold(points = 0) {
  return getMercenaryRankInfo(points).nextRankAt;
}

export function getMercenaryDiscountPercent(points = 0) {
  return getMercenaryRankInfo(points).discountPercent;
}

export function getMercenaryRankLabel(points = 0) {
  return getMercenaryRankInfo(points).label;
}

export function getMercenaryNextRankLabel(points = 0) {
  const current = getMercenaryRankInfo(points);
  const idx = MERCENARY_RANKS.findIndex((rank) => rank.key === current.key);
  const next = MERCENARY_RANKS[idx + 1];
  return next ? next.label : "Max rank";
}

/* =========================================================
   OPTIONAL LEGACY NOTES
   These are intentionally not used as the primary V4 truth.
   Keep only if some local modules still reference them temporarily.
   ========================================================= */

// export const MERCENARY_INPI_COST = "50";
// export const MERCENARY_SET_COST_RESOURCES = [
//   { key: "oil", label: "Oil", amount: 10 },
//   { key: "lemons", label: "Lemons", amount: 5 },
//   { key: "iron", label: "Iron", amount: 2 }
// ];
// export const MERCENARY_EXTEND_COST_RESOURCES = [
//   { key: "oil", label: "Oil", amount: 5 },
//   { key: "lemons", label: "Lemons", amount: 2 },
//   { key: "iron", label: "Iron", amount: 1 }
// ];