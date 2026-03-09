/* =========================================================
   MAP STATE
   ========================================================= */

   import { byId } from "./utils.js";

   export const MAP_CONST = {
     BASE_BLOCK_SIZE: 24,
     MOVE_THRESHOLD: 10,
     rarityClass: [
       "rarity-bronze",
       "rarity-silver",
       "rarity-gold",
       "rarity-platinum",
       "rarity-diamond"
     ],
     rarityColors: [
       "#cd7f32",
       "#c0c0c0",
       "#ffd700",
       "#e5e4e2",
       "#b9f2ff"
     ]
   };
   
   export const mapState = {
     readOnlyProvider: null,
     nftReadOnlyContract: null,
   
     tokens: {},
     userResources: [],
     userAttacks: [],
   
     selectedTokenId: null,
     selectedTokenOwner: null,
     selectedAttackerTokenId: null,
   
     attacksTicker: null,
     attacksPoller: null,
     dataPoller: null,
     isConnecting: false,
   
     scale: 1,
     offsetX: 0,
     offsetY: 0,
     isDragging: false,
     lastMouseX: 0,
     lastMouseY: 0,
     pinchStartDist: 0,
   
     touchStartX: 0,
     touchStartY: 0,
     touchMoved: false
   };
   
   export function getMapDom() {
     const canvas = byId("pyramidCanvas");
   
     return {
       canvas,
       ctx: canvas?.getContext("2d") || null,
       container: byId("canvasContainer"),
       tooltip: byId("tooltip"),
   
       blockDetailDiv: byId("blockDetail"),
       actionPanel: byId("actionPanel"),
       ownerActionsDiv: byId("ownerActions"),
       protectionInput: byId("protectionInput"),
       attackInput: byId("attackInput"),
       actionMessage: byId("actionMessage"),
       userResourcesDiv: byId("userResources"),
       userAttacksList: byId("userAttacksList")
     };
   }