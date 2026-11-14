import { state, activityLog, confettiParticles } from './phircle-state.js';
import { TAU } from './phircle-config.js';

// ============================================================
// AUDIO (mit Mobile-Resume)
// ============================================================
let audioCtx = null;
export function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) {}
  }
  // Mobile: AudioContext braucht Gesture-Resume
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}
export function playSound(freq = 440, duration = 0.08, type = 'sine', volume = 0.04) {
  if (!state.soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
// 🆕 Sound-Sweep für epischere Effekte
export function playSweep(startFreq, endFreq, duration = 0.3, type = 'sine') {
  if (!state.soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

// ============================================================
// HAPTIC (mit Presets)
// ============================================================
export const HAPTIC = {
  click: [5],
  success: [10, 30, 10],
  error: [50, 30, 50, 30, 50],
  attack: [30, 50, 30],
  mint: [20, 50, 20],
};
export function haptic(pattern = [10]) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch(e) {} }
}

// ============================================================
// TOAST (mit Action-Button + Stack-Limit)
// ============================================================
const MAX_TOASTS = 4;
export function toast(message, type = 'info', duration = 3000, action = null) {
  const container = document.getElementById('toasts');
  if (!container) return;
  // Stack-Limit: älteste entfernen
  while (container.children.length >= MAX_TOASTS) {
    container.removeChild(container.firstChild);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  if (action) {
    el.innerHTML = `<span>${message}</span>`;
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.cssText = 'margin-left:12px;background:none;border:1px solid currentColor;color:inherit;padding:4px 10px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:11px;';
    btn.onclick = () => { action.onClick?.(); el.remove(); };
    el.appendChild(btn);
  } else {
    el.textContent = message;
  }
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ============================================================
// ACTIVITY FEED
// ============================================================
export function logActivity(message, type = 'info') {
  activityLog.unshift({ message, type, time: Date.now() });
  if (activityLog.length > 20) activityLog.pop();
  renderActivityFeed();
}
export function renderActivityFeed() {
  const items = document.getElementById('activityItems');
  if (!items) return;
  const recent = activityLog.slice(0, 10);
  items.innerHTML = recent.map(e => {
    const ago = Math.floor((Date.now() - e.time) / 1000);
    const timeStr = ago < 60 ? `${ago}s` : `${Math.floor(ago/60)}m`;
    return `<div class="activity-item ${e.type}">${timeStr} · ${escapeHtml(e.message)}</div>`;
  }).join('');
}
window.toggleActivityFeed = () => {
  const feed = document.getElementById('activityFeed');
  feed.classList.toggle('collapsed');
  document.getElementById('activityToggle').textContent = feed.classList.contains('collapsed') ? '+' : '−';
};
window.toggleSound = () => {
  state.soundEnabled = !state.soundEnabled;
  document.getElementById('soundBtn').classList.toggle('active', state.soundEnabled);
  document.getElementById('soundBtn').textContent = state.soundEnabled ? '🔊' : '🔇';
  if (state.soundEnabled) { initAudio(); playSound(660, 0.1); }
  toast(state.soundEnabled ? 'Sound enabled' : 'Sound disabled', 'info');
};
window.toggleHud = () => {
  const hud = document.getElementById('hud');
  hud.classList.toggle('collapsed');
  document.getElementById('hudToggle').textContent = hud.classList.contains('collapsed') ? 'SHOW' : 'HIDE';
};

// ============================================================
// CONFETTI (mit Rotation + mehr Farben)
// ============================================================
const CONFETTI_COLORS = ['#ffcc00', '#00ff88', '#00e5ff', '#ff3366', '#ff8800', '#c060ff'];
export function spawnConfetti(screenX, screenY, color = '#ffcc00', count = 40) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 3 + Math.random() * 6;
    confettiParticles.push({
      x: screenX, y: screenY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      life: 1.8, maxLife: 1.8,
      rotation: Math.random() * TAU,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      color: Math.random() < 0.4 ? color : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 3 + Math.random() * 4,
      shape: Math.random() < 0.3 ? 'square' : 'circle'
    });
  }
}
export function updateAndDrawConfetti(ctx, dt) {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25;
    p.vx *= 0.99; p.life -= dt;
    p.rotation = (p.rotation || 0) + (p.rotSpeed || 0);
    if (p.life <= 0) { confettiParticles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.shape === 'square') {
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================
// HELPERS
// ============================================================
export function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) { ov.classList.add('hidden'); setTimeout(() => ov.style.display = 'none', 500); }
}

// 🆕 Sicheres HTML-Escaping für Toast/Activity-Feed
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 🆕 Zahlen-Formatierung: 1234 → "1.2k", 1234567 → "1.2M"
export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1e6) return (n/1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  if (abs < 1e9) return (n/1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n/1e9).toFixed(2) + 'B';
}

// 🆕 Debounce / Throttle
export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}
export function throttle(fn, limit = 100) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) { fn(...args); inThrottle = true; setTimeout(() => inThrottle = false, limit); }
  };
}

// 🆕 Clipboard mit Fallback
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    return true;
  } catch { return false; }
}

// 🆕 Debug-Logger (nur aktiv wenn ?debug in URL)
export const debug = (() => {
  const enabled = new URLSearchParams(location.search).has('debug');
  return (...args) => { if (enabled) console.log('%c[phircle]', 'color:#00e5ff', ...args); };
})();