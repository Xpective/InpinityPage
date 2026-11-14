import { IS_MOBILE } from './phircle-config.js';
import { state, view, activeFilters, minted, farms, attacks, idToRC } from './phircle-state.js';
import { canvas, hitTest, blockPosition, loop } from './phircle-canvas.js';
import { showBlockInfo } from './phircle-sidebar.js';
import { playSound, haptic, debug } from './phircle-utils.js';

// ============================================================
// FILTERS
// ============================================================
window.toggleFilter = (filter) => {
  if (activeFilters.has(filter)) activeFilters.delete(filter);
  else activeFilters.add(filter);
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', activeFilters.has(chip.dataset.filter));
  });
  playSound(480, 0.05);
  haptic([5]);
};

// ============================================================
// LAYER SWITCH
// ============================================================
window.switchLayer = (layer) => {
  state.activeLayer = layer;
  document.querySelectorAll('#layers button').forEach(b => b.classList.remove('active'));
  if (layer === 'my-farms') document.getElementById('btnMyFarms').classList.add('active');
  else if (layer === 'war-room') document.getElementById('btnWarRoom').classList.add('active');
  else {
    const btn = document.querySelector(`#layers button[data-layer="${layer}"]`);
    if (btn) btn.classList.add('active');
  }
};

// ============================================================
// PAUSE / EXPLODE
// ============================================================
window.togglePause = () => {
  state.isPaused = !state.isPaused;
  const btn = document.getElementById('pauseBtn');
  const status = document.getElementById('statusText');
  if (state.isPaused) {
    view.tZoom = IS_MOBILE ? 2.8 : 2.0;
    view.tOx = 0;
    view.tOy = 0;
    btn.innerHTML = '▶️ RESUME';
    btn.classList.add('active');
    status.innerHTML = '<span style="color:#ff8800">● QUANTUM FREEZE</span>';
    playSound(220, 0.2, 'sine');
    haptic([20, 50, 20]);
  } else {
    view.tZoom = 1.0;
    view.tOx = 0;
    view.tOy = 0;
    btn.innerHTML = '⏸️ PAUSE / EXPLODE';
    btn.classList.remove('active');
    status.innerHTML = '<span class="live">● LIVE</span>';
    playSound(440, 0.2, 'sine');
  }
};

// ============================================================
// LAYER BUTTONS
// ============================================================
document.querySelectorAll('#layers button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#layers button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.id === 'btnMyFarms') state.activeLayer = 'my-farms';
    else if (btn.id === 'btnWarRoom') {
      state.activeLayer = 'war-room';
      playSound(180, 0.2, 'square');
    } else if (btn.id === 'btnHistory') {
      window.openAttackHistory();
      return;
    } else {
      state.activeLayer = btn.dataset.layer;
    }
    playSound(440, 0.05);
  });
});

// ============================================================
// HELPER: Sidebar schließen (inkl. URL-Cleanup)
// ============================================================
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb.classList.contains('active')) return;
  sb.classList.remove('active');
  if (state.lastClickedBlockId) {
    state.lastClickedBlockId = null;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
  }
}
window.__closeSidebar = closeSidebar;

// ============================================================
// MOUSE HANDLERS
// ============================================================
const tooltip = document.getElementById('tooltip');
let isDragging = false;
let wasDragging = false;
let dragStart = { x: 0, y: 0 };
let dragOrig = { x: 0, y: 0 };

// Hover (mit Throttle)
let hoverThrottle = 0;
canvas.addEventListener('mousemove', (e) => {
  if (isDragging) return;
  const now = performance.now();
  if (now - hoverThrottle < 30) return;
  hoverThrottle = now;

  const r = canvas.getBoundingClientRect();
  const hit = hitTest(e.clientX - r.left, e.clientY - r.top);

  if (hit) {
    state.hoveredBlock = hit.id;
    const m = minted.get(hit.id);
    let html = `<strong>Block #${hit.id}</strong>`;
    if (m) {
      const rarity = m.rarity != null ? ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][m.rarity] : 'Unrevealed';
      html += `<br>${rarity}`;
      if (farms.has(hit.id)) html += `<br><span style="color:#00ff88">Farming</span>`;
      if (state.userAddress && m.owner === state.userAddress) html += `<br><span style="color:#00e5ff">YOU</span>`;
      if (attacks.has(hit.id)) html += `<br><span style="color:#ff3333">⚠ Under Attack</span>`;
    } else {
      html += `<br>Unminted`;
    }
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    // Tooltip bleibt im Viewport
    const tipW = 140;
    const tipH = 70;
    let tx = e.clientX + 15;
    let ty = e.clientY - 15;
    if (tx + tipW > innerWidth) tx = e.clientX - tipW - 10;
    if (ty + tipH > innerHeight) ty = e.clientY - tipH - 10;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
    canvas.style.cursor = 'pointer';
  } else {
    state.hoveredBlock = null;
    tooltip.style.display = 'none';
    canvas.style.cursor = isDragging ? 'grabbing' : 'crosshair';
  }
});

