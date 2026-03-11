/* =========================================================
   STATE MANAGEMENT – V6 + MERCENARY V3
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
    mercenaryV3Contract: null,
    partnershipV2Contract: null,
    inpiContract: null,
    pitroneContract: null,
    resourceTokenContract: null,
  
    // UI State
    selectedPayment: "eth",
    selectedBlock: null,
  
    // Mercenary UI State
    selectedMercenaryPayment: "resources", // "resources" | "inpi"
    selectedMercenarySlot: 0,
    selectedProtectionDays: 1,
  
    // Data
    userBlocks: [],
    userAttacks: [],
    userResources: [],
  
    // Mercenary Data
    mercenarySlots: [],
    mercenaryProfile: null,
    mercenaryProtectionByToken: new Map(),
  
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