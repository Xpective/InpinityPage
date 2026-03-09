/* =========================================================
   MAP UI
   - collapse / expand block control
   - drag panel
   - resize panel
   - reset panel position
   - attacker select population
   ========================================================= */

   import { byId } from "./utils.js";
   import { state } from "./state.js";
   import { mapState } from "./map-state.js";
   import { refreshSelectedTargetAttackPreview } from "./map-selection.js";
   
   const PANEL_DEFAULT = {
     desktopWidth: 390,
     tabletWidth: 285,
     mobileWidth: 245,
     top: 20,
     right: 20
   };
   
   let panelBound = false;
   
   function getDefaultPanelWidth() {
     if (window.innerWidth <= 480) return PANEL_DEFAULT.mobileWidth;
     if (window.innerWidth <= 768) return PANEL_DEFAULT.tabletWidth;
     return PANEL_DEFAULT.desktopWidth;
   }
   
   export function setPanelCollapsed(collapsed) {
     const panel = byId("legendPanel");
     const content = byId("legendContent");
     const collapseBtn = byId("collapseBtn");
   
     if (!panel || !content) return;
   
     mapState.legendCollapsed = !!collapsed;
   
     panel.classList.toggle("collapsed", mapState.legendCollapsed);
     content.classList.toggle("collapsed", mapState.legendCollapsed);
   
     if (collapseBtn) {
       collapseBtn.textContent = mapState.legendCollapsed ? "+" : "−";
       collapseBtn.setAttribute(
         "aria-label",
         mapState.legendCollapsed ? "Expand panel" : "Collapse panel"
       );
       collapseBtn.title = mapState.legendCollapsed ? "Expand" : "Collapse";
     }
   }
   
   export function togglePanelCollapsed() {
     setPanelCollapsed(!mapState.legendCollapsed);
   }
   
   export function resetLegendPanelPosition() {
     const panel = byId("legendPanel");
     if (!panel) return;
   
     panel.style.top = `${PANEL_DEFAULT.top}px`;
     panel.style.right = `${PANEL_DEFAULT.right}px`;
     panel.style.left = "auto";
     panel.style.width = `${getDefaultPanelWidth()}px`;
   }
   
   export function populateAttackerSelect() {
     const select = byId("attackAttackerSelect");
     if (!select) return;
   
     select.innerHTML = "";
   
     if (!state.userAddress) {
       const option = document.createElement("option");
       option.value = "";
       option.textContent = "Connect wallet";
       option.disabled = true;
       option.selected = true;
       select.appendChild(option);
       select.disabled = true;
       return;
     }
   
     const ownTokens = Object.entries(mapState.tokens)
       .filter(([_, token]) =>
         token?.owner && token.owner.toLowerCase() === state.userAddress.toLowerCase()
       )
       .sort((a, b) => Number(a[0]) - Number(b[0]));
   
     if (!ownTokens.length) {
       const option = document.createElement("option");
       option.value = "";
       option.textContent = "No own block";
       option.disabled = true;
       option.selected = true;
       select.appendChild(option);
       select.disabled = true;
       return;
     }
   
     select.disabled = false;
   
     let preferred = mapState.selectedAttackAttackerTokenId;
     if (!preferred || !ownTokens.some(([tokenId]) => String(tokenId) === String(preferred))) {
       preferred = String(ownTokens[0][0]);
       mapState.selectedAttackAttackerTokenId = preferred;
     }
   
     ownTokens.forEach(([tokenId, token]) => {
       const option = document.createElement("option");
       option.value = String(tokenId);
   
       const flags = [];
       if (mapState.selectedTokenId && String(mapState.selectedTokenId) === String(tokenId)) {
         flags.push("selected");
       }
       if (token.farmActive) flags.push("V6");
       else if (token.farmV5Active) flags.push("V5");
   
       option.textContent = flags.length
         ? `#${tokenId} (${flags.join(", ")})`
         : `#${tokenId}`;
   
       if (String(preferred) === String(tokenId)) {
         option.selected = true;
       }
   
       select.appendChild(option);
     });
   }
   
   function bindCollapseControls() {
     const collapseBtn = byId("collapseBtn");
     const resetPosBtn = byId("resetPosBtn");
   
     collapseBtn?.addEventListener("click", (e) => {
       e.preventDefault();
       e.stopPropagation();
       togglePanelCollapsed();
     });
   
     resetPosBtn?.addEventListener("click", (e) => {
       e.preventDefault();
       e.stopPropagation();
       resetLegendPanelPosition();
     });
   }
   
   function bindPanelDrag() {
     const panel = byId("legendPanel");
     const dragHandle = byId("dragHandle");
     if (!panel || !dragHandle) return;
   
     dragHandle.addEventListener("mousedown", (e) => {
       if (e.target.closest(".legend-controls")) return;
   
       mapState.legendDragActive = true;
       mapState.legendDragStartX = e.clientX;
       mapState.legendDragStartY = e.clientY;
   
       const rect = panel.getBoundingClientRect();
       panel.style.left = `${rect.left}px`;
       panel.style.top = `${rect.top}px`;
       panel.style.right = "auto";
   
       mapState.legendPanelStartLeft = rect.left;
       mapState.legendPanelStartTop = rect.top;
   
       document.body.style.userSelect = "none";
     });
   
     window.addEventListener("mousemove", (e) => {
       if (!mapState.legendDragActive) return;
   
       const dx = e.clientX - mapState.legendDragStartX;
       const dy = e.clientY - mapState.legendDragStartY;
   
       let newLeft = mapState.legendPanelStartLeft + dx;
       let newTop = mapState.legendPanelStartTop + dy;
   
       const rect = panel.getBoundingClientRect();
       const maxLeft = window.innerWidth - rect.width - 8;
       const maxTop = window.innerHeight - 60;
   
       newLeft = Math.max(8, Math.min(maxLeft, newLeft));
       newTop = Math.max(8, Math.min(maxTop, newTop));
   
       panel.style.left = `${newLeft}px`;
       panel.style.top = `${newTop}px`;
     });
   }
   
   function bindPanelResize() {
     const panel = byId("legendPanel");
     const resizeHandle = byId("resizeHandle");
     if (!panel || !resizeHandle) return;
   
     resizeHandle.addEventListener("mousedown", (e) => {
       e.preventDefault();
       e.stopPropagation();
   
       mapState.legendResizeActive = true;
       mapState.legendResizeStartX = e.clientX;
       mapState.legendPanelStartWidth = panel.getBoundingClientRect().width;
   
       document.body.style.userSelect = "none";
     });
   
     window.addEventListener("mousemove", (e) => {
       if (!mapState.legendResizeActive) return;
   
       const dx = mapState.legendResizeStartX - e.clientX;
       const newWidth = Math.max(245, Math.min(620, mapState.legendPanelStartWidth + dx));
       panel.style.width = `${newWidth}px`;
     });
   }
   
   function bindGlobalMouseUp() {
     window.addEventListener("mouseup", () => {
       mapState.legendDragActive = false;
       mapState.legendResizeActive = false;
       document.body.style.userSelect = "";
     });
   }
   
   function bindAttackerSelect() {
     const select = byId("attackAttackerSelect");
     if (!select) return;
   
     select.addEventListener("change", async () => {
       mapState.selectedAttackAttackerTokenId = select.value || null;
       await refreshSelectedTargetAttackPreview();
     });
   }
   
   export function initMapUI() {
     if (panelBound) return;
     panelBound = true;
   
     bindCollapseControls();
     bindPanelDrag();
     bindPanelResize();
     bindGlobalMouseUp();
     bindAttackerSelect();
   
     setPanelCollapsed(false);
     resetLegendPanelPosition();
   }