import { state, activityLog } from './phircle-state.js';

let audioCtx = null;
export function initAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
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
export function haptic(pattern = [10]) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch(e) {} }
}
export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, duration);
}

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
    return `<div class="activity-item ${e.type}">${timeStr} · ${e.message}</div>`;
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

import { confettiParticles } from './phircle-state.js';
import { TAU } from './phircle-config.js';
export function spawnConfetti(screenX, screenY, color = '#ffcc00') {
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * TAU;
    const speed = 3 + Math.random() * 6;
    confettiParticles.push({
      x: screenX, y: screenY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      life: 1.8, maxLife: 1.8,
      color: Math.random() < 0.5 ? color : (Math.random() < 0.5 ? '#00ff88' : '#00e5ff'),
      size: 3 + Math.random() * 4
    });
  }
}
export function updateAndDrawConfetti(ctx, dt) {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25;
    p.vx *= 0.99; p.life -= dt;
    if (p.life <= 0) { confettiParticles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
export function hideLoading() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) { ov.classList.add('hidden'); setTimeout(() => ov.style.display = 'none', 500); }
}