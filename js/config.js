/* =========================================================
   CONFIGURATION – V6 + MERCENARY V3
   ========================================================= */

// Contract Addresses
export const NFT_ADDRESS = "0x277a0D5864293C78d7387C54B48c35D5E9578Ab1";
export const FARMING_V5_ADDRESS = "0xe0246dC9c553E9cD741013C21BD217912a9DA0B2";
export const PIRATES_V5_ADDRESS = "0xe76b03A848dE22DdbbF34994e650d2E887426879";

export const FARMING_V6_ADDRESS = "0x55Ee68e576E97288802D3b887d79Bf7177EfCb92";
export const PIRATES_V6_ADDRESS = "0xc3A9c40fE8664A0aa9243a8DEe27ADf4E4f9e731";
export const MERCENARY_V3_ADDRESS = "0xC0C81D6625101bE19edEdF6C85a72A1A69DAecbF";
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

export const FARM_BOOST_PRICE_PER_DAY = 100;
export const FARM_BOOST_MAX_DAYS = 10;
export const FARM_WINDOW_DAYS = 7;

export const PIRATE_BOOST_PRICE_PER_DAY = 100;
export const PIRATE_BOOST_MAX_DAYS = 10;

/* =========================================================
   MERCENARY V3 CONFIG
   ========================================================= */

export const MERCENARY_INPI_COST = "50";
export const MERCENARY_DEFAULT_SLOT = 0;
export const MERCENARY_MAX_SLOT_INDEX = 2;
export const MERCENARY_MIN_DAYS = 1;
export const MERCENARY_MAX_DAYS = 7;

export const MERCENARY_SLOT2_UNLOCK = [
  { id: 0, amount: 1000, label: "Oil" },
  { id: 1, amount: 500, label: "Lemons" },
  { id: 2, amount: 100, label: "Iron" }
];

export const MERCENARY_SLOT3_UNLOCK = [
  { id: 0, amount: 500, label: "Oil" },
  { id: 1, amount: 100, label: "Lemons" },
  { id: 2, amount: 100, label: "Iron" },
  { id: 3, amount: 50, label: "Gold" },
  { id: 6, amount: 25, label: "Crystal" },
  { id: 8, amount: 5, label: "Mysterium" }
];

export const MERCENARY_SET_COST_RESOURCES = [
  { id: 0, amount: 10, label: "Oil" },
  { id: 1, amount: 5, label: "Lemons" },
  { id: 2, amount: 2, label: "Iron" }
];

export const MERCENARY_EXTEND_COST_RESOURCES = [
  { id: 0, amount: 5, label: "Oil" },
  { id: 1, amount: 2, label: "Lemons" },
  { id: 2, amount: 1, label: "Iron" }
];