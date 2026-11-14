import { IS_MOBILE, ID_STRIDE } from './phircle-config.js';
import { state, view, activeFilters, minted, farms, attacks, idToRC } from './phircle-state.js';
import { canvas, hitTest, blockPosition, loop } from './phircle-canvas.js';
import { showBlockInfo } from './phircle-sidebar.js';
import { playSound, haptic } from './phircle-utils.js';

window.toggleFilter = (filter) => {
  if (activeFilters.has(filter)) activeFilters.delete(filter);
  else activeFilters.add(filter);
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', activeFilters.has(chip.dataset.filter));
  });
  playSound(480, 0.05); haptic([5]);
};

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

window.togglePause = () => {
  state.isPaused = !state.isPaused;
  const btn = document.getElementById('pauseBtn');
  const status = document.getElementById('statusText');
  if (state.isPaused) {
    view.tZoom = IS_MOBILE ? 2.8 : 2.0;
    view.tOx = 0; view.tOy = 0;
    btn.innerHTML = "▶️ RESUME"; btn.classList.add('active');
    status.innerHTML = '<span style="color:#ff8800">● QUANTUM FREEZE</span>';
    playSound(220, 0.2, 'sine'); haptic([20, 50, 20]);
  } else {
    view.tZoom = 1.0; view.tOx = 0; view.tOy = 0;
    btn.innerHTML = "⏸️ PAUSE / EXPLODE"; btn.classList.remove('active');
    status.innerHTML = '<span class="live">● LIVE</span>';
    playSound(440, 0.2, 'sine');
  }
};

// LAYER BUTTONS
document.querySelectorAll('#layers button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#layers button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.id === 'btnMyFarms') state.activeLayer = 'my-farms';
    else if (btn.id === 'btnWarRoom') { state.activeLayer = 'war-room'; playSound(180, 0.2, 'square'); }
    else if (btn.id === 'btnHistory') { window.openAttackHistory(); return; }
    else state.activeLayer = btn.dataset.layer;
    playSound(440, 0.05);
  });
});

// MOUSE
let isDragging = false, wasDragging = false, dragStart = {x:0,y:0}, dragOrig = {x:0,y:0};
const tooltip = document.getElementById('tooltip');

canvas.addEventListener('mousemove', e => {
  if (isDragging) return;
  const r = canvas.getBoundingClientRect();
  const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (hit) {
    state.hoveredBlock = hit.id;
    const m = minted.get(hit.id);
    let html = `<strong>Block #${hit.id}</strong>`;
    if (m) {
      const rarity = m.rarity != null ? ['Bronze','Silver','Gold','Platinum','Diamond'][m.rarity] : 'Unrevealed';
      html += `<br>${rarity}`;
      if (farms.has(hit.id)) html += `<br><span style="color:#00ff88">Farming</span>`;
      if (state.userAddress && m.owner === state.userAddress) html += `<br><span style="color:#00e5ff">YOU</span>`;
    } else html += `<br>Unminted`;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY - 15) + 'px';
    canvas.style.cursor = 'pointer';
  } else {
    state.hoveredBlock = null; tooltip.style.display = 'none';
    canvas.style.cursor = isDragging ? 'grabbing' : 'crosshair';
  }
});
canvas.addEventListener('mouseleave', () => { state.hoveredBlock = null; tooltip.style.display = 'none'; });
canvas.addEventListener('click', e => {
  if (wasDragging) return;
  const r = canvas.getBoundingClientRect();
  const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (hit) showBlockInfo(hit);
});
canvas.addEventListener('mousedown', e => {
  isDragging = true; wasDragging = false;
  dragStart = {x:e.clientX,y:e.clientY}; dragOrig = {x:view.tOx,y:view.tOy};
  tooltip.style.display = 'none';
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragging = true;
  view.tOx = dragOrig.x + dx; view.tOy = dragOrig.y + dy;
});
window.addEventListener('mouseup', () => isDragging = false);

// TOUCH
let touchMode = null, touchStartDist = 0, touchStartZoom = 1, touchStartMidX = 0, touchStartMidY = 0, touchStartOx = 0, touchStartOy = 0;

canvas.addEventListener('touchstart', e => {
  tooltip.style.display = 'none';
  if (e.touches.length === 1) {
    touchMode = 'drag'; isDragging = true; wasDragging = false;
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOrig = { x: view.tOx, y: view.tOy };
  } else if (e.touches.length === 2) {
    touchMode = 'pinch'; isDragging = false;
    touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    touchStartZoom = view.tZoom;
    touchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    touchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    touchStartOx = view.tOx; touchStartOy = view.tOy;
    e.preventDefault();
  }
}, {passive: false});

canvas.addEventListener('touchmove', e => {
  if (touchMode === 'drag' && e.touches.length === 1) {
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragging = true;
    view.tOx = dragOrig.x + dx; view.tOy = dragOrig.y + dy;
  } else if (touchMode === 'pinch' && e.touches.length === 2) {
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const scale = dist / touchStartDist;
    const newZoom = Math.max(0.5, Math.min(14, touchStartZoom * scale));
    const rect = canvas.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left;
    const midY = (e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top;
    const startMidXRel = touchStartMidX - rect.left, startMidYRel = touchStartMidY - rect.top;
    const worldX = (startMidXRel - canvas.width/2 - touchStartOx) / touchStartZoom + canvas.width/2;
    const worldY = (startMidYRel - canvas.height/2 - touchStartOy) / touchStartZoom + canvas.height/2;
    view.tZoom = newZoom;
    view.tOx = midX - canvas.width/2 - (worldX - canvas.width/2) * newZoom;
    view.tOy = midY - canvas.height/2 - (worldY - canvas.height/2) * newZoom;
    e.preventDefault();
  }
}, {passive: false});

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    if (touchMode === 'drag' && !wasDragging) {
      const r = canvas.getBoundingClientRect();
      const touch = e.changedTouches[0];
      const hit = hitTest(touch.clientX - r.left, touch.clientY - r.top);
      if (hit) showBlockInfo(hit);
    }
    isDragging = false; touchMode = null;
  } else if (e.touches.length === 1 && touchMode === 'pinch') {
    touchMode = 'drag';
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOrig = { x: view.tOx, y: view.tOy };
    wasDragging = true; isDragging = true;
  }
}, {passive: false});

canvas.addEventListener('touchcancel', () => { touchMode = null; isDragging = false; });
window.addEventListener('dblclick', e => {
  if (e.target === canvas) { view.tZoom = 1; view.tOx = 0; view.tOy = 0; tooltip.style.display = 'none'; }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  view.tZoom = Math.max(.5, Math.min(14, view.tZoom * (e.deltaY > 0 ? .88 : 1.12)));
}, {passive: false});

// KEYBOARD
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); window.togglePause(); }
  if (e.key === 'Escape') {
    document.getElementById('sidebar').classList.remove('active');
    window.closeSearch(); window.closeTutorial(); window.closeAttackHistory();
    state.lastClickedBlockId = null;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); window.openSearch(); }
  if (e.key >= '1' && e.key <= '7') {
    const layers = ['rarity','owner','farming','attack','partner','war-room','my-farms'];
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < layers.length) window.switchLayer(layers[idx]);
  }
});