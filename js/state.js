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

  /* ==================== USER DATA ==================== */
  userBlocks: [],
  userAttacks: [],
  userResources: [],

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

  /* ==================== MERCENARY PANEL ==================== */
  mercenaryPanelLoaded: false,
  selectedMercenarySlotIndex: 0,
  selectedMercenaryDurationDays: 7,
  selectedMercenaryPayInINPI: false,

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
    protectionSlotCount: 1,
    selectedProtectionSlot: 0,
    canUseSlot2: false,
    canUseSlot3: false,

    defenderPoints: 0,
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
   UI STATE HELPERS
   ========================================================= */

export function resetSelectedBlockUiState() {
  state.uiBlockStatus = {
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
    protectionSlotCount: 1,
    selectedProtectionSlot: 0,
    canUseSlot2: false,
    canUseSlot3: false,

    defenderPoints: 0,
    canSetBastionTitle: false,

    canAttackFromSelectedBlock: false
  };
}

export function applyDefenderProfileToUi(profile = {}) {
  const points = Number(
    profile?.defenderPoints ??
    profile?.points ??
    profile?.totalPoints ??
    0
  );

  state.uiBlockStatus.defenderPoints = points;
  state.uiBlockStatus.canSetBastionTitle = points >= 1000;
}

export function setSelectedBlockState(block = null) {
  state.selectedBlock = block;
  state.selectedBlockId = block ? String(block.tokenId ?? block.id ?? "") : null;
  state.selectedBlockData = block || null;
}

export function resetUiBusyFlags() {
  state.uiBusy = {
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