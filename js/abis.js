/* =========================================================
   ABIs – V6 ONLY (Admin-Funktionen entfernt)
   ========================================================= */

   export const NFT_ABI = [
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
  
  export const FARMING_V6_ABI = [
    // Core functions
    "function startFarming(uint256 tokenId) external",
    "function stopFarming(uint256 tokenId) external",
    "function claimResources(uint256 tokenId) external",
    "function buyBoost(uint256 tokenId, uint256 daysAmount) external",
  
    // View functions
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
    
    // V6 Preview functions
    "function previewClaim(uint256 tokenId) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining))",
    "function previewSteal(uint256 targetTokenId, uint8 resourceId, uint256 percentBps) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining))",
    "function previewStealV6(uint256 targetTokenId, uint8 resourceId, uint256 percentBps, bool roundUpToMinimumOne) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId))",
    "function getFarmActiveUntil(uint256 tokenId) view returns (uint256)",
    "function isFarmEffectivelyActive(uint256 tokenId) view returns (bool)",
    "function paused() view returns (bool)"
  ];
  
  export const PIRATES_V6_ABI = [
    // Core functions
    "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) external",
    "function executeAttack(uint256 targetTokenId, uint256 attackIndex) external",
    "function cancelOwnPendingAttack(uint256 targetTokenId, uint256 attackIndex) external",
    "function buyPirateBoost(uint256 tokenId, uint256 daysAmount) external",
  
    // Preview functions
    "function previewAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",
    "function previewExecuteAttack(uint256 targetTokenId, uint256 attackIndex) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",
  
    // View functions
    "function canAttackTarget(address attacker, uint256 targetTokenId) view returns (bool)",
    "function getRemainingAttacksToday(address attacker) view returns (uint8)",
    "function getAttackTime(uint256 attackerTokenId, uint256 targetTokenId) view returns (uint256)",
    "function getAttackCount(uint256 targetTokenId) view returns (uint256)",
    "function getAttack(uint256 targetTokenId, uint256 index) view returns ((address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed, bool cancelled))",
    "function getEffectiveStealPercent(uint256 attackerTokenId, uint256 protectionLevel) view returns (uint256)",
    "function hasPirateBoost(uint256 tokenId) view returns (bool)",
    "function getPirateBoostExpiry(uint256 tokenId) view returns (uint256)",
    "function roundUpToMinimumOne() view returns (bool)",
    "function paused() view returns (bool)"
  ];
  
  export const MERCENARY_V2_ABI = [
    "function hireMercenaries(uint256 tokenId, uint256 protectionLevel) external",
    "function extendProtection(uint256 tokenId) external",
    "function getProtectionLevel(uint256 tokenId) view returns (uint256)",
    "function protections(uint256 tokenId) view returns (uint256 level, uint256 expiry, uint256 cost)",
    "function INPI() view returns (address)"
  ];
  
  export const PARTNERSHIP_V2_ABI = [
    "function isPartnerBlock(uint256 tokenId) view returns (bool)",
    "function getPartnerBlock(uint256 partnerId) view returns (uint256)",
    "function partners(uint256 partnerId) view returns (string name, address tokenAddress, uint256 blockId, uint256 startTime, uint256 endTime, bool active)",
    "function partnerIndex(address tokenAddress) view returns (uint256)",
    "function farming() view returns (address)",
    "function inpinityNFT() view returns (address)"
  ];
  
  export const INPI_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)"
  ];
  
  export const PITRONE_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function exchangeINPI(uint256 inpiAmount) external",
    "function exchangePitrone(uint256 pitroneAmount) external",
    "function getRate() view returns (uint256)",
    "function availableINPI() view returns (uint256)",
    "function availablePitrone() view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function exchangeRate() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
  ];
  
  export const RESOURCE_TOKEN_ABI = [
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