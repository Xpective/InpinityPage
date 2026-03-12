/* =========================================================
   MAP STATE – V6 + MERCENARY V4
   ========================================================= */

import { byId } from "./utils.js";

export const BASE_BLOCK_SIZE = 24;
export const MOVE_THRESHOLD = 10;

export const rarityColors = [
  "#cd7f32", // Bronze
  "#c0c0c0", // Silver
  "#ffd700", // Gold
  "#e5e4e2", // Platinum
  "#b9f2ff"  // Diamond
];

export const MAP_CONST = {
  BASE_BLOCK_SIZE,
  MOVE_THRESHOLD,
  rarityClass: [
    "rarity-bronze",
    "rarity-silver",
    "rarity-gold",
    "rarity-platinum",
    "rarity-diamond"
  ],
  rarityColors
};

export const mapState = {
  /* =========================
     READ-ONLY / PROVIDERS
     ========================= */
  readOnlyProvider: null,
  nftReadOnlyContract: null,
  farmingV6ReadOnlyContract: null,
  piratesV6ReadOnlyContract: null,
  mercenaryV4ReadOnlyContract: null,
  partnershipV2ReadOnlyContract: null,
  resourceTokenReadOnlyContract: null,

  /* =========================
     DATA
     ========================= */
  tokens: {},
  userResources: [],
  userAttacks: [],
  userBlocks: [],

  /* =========================
     SUBGRAPH / CACHE
     ========================= */
  cachedFarmsV6: [],
  cachedProtections: [],
  cachedFarmV6Map: new Map(),
  cachedProtectionMap: new Map(),

  mercenaryProfile: null,
  mercenarySlots: [],
  mercenaryProtectionByToken: new Map(),

  /* =========================
     CURRENT SELECTION
     ========================= */
  selectedTokenId: null,
  selectedTokenOwner: null,
  selectedAttackAttackerTokenId: null,

  selectedProtectionSlotIndex: 0,
  selectedProtectionDays: 7,
  selectedProtectionPaymentMode: "resources",

  /* =========================
     ATTACK / DATA TICKERS
     ========================= */
  attacksTicker: null,
  attacksPoller: null,
  dataPoller: null,
  isConnecting: false,

  /* =========================
     CANVAS VIEWPORT
     ========================= */
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  pinchStartDist: 0,

  touchStartX: 0,
  touchStartY: 0,
  touchMoved: false,

  /* =========================
     LEGEND / PANEL UI
     ========================= */
  legendCollapsed: false,
  legendDragActive: false,
  legendResizeActive: false,
  legendDragStartX: 0,
  legendDragStartY: 0,
  legendResizeStartX: 0,
  legendPanelStartLeft: 0,
  legendPanelStartTop: 0,
  legendPanelStartWidth: 390
};

export function resetMapRuntimeState() {
  mapState.tokens = {};
  mapState.userResources = [];
  mapState.userAttacks = [];
  mapState.userBlocks = [];

  mapState.cachedFarmsV6 = [];
  mapState.cachedProtections = [];
  mapState.cachedFarmV6Map = new Map();
  mapState.cachedProtectionMap = new Map();

  mapState.mercenaryProfile = null;
  mapState.mercenarySlots = [];
  mapState.mercenaryProtectionByToken = new Map();

  mapState.selectedTokenId = null;
  mapState.selectedTokenOwner = null;
  mapState.selectedAttackAttackerTokenId = null;

  mapState.selectedProtectionSlotIndex = 0;
  mapState.selectedProtectionDays = 7;
  mapState.selectedProtectionPaymentMode = "resources";
}

export function stopMapPollers() {
  if (mapState.attacksTicker) {
    clearInterval(mapState.attacksTicker);
    mapState.attacksTicker = null;
  }

  if (mapState.attacksPoller) {
    clearInterval(mapState.attacksPoller);
    mapState.attacksPoller = null;
  }

  if (mapState.dataPoller) {
    clearInterval(mapState.dataPoller);
    mapState.dataPoller = null;
  }
}

export function getMapDom() {
  const canvas = byId("pyramidCanvas");

  return {
    canvas,
    ctx: canvas?.getContext("2d") || null,
    container: byId("canvasContainer"),
    tooltip: byId("tooltip"),

    legendPanel: byId("legendPanel"),
    legendContent: byId("legendContent"),
    collapseBtn: byId("collapseBtn"),
    resetPosBtn: byId("resetPosBtn"),
    dragHandle: byId("dragHandle"),
    resizeHandle: byId("resizeHandle"),

    blockDetailDiv: byId("blockDetail"),
    actionPanel: byId("actionPanel"),
    ownerActionsDiv: byId("ownerActions"),

    protectionInput: byId("protectionInput"),
    attackInput: byId("attackInput"),
    actionMessage: byId("actionMessage"),

    userResourcesDiv: byId("userResources"),
    userAttacksList: byId("userAttacksList"),

    mercenaryPanel: byId("mercenaryPanel"),
    mercenaryRank: byId("mercenaryRank"),
    mercenaryPoints: byId("mercenaryPoints"),
    mercenaryDiscount: byId("mercenaryDiscount"),
    mercenarySlotsUnlocked: byId("mercenarySlotsUnlocked"),
    mercenaryTitle: byId("mercenaryTitle"),
    mercenarySlotsInfo: byId("mercenarySlotsInfo"),
    mercenaryCostInfo: byId("mercenaryCostInfo"),
    protectSlotInfo: byId("protectSlotInfo"),
    protectDaysInfo: byId("protectDaysInfo"),
    protectMessage: byId("protectMessage"),
    protectionStatus: byId("protectionStatus"),
    protectionExpiry: byId("protectionExpiry"),

    protectTokenId: byId("protectTokenId"),
    protectSlotIndex: byId("protectSlotIndex"),
    protectDays: byId("protectDays"),
    mercenaryPaymentMode: byId("mercenaryPaymentMode"),

    protectBtn: byId("protectBtn"),
    setProtectionBtn: byId("setProtectionBtn"),
    extendProtectionBtn: byId("extendProtectionBtn"),
    cancelProtectionBtn: byId("cancelProtectionBtn"),
    moveProtectionBtn: byId("moveProtectionBtn"),
    emergencyMoveProtectionBtn: byId("emergencyMoveProtectionBtn"),
    unlockSlot2Btn: byId("unlockSlot2Btn"),
    unlockSlot3Btn: byId("unlockSlot3Btn"),
    cleanupProtectionBtn: byId("cleanupProtectionBtn"),

    bastionTitleInput: byId("bastionTitleInput"),
    saveBastionTitleBtn: byId("saveBastionTitleBtn")
  };
}
