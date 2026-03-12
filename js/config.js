/* =========================================================
   CONFIGURATION – V6 / MERCENARY V4
   ========================================================= */

// Contract Addresses
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

// API & Game Constants
export const WORKER_URL = "https://inpinity-worker-final.s-plat.workers.dev";
export const MAX_ROW = 99;

// Minting Prices
export const PRICE_ETH = "0.003";
export const PRICE_INPI = "30";
export const PRICE_ETH_MIXED = "0.0015";
export const PRICE_INPI_MIXED = "15";

// Timing
export const CLAIM_COOLDOWN_SEC = 24 * 60 * 60;
export const STORAGE_WALLET_FLAG = "inpinity_wallet_autoreconnect";

// Display Constants
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

// Farming boost
export const FARM_BOOST_PRICE_PER_DAY = 100;
export const FARM_BOOST_MAX_DAYS = 10;
export const FARM_WINDOW_DAYS = 7;

// Pirate boost
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

export const MERCENARY_RANK_LABELS = [
  "Watchman",
  "Defender",
  "Guardian",
  "Citadel Keeper",
  "Inpinity Bastion"
];

// Slot unlock costs
export const MERCENARY_SLOT2_UNLOCK = [
  { key: "oil", label: "Oil", amount: 1000 },
  { key: "lemons", label: "Lemons", amount: 500 },
  { key: "iron", label: "Iron", amount: 100 }
];

export const MERCENARY_SLOT3_UNLOCK = [
  { key: "oil", label: "Oil", amount: 500 },
  { key: "lemons", label: "Lemons", amount: 100 },
  { key: "iron", label: "Iron", amount: 100 },
  { key: "gold", label: "Gold", amount: 50 },
  { key: "crystal", label: "Crystal", amount: 25 },
  { key: "mysterium", label: "Mysterium", amount: 5 }
];

// V4 duration-based costs (fallback/UI preview)
export const MERCENARY_V4_COSTS = {
  1: { inpi: "8", oil: 3, lemons: 2, iron: 1, upfrontPoints: 2, protectionPercent: 20, tier: 1 },
  2: { inpi: "14", oil: 4, lemons: 3, iron: 1, upfrontPoints: 2, protectionPercent: 20, tier: 1 },
  3: { inpi: "22", oil: 6, lemons: 4, iron: 2, upfrontPoints: 5, protectionPercent: 30, tier: 2 },
  4: { inpi: "29", oil: 8, lemons: 4, iron: 2, upfrontPoints: 5, protectionPercent: 30, tier: 2 },
  5: { inpi: "35", oil: 10, lemons: 5, iron: 3, upfrontPoints: 5, protectionPercent: 30, tier: 2 },
  6: { inpi: "42", oil: 11, lemons: 5, iron: 3, upfrontPoints: 10, protectionPercent: 50, tier: 3 },
  7: { inpi: "50", oil: 12, lemons: 6, iron: 3, upfrontPoints: 10, protectionPercent: 50, tier: 3 }
};

export function getMercenaryV4Cost(days) {
  return MERCENARY_V4_COSTS[Number(days)] || MERCENARY_V4_COSTS[1];
}