canvas.addEventListener('mouseleave', () => {
  state.hoveredBlock = null;
  tooltip.style.display = 'none';
});

// Klick (mit Empty-Area-Close)
canvas.addEventListener('click', (e) => {
  if (wasDragging) return;
  const r = canvas.getBoundingClientRect();
  const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (hit) {
    showBlockInfo(hit);
  } else {
    // Tap auf leeren Bereich → Sidebar schließen
    closeSidebar();
  }
});

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  wasDragging = false;
  dragStart = { x: e.clientX, y: e.clientY };
  dragOrig = { x: view.tOx, y: view.tOy };
  tooltip.style.display = 'none';
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragging = true;
  view.tOx = dragOrig.x + dx;
  view.tOy = dragOrig.y + dy;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// ============================================================
// WHEEL ZOOM (mit Focal-Point-Preservation)
// ============================================================
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const factor = e.deltaY > 0 ? 0.88 : 1.12;
  const newZoom = Math.max(0.5, Math.min(14, view.tZoom * factor));

  // Focal-Point: Mauszeiger bleibt an gleicher Weltposition
  const worldX = (mouseX - (innerWidth / 2) - view.tOx) / view.tZoom + (innerWidth / 2);
  const worldY = (mouseY - (innerHeight / 2) - view.tOy) / view.tZoom + (innerHeight / 2);

  view.tZoom = newZoom;
  view.tOx = mouseX - (innerWidth / 2) - (worldX - (innerWidth / 2)) * newZoom;
  view.tOy = mouseY - (innerHeight / 2) - (worldY - (innerHeight / 2)) * newZoom;
}, { passive: false });

// ============================================================
// TOUCH HANDLERS (mit Gesten-Erkennung)
// ============================================================
let touchMode = null;
let touchStartDist = 0;
let touchStartZoom = 1;
let touchStartMidX = 0, touchStartMidY = 0;
let touchStartOx = 0, touchStartOy = 0;
let longPressTimer = null;
let lastTapTime = 0;
let lastTapX = 0, lastTapY = 0;

function cancelLongPress() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

