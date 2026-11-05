/* =========================================================
   STATE MANAGEMENT – V6 / MERCENARY V4
   ========================================================= */

   export const state = {
    /* ==================== WEB3 ==================== */
    provider: null,
    signer: null,
    userAddress: null,
    isConnecting: false,
  
    /* ==================== CONTRACTS ==================== */
    nftContract: null,
    farmingV6Contract: null,
    piratesV6Contract: null,
    mercenaryV4Contract: null,
    partnershipV2Contract: null,
    inpiContract: null,
    pitroneContract: null,
    resourceTokenContract: null,
  
    /* ==================== UI / SELECTION ==================== */
    selectedPayment: "eth",
    selectedBlock: null,
    selectedBlockId: null,
    selectedBlockData: null,
    selectedAttackAttackerTokenId: null,
    dashboardViewMode: "simple",
  
    /* ==================== USER DATA ==================== */
    userBlocks: [],
    userAttacks: [],
    userResources: [],
  
    /* ==================== MERCENARY RUNTIME DATA ==================== */
    mercenaryProfile: null,
    mercenarySlots: [],
    mercenaryPanelLoaded: false,
    selectedMercenarySlotIndex: 0,
    selectedMercenaryDurationDays: 7,
    selectedMercenaryPayInINPI: false,
  
    /* ==================== SUBGRAPH / CACHES ==================== */
    cachedFarmsV6: [],
    cachedProtectionsV4: [],
    cachedMercenarySlotsV4: [],
    cachedDefenderProfilesV4: [],
  
    cachedFarmV6Map: new Map(),
    cachedProtectionMapV4: new Map(),
    cachedMercenarySlotMapV4: new Map(),
    cachedDefenderProfileMapV4: new Map(),
  
    /* ==================== TIMERS ==================== */
    attacksTicker: null,
    attacksPoller: null,
    attackDropdownTimer: null,
    attackDropdownRequestId: 0,
  
    /* ==================== BLOCK UI STATUS ==================== */
    uiBlockStatus: {
      isOwner: false,
      isRevealed: false,
  
      farmActive: false,
      farmLegacyActive: false,
      claimReady: false,
      claimCooldownSeconds: 0,
      hasPendingRewards: false,
  
      canStartFarm: false,
      canStopFarm: false,
      canClaim: false,
      canBuyFarmBoost: false,
  
      protectionActive: false,
      protectionExpired: false,
      protectionSlotCount: 1,
      selectedProtectionSlot: 0,
      canUseSlot2: false,
      canUseSlot3: false,
  
      defenderPoints: 0,
      defenderRank: "Watchman",
      defenderDiscountPercent: 0,
      nextRankAt: 100,
      canSetBastionTitle: false,
  
      canAttackFromSelectedBlock: false
    },
  
    /* ==================== UI BUSY FLAGS ==================== */
    uiBusy: {
      reveal: false,
      farmingStart: false,
      farmingStop: false,
      claim: false,
      farmBoost: false,
  
      setProtection: false,
      extendProtection: false,
      cancelProtection: false,
      moveProtection: false,
      emergencyMove: false,
      unlockSlot2: false,
      unlockSlot3: false,
      cleanup: false,
      saveTitle: false,
  
      pirateAttack: false,
      pirateBoost: false
    }
  };
  
  /* =========================================================
     INTERNAL DEFAULTS
     ========================================================= */
  
  function createDefaultUiBlockStatus() {
    return {
      isOwner: false,
      isRevealed: false,
  
      farmActive: false,
      farmLegacyActive: false,
      claimReady: false,
      claimCooldownSeconds: 0,
      hasPendingRewards: false,
  
      canStartFarm: false,
      canStopFarm: false,
      canClaim: false,
      canBuyFarmBoost: false,
  
      protectionActive: false,
      protectionExpired: false,
      protectionSlotCount: 1,
      selectedProtectionSlot: 0,
      canUseSlot2: false,
      canUseSlot3: false,
  
      defenderPoints: 0,
      defenderRank: "Watchman",
      defenderDiscountPercent: 0,
      nextRankAt: 100,
      canSetBastionTitle: false,
  
      canAttackFromSelectedBlock: false
    };
  }
  
  function createDefaultUiBusyFlags() {
    return {
      reveal: false,
      farmingStart: false,
      farmingStop: false,
      claim: false,
      farmBoost: false,
  
      setProtection: false,
      extendProtection: false,
      cancelProtection: false,
      moveProtection: false,
      emergencyMove: false,
      unlockSlot2: false,
      unlockSlot3: false,
      cleanup: false,
      saveTitle: false,
  
      pirateAttack: false,
      pirateBoost: false
    };
  }
  
  /* =========================================================
     UI STATE HELPERS
     ========================================================= */
  
  export function resetSelectedBlockUiState() {
    state.uiBlockStatus = createDefaultUiBlockStatus();
  }
  
  export function setDashboardViewMode(mode = "simple") {
    state.dashboardViewMode = mode === "commander" ? "commander" : "simple";
  }
  
  export function setSelectedBlockState(block = null) {
    state.selectedBlock = block;
    state.selectedBlockId = block ? String(block.tokenId ?? block.id ?? "") : null;
    state.selectedBlockData = block || null;
  }
  
  export function setSelectedAttackAttackerTokenId(tokenId = null) {
    state.selectedAttackAttackerTokenId =
      tokenId === null || tokenId === undefined || tokenId === ""
        ? null
        : String(tokenId);
  }
  
  export function setMercenaryProfile(profile = null) {
    state.mercenaryProfile = profile || null;
    applyDefenderProfileToUi(profile || {});
  }
  
  export function setMercenarySlots(slots = []) {
    state.mercenarySlots = Array.isArray(slots) ? slots : [];
  }
  
  export function applyDefenderProfileToUi(profile = {}) {
    const points = Number(
      profile?.defenderPoints ??
      profile?.points ??
      profile?.totalPoints ??
      0
    );
  
    const rank =
      profile?.rankName ??
      profile?.rank ??
      deriveDefenderRank(points);
  
    const discountPercent = Number(
      profile?.discountPercent ??
      profile?.inpiDiscountPercent ??
      deriveDefenderDiscountPercent(points)
    );
  
    state.uiBlockStatus.defenderPoints = points;
    state.uiBlockStatus.defenderRank = rank;
    state.uiBlockStatus.defenderDiscountPercent = discountPercent;
    state.uiBlockStatus.nextRankAt = getNextRankThreshold(points);
    state.uiBlockStatus.canSetBastionTitle = points >= 1000;
  }
  
  export function resetUiBusyFlags() {
    state.uiBusy = createDefaultUiBusyFlags();
  }
  
  /* =========================================================
     DEFENDER HELPERS
     ========================================================= */
  
  export function deriveDefenderRank(points = 0) {
    const p = Number(points || 0);
  
    if (p >= 1001) return "Inpinity Bastion";
    if (p >= 600) return "Citadel Keeper";
    if (p >= 250) return "Guardian";
    if (p >= 100) return "Defender";
    return "Watchman";
  }
  
  export function deriveDefenderDiscountPercent(points = 0) {
    const p = Number(points || 0);
  
    if (p >= 1001) return 10;
    if (p >= 600) return 8;
    if (p >= 250) return 6;
    if (p >= 100) return 4;
    return 2;
  }
  
  export function getNextRankThreshold(points = 0) {
    const p = Number(points || 0);
  
    if (p < 100) return 100;
    if (p < 250) return 250;
    if (p < 600) return 600;
    if (p < 1001) return 1001;
    return 1001;
  }