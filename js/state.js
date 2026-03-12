/* =========================================================
   STATE MANAGEMENT – V6 / MERCENARY V4
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
    mercenaryV4Contract: null,
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
  
    // Subgraph / caches
    cachedFarmsV6: [],
    cachedProtectionsV4: [],
    cachedMercenarySlotsV4: [],
    cachedDefenderProfilesV4: [],
  
    cachedFarmV6Map: new Map(),
    cachedProtectionMapV4: new Map(),
    cachedMercenarySlotMapV4: new Map(),
    cachedDefenderProfileMapV4: new Map(),
  
    // Timers
    attacksTicker: null,
    attacksPoller: null,
    attackDropdownTimer: null,
    attackDropdownRequestId: 0,
  
    // Mercenary panel state
    mercenaryPanelLoaded: false,
    selectedMercenarySlotIndex: 0,
    selectedMercenaryDurationDays: 7,
    selectedMercenaryPayInINPI: false
  };