canvas.addEventListener('touchstart', (e) => {
  tooltip.style.display = 'none';
  cancelLongPress();

  if (e.touches.length === 1) {
    touchMode = 'drag';
    isDragging = true;
    wasDragging = false;
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOrig = { x: view.tOx, y: view.tOy };

    // Long-Press-Detection
    longPressTimer = setTimeout(() => {
      const r = canvas.getBoundingClientRect();
      const hit = hitTest(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
      if (hit) {
        haptic([50]);
        playSound(500, 0.1);
        // Long-press = sofort Block-Info
        showBlockInfo(hit);
        wasDragging = true; // verhindert Click-Trigger
      }
      longPressTimer = null;
    }, 550);
  } else if (e.touches.length === 2) {
    touchMode = 'pinch';
    isDragging = false;
    cancelLongPress();
    touchStartDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    touchStartZoom = view.tZoom;
    touchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    touchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    touchStartOx = view.tOx;
    touchStartOy = view.tOy;
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  // Long-Press canceln bei Bewegung
  if (Math.abs(e.touches[0]?.clientX - dragStart.x) > 10 ||
      Math.abs(e.touches[0]?.clientY - dragStart.y) > 10) {
    cancelLongPress();
  }

  if (touchMode === 'drag' && e.touches.length === 1) {
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragging = true;
    view.tOx = dragOrig.x + dx;
    view.tOy = dragOrig.y + dy;
  } else if (touchMode === 'pinch' && e.touches.length === 2) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const scale = dist / touchStartDist;
    const newZoom = Math.max(0.5, Math.min(14, touchStartZoom * scale));
    const rect = canvas.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    const startMidXRel = touchStartMidX - rect.left;
    const startMidYRel = touchStartMidY - rect.top;
    const worldX = (startMidXRel - innerWidth / 2 - touchStartOx) / touchStartZoom + innerWidth / 2;
    const worldY = (startMidYRel - innerHeight / 2 - touchStartOy) / touchStartZoom + innerHeight / 2;
    view.tZoom = newZoom;
    view.tOx = midX - innerWidth / 2 - (worldX - innerWidth / 2) * newZoom;
    view.tOy = midY - innerHeight / 2 - (worldY - innerHeight / 2) * newZoom;
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  cancelLongPress();

  if (e.touches.length === 0) {
    if (touchMode === 'drag' && !wasDragging) {
      const r = canvas.getBoundingClientRect();
      const touch = e.changedTouches[0];
      const hit = hitTest(touch.clientX - r.left, touch.clientY - r.top);

      const now = Date.now();
      const isDoubleTap = (now - lastTapTime < 300) &&
                          (Math.abs(touch.clientX - lastTapX) < 30) &&
                          (Math.abs(touch.clientY - lastTapY) < 30);

      if (isDoubleTap) {
        // Double-Tap: Zoom-in zum Block
        if (hit) {
          const targetZoom = Math.min(14, view.tZoom * 2);
          const rc = idToRC(hit.id);
          if (rc) {
            const p = blockPosition(rc.row, rc.col);
            view.tZoom = targetZoom;
            view.tOx = -(p.x - (innerWidth / 2)) * targetZoom;
            view.tOy = -(p.y - (innerHeight / 2)) * targetZoom;
            playSound(660, 0.08);
            haptic([10, 20, 10]);
          }
        }
        lastTapTime = 0; // reset
      } else if (hit) {
        showBlockInfo(hit);
      } else {
        // Tap auf leeren Bereich → Sidebar schließen
        closeSidebar();
      }

      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    }
    isDragging = false;
    touchMode = null;
  } else if (e.touches.length === 1 && touchMode === 'pinch') {
    // Übergang pinch → drag
    touchMode = 'drag';
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOrig = { x: view.tOx, y: view.tOy };
    wasDragging = true;
    isDragging = true;
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  cancelLongPress();
  touchMode = null;
  isDragging = false;
});

// ============================================================
// DOUBLE-CLICK (Desktop → Reset)
// ============================================================
window.addEventListener('dblclick', (e) => {
  if (e.target === canvas) {
    view.tZoom = 1;
    view.tOx = 0;
    view.tOy = 0;
    tooltip.style.display = 'none';
  }
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
window.addEventListener('keydown', (e) => {
  // ESC: Schließt Topmost-Modal (Priorität: Search → AttackHistory → Tutorial → Sidebar)
  if (e.key === 'Escape') {
    const searchModal = document.getElementById('searchModal');
    const attackHistoryModal = document.getElementById('attackHistoryModal');
    const tutorial = document.getElementById('tutorial');

    if (searchModal?.classList.contains('active')) {
      window.closeSearch?.();
    } else if (attackHistoryModal?.classList.contains('active')) {
      window.closeAttackHistory?.();
    } else if (tutorial?.classList.contains('active')) {
      window.closeTutorial?.();
    } else {
      closeSidebar();
    }
    return;
  }

  // Space: Pause
  if (e.code === 'Space' && !e.target.matches('input, textarea')) {
    e.preventDefault();
    window.togglePause();
    return;
  }

  // Ctrl/Cmd + K: Search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    window.openSearch?.();
    return;
  }

  // 1-7: Layer-Switch
  if (e.key >= '1' && e.key <= '7' && !e.target.matches('input, textarea')) {
    const layers = ['rarity', 'owner', 'farming', 'attack', 'partner', 'war-room', 'my-farms'];
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < layers.length) window.switchLayer(layers[idx]);
    return;
  }

  // R: Reset View
  if (e.key === 'r' && !e.target.matches('input, textarea')) {
    view.tZoom = 1;
    view.tOx = 0;
    view.tOy = 0;
  }
});

// ============================================================
// CONTEXT MENU PREVENT (Rechtsklick auf Canvas)
// ============================================================
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// ============================================================
// iOS: Prevent Bounce (falls nicht im CSS)
// ============================================================
document.addEventListener('touchmove', (e) => {
  if (e.target === canvas) e.preventDefault();
}, { passive: false });

// ============================================================
// DEBUG: Log initial state
// ============================================================
debug('interaction.js loaded', { IS_MOBILE });