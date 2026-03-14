/* =========================================================
   ABIs – V6 + MERCENARY V4
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
  
    "function previewClaim(uint256 tokenId) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 secondsRemaining))",
    "function previewSteal(uint256 targetTokenId, uint8 resourceId, uint256 percentBps) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining))",
    "function previewStealV6(uint256 targetTokenId, uint8 resourceId, uint256 percentBps, bool roundUpToMinimumOne) view returns ((uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId))",
    "function getFarmActiveUntil(uint256 tokenId) view returns (uint256)",
    "function isFarmEffectivelyActive(uint256 tokenId) view returns (bool)",
    "function paused() view returns (bool)"
  ];
  
  export const PIRATES_V6_ABI = [
    "function startAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) external",
    "function executeAttack(uint256 targetTokenId, uint256 attackIndex) external",
    "function cancelOwnPendingAttack(uint256 targetTokenId, uint256 attackIndex) external",
    "function buyPirateBoost(uint256 tokenId, uint256 daysAmount) external",
  
    "function setMercenaryContract(address _mercenary) external",
  
    "function previewAttack(uint256 attackerTokenId, uint256 targetTokenId, uint8 resourceId) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",
    "function previewExecuteAttack(uint256 targetTokenId, uint256 attackIndex) view returns (uint8 code, bool allowed, uint256 pendingAmount, uint256 stealAmount, uint256 travelTime, uint256 remainingAttacksToday, uint256 protectionLevel, uint256 effectiveStealPercent, uint256 secondsRemaining, uint256 attackerTokenId)",
  
    "function canAttackTarget(address attacker, uint256 targetTokenId) view returns (bool)",
    "function getRemainingAttacksToday(address attacker) view returns (uint8)",
    "function getAttackTime(uint256 attackerTokenId, uint256 targetTokenId) view returns (uint256)",
    "function getAttackCount(uint256 targetTokenId) view returns (uint256)",
    "function getAttack(uint256 targetTokenId, uint256 index) view returns ((address attacker, uint256 attackerTokenId, uint256 targetTokenId, uint256 startTime, uint256 endTime, uint8 resource, bool executed, bool cancelled))",
    "function getEffectiveStealPercent(uint256 attackerTokenId, uint256 protectionLevel) view returns (uint256)",
    "function hasPirateBoost(uint256 tokenId) view returns (bool)",
    "function getPirateBoostExpiry(uint256 tokenId) view returns (uint256)",
    "function roundUpToMinimumOne() view returns (bool)",
    "function paused() view returns (bool)",
    "function mercenaryContract() view returns (address)"
  ];
  
  export const MERCENARY_V4_ABI = [
    "function unlockSecondSlot() external",
    "function unlockThirdSlot() external",
    "function setProtection(uint8 slotIndex, uint256 tokenId, uint8 durationDays, bool payInINPI) external",
    "function extendProtection(uint8 slotIndex, uint8 additionalDays, bool payInINPI) external",
    "function cancelProtection(uint8 slotIndex) external",
    "function moveProtection(uint8 slotIndex, uint256 newTokenId) external",
    "function emergencyMoveProtection(uint8 slotIndex, uint256 newTokenId) external",
    "function cleanExpiredSlot(address user, uint8 slotIndex) external",
    "function cleanExpiredToken(uint256 tokenId) external",
    "function setBastionTitle(string title) external",
  
    "function getProtectionLevel(uint256 tokenId) view returns (uint256)",
    "function getProtectionData(uint256 tokenId) view returns (address protector, uint8 slotIndex, bool active, uint256 startTime, uint256 expiry, uint256 cooldownUntil, uint256 emergencyReadyAt, uint256 tier, uint256 protectionPercent)",
    "function getWalletSlots(address user) view returns (uint8 unlockedSlots, tuple(uint256 tokenId, uint64 startTime, uint64 expiry, uint64 cooldownUntil, uint64 emergencyReadyAt, uint8 protectionTier, bool active)[3] data)",    
    "function getDefenderProfile(address user) view returns (uint256 points, uint8 rank, uint256 discountBps, uint256 protectedDays, uint256 defenses, uint256 extensionsCount, uint256 cleanups, string title)",
    "function getRank(address user) view returns (uint8 rank, string name)",
    "function getProtectionCost(address user, uint8 durationDays, bool payInINPI, bool isExtension) view returns (uint256 inpiCost, uint256 oilCost, uint256 lemonsCost, uint256 ironCost, uint256 rankDiscountBps, uint256 totalDiscountBps)",
  
    "function defenderPoints(address) view returns (uint256)",
    "function bastionTitle(address) view returns (string)",
    "function unlockedSlots(address) view returns (uint8)",
    "function freeCleanupCredits(address) view returns (uint256)",
    "function cleanupActions(address) view returns (uint256)",
    "function sameBlockExtensions(address) view returns (uint256)",
    "function successfulDefenses(address) view returns (uint256)",
    "function totalProtectedDays(address) view returns (uint256)",
    "function emergencyMovesUsed(address) view returns (uint256)",
    "function walletSlots(address,uint8) view returns (uint256 tokenId, uint64 startTime, uint64 expiry, uint64 cooldownUntil, uint64 emergencyReadyAt, uint8 protectionTier, bool active)",
    "function tokenProtectionRef(uint256) view returns (address protector, uint8 slotIndex, bool exists)",
    "function slotsUnlockedCount(address) view returns (uint256)",
    "function treasury() view returns (address)",
    "function piratesContract() view returns (address)",
  
    "event ProtectionSet(address indexed user, uint8 indexed slotIndex, uint256 indexed tokenId, uint8 tier, uint64 startTime, uint64 expiry)",
    "event ProtectionExtended(address indexed user, uint8 indexed slotIndex, uint256 indexed tokenId, uint64 oldExpiry, uint64 newExpiry, uint256 discountBps)",
    "event ProtectionCancelled(address indexed user, uint8 indexed slotIndex, uint256 indexed tokenId, uint64 cancelledAt, string reason)",
    "event ProtectionMoved(address indexed user, uint8 indexed slotIndex, uint256 indexed oldTokenId, uint256 newTokenId, uint64 movedAt, uint64 cooldownUntil)",
    "event EmergencyProtectionMoved(address indexed user, uint8 indexed slotIndex, uint256 indexed oldTokenId, uint256 newTokenId, uint64 movedAt, uint64 resetAllowedAt)",
    "event ProtectionExpired(address indexed user, uint8 indexed slotIndex, uint256 indexed tokenId, uint64 expiredAt)",
    "event ProtectionSlotUnlocked(address indexed user, uint8 newUnlockedSlots)",
    "event DefenderPointsAwarded(address indexed user, uint256 indexed tokenId, uint256 points, string reason)",
    "event CleanupRewardPaid(address indexed cleaner, uint256 indexed tokenId, uint256 rewardResourceId, uint256 amount)",
    "event BastionTitleSet(address indexed user, string title)"
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