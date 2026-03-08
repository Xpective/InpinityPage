/* =========================================================
   STATE MANAGEMENT – V6 ONLY
   ========================================================= */

   export const state = {
    // Web3
    provider: null,
    signer: null,
    userAddress: null,
    isConnecting: false,
  
    // Contracts
    nftContract: null,
    farmingV6Contract: null,
    piratesV6Contract: null,
    mercenaryV2Contract: null,
    partnershipV2Contract: null,
    inpiContract: null,
    pitroneContract: null,
    resourceTokenContract: null,
  
    // UI State
    selectedPayment: "eth",
    selectedBlock: null,
  
    // Data
    userBlocks: [],
    userAttacks: [],
    userResources: [],
  
    // Caches
    cachedFarmsV6: [],
    cachedProtections: [],
    cachedFarmV6Map: new Map(),
    cachedProtectionMap: new Map(),
  
    // Timers
    attacksTicker: null,
    attacksPoller: null,
    attackDropdownTimer: null,
    attackDropdownRequestId: 0
  };