export const WORKER_URL = 'https://inpinity-worker-final.s-plat.workers.dev';
export const NFT_ADDRESS = '0x277a0D5864293C78d7387C54B48c35D5E9578Ab1';
export const FARMING_V6_ADDRESS = '0x55Ee68e576E97288802D3b887d79Bf7177EfCb92';
export const PIRATES_V6_ADDRESS = '0xc3A9c40fE8664A0aa9243a8DEe27ADf4E4f9e731';
export const MERCENARY_V4_ADDRESS = '0x484d4ae1C70c938a4819B04d4b08DCBFf9639094';
export const PARTNERSHIP_V2_ADDRESS = '0xb18323efE4Cc8c36e10D664E287b4e2c82Fe3ad9';
export const PUBLIC_RPC = 'https://mainnet.base.org';
export const MAX_ROW = 99;
export const ID_STRIDE = 2049;
export const rarityNames = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
export const resourceNames = ['Oil', 'Lemons', 'Iron', 'Gold', 'Platinum', 'Copper', 'Crystal', 'Obsidian', 'Mysterium', 'Aether'];
export const RARITY_PRODUCTION = { 0:[0,1,2], 1:[0,1,2,3], 2:[0,1,2,3,4], 3:[0,1,2,3,4,6], 4:[0,1,2,3,4,6,8] };
export const RARITY_DAILY_OUTPUT = { 0:18, 1:37, 2:57, 3:78, 4:108 };

export const NFT_ABI = [
  "function mintWithINPI(uint256 row, uint256 col)",
  "function calculateRarity(uint256 tokenId) view returns (uint8)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function revealed(uint256 tokenId) view returns (bool)"
];
export const FARMING_V6_ABI = [
  "function startFarming(uint256 tokenId)",
  "function stopFarming(uint256 tokenId)",
  "function claimResources(uint256 tokenId)",
  "function buyBoost(uint256 tokenId, uint256 daysAmount)"
];
export const PIRATES_V6_ABI = [
  "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId)",
  "function executeAttack(uint256 targetTokenId, uint256 attackIndex)",
  "function buyPirateBoost(uint256 tokenId, uint256 daysAmount)"
];
export const MERCENARY_V4_ABI = [
  "function setProtection(uint256 slotIndex, uint256 tokenId, uint256 durationDays, bool payInINPI)"
];

export const PHI = (1 + Math.sqrt(5)) / 2;
export const PI = Math.PI;
export const TAU = 2 * PI;
export const GOLDEN_ANGLE = PI * (3 - Math.sqrt(5));
export const CENTER_ANGLE = -PI / 2;
export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || innerWidth < 768;
export const COLORS = {
  unminted:'#3a3a3a', bronze:'#cd7f32', silver:'#c0c0c0',
  gold:'#ffcc00', platinum:'#e5e4e2', diamond:'#b9f2ff',
  farming:'#00ff88', attack:'#ff3333', partner:'#c060ff', mine:'#00e5ff'
};