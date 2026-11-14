import { STORAGE_KEYS, PERF, IS_LOW_END, MAX_ATTACKS_PER_WALLET } from './phircle-config.js';
import {
  state, idToRC, isValidBlockId, farms, farmStartTimes,
  farmLastClaimTimes, attacks, minted, MAX_FARM_PAYOUT_DAYS
} from './phircle-state.js';
import { loop, canvas } from './phircle-canvas.js';
import { connectReadOnly } from './phircle-contracts.js';
import { loadLive, forceRefresh } from './phircle-data.js';
import { initAudio, logActivity, toast, debug } from './phircle-utils.js';

// Module mit Side-Effects (window.xxx registrieren)
import './phircle-tutorial.js';
import './phircle-search.js';
import './phircle-history.js';
import './phircle-sidebar.js';
import './phircle-interaction.js';

import { maybeAutoShowTutorial, maybeShowConnectTip } from './phircle-tutorial.js';

// ============================================================
// ERROR BOUNDARY (globaler Fehler-Handler)
// ============================================================
window.addEventListener('error', (e) => {
  console.error('[phircle] Uncaught error:', e.error || e.message);
  debug('Error boundary caught', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  // Rejected fetch zu Subgraph: erwartet, kein Toast
  const msg = (e.reason?.message || String(e.reason)).toLowerCase();
  if (msg.includes('fetch') || msg.includes('subgraph') || msg.includes('network')) {
    debug('Suppressed network rejection');
    e.preventDefault();
    return;
  }
  console.error('[phircle] Unhandled rejection:', e.reason);
});

// ============================================================
// DEEP-LINK-PARSING (robust + Wallet-agnostisch)
// ============================================================
function parseDeepLink() {
  const hash = window.location.hash;
  // Support: #block/1234 AND #1234 AND ?block=1234
  let id = null;

  const m1 = hash.match(/^#block\/(\d+)$/);
  if (m1) id = parseInt(m1[1]);
  else {
    const m2 = hash.match(/^#(\d+)$/);
    if (m2) id = parseInt(m2[1]);
  }
  if (!id) {
    const params = new URLSearchParams(location.search);
    const b = params.get('block');
    if (b) id = parseInt(b);
  }

  if (id != null && isValidBlockId(id)) {
    const rc = idToRC(id);
    setTimeout(() => {
      window.focusOnBlock?.(rc.row, rc.col);
      window.showBlockInfo?.({ row: rc.row, col: rc.col, id });
      logActivity(`Loaded from deep link: Block #${id}`, 'info');
      debug('Deep-link loaded', { id, rc });
    }, 1200);
  }
}

// ============================================================
// WALLET-RECONNECT (Idee 4)
// ============================================================
function setupWalletListeners() {
  if (!window.ethereum) return;

  // Account-Changed (MetaMask Wallet-Switch)
  window.ethereum.on?.('accountsChanged', async (accounts) => {
    debug('accountsChanged', accounts);
    if (!accounts.length) {
      // Disconnect
      state.userAddress = null;
      state.userSigner = null;
      const btn = document.getElementById('wallet');
      if (btn) { btn.textContent = '🔌 Wallet'; btn.classList.remove('connected'); }
      toast('Wallet disconnected', 'info');
      logActivity('Wallet disconnected', 'info');
      return;
    }
    // Reconnect mit neuem Account
    const newAddr = accounts[0].toLowerCase();
    const oldAddr = state.userAddress;
    if (newAddr === oldAddr) return;

    state.userAddress = newAddr;
    state.userSigner = null;
    const btn = document.getElementById('wallet');
    if (btn) {
      btn.textContent = newAddr.slice(0, 6) + '…' + newAddr.slice(-4);
      btn.classList.add('connected');
    }
    toast(`🔄 Wallet switched to ${newAddr.slice(0,6)}…`, 'success');
    logActivity(`Wallet switched → ${newAddr.slice(0,6)}…`, 'info');

    // Refresh, aber View-State bleibt
    await forceRefresh(newAddr);
    maybeShowConnectTip();

    // Zeige aktuelle Block-Info neu (falls offen)
    if (state.lastClickedBlockId) {
      const rc = idToRC(state.lastClickedBlockId);
      if (rc) window.showBlockInfo?.({ row: rc.row, col: rc.col, id: state.lastClickedBlockId });
    }
  });

  // Chain-Changed (falsches Netzwerk)
  window.ethereum.on?.('chainChanged', (chainId) => {
    debug('chainChanged', chainId);
    const id = parseInt(chainId, 16);
    if (id !== 8453) {
      toast('⚠️ Wrong network. Please switch to Base.', 'error', 8000);
    } else {
      toast('✓ Connected to Base', 'success', 2000);
      forceRefresh(state.userAddress);
    }
  });
}

// ============================================================
// BROWSER-NOTIFICATIONS (Farm-Cap & Attack-Ready)
// ============================================================
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission === 'denied') return;
  // Erst nach 5s fragen (nicht beim Laden)
  setTimeout(async () => {
    try { await Notification.requestPermission(); } catch {}
  }, 5000);
}

let lastNotifCheck = 0;
let shownNotifKeys = new Set(); // Verhindert Spam

function checkNotifications() {
  if (Notification.permission !== 'granted') return;
  if (!state.userAddress) return;
  if (Date.now() - lastNotifCheck < 60000) return; // max 1x pro Minute
  lastNotifCheck = Date.now();

  // 1. Capped Farms
  for (const farmId of farms) {
    const block = minted.get(farmId);
    if (block?.owner !== state.userAddress) continue;
    const start = farmStartTimes.get(farmId);
    if (!start) continue;
    const lastClaim = farmLastClaimTimes.get(farmId);
    const base = lastClaim || start;
    const days = (Date.now() - base) / (24 * 60 * 60 * 1000);
    if (days >= MAX_FARM_PAYOUT_DAYS) {
      const key = `cap:${farmId}:${Math.floor(days)}`;
      if (shownNotifKeys.has(key)) continue;
      shownNotifKeys.add(key);
      new Notification('🌾 Farm at Cap', {
        body: `Block #${farmId} reached ${MAX_FARM_PAYOUT_DAYS} days. Claim now!`,
        icon: '/favicon.ico',
        tag: `farm-cap-${farmId}`
      });
    }
  }

  // 2. Ready Attacks (eigene)
  for (const [targetId, atk] of attacks) {
    const attackerBlock = minted.get(atk.attackerTokenId);
    if (attackerBlock?.owner !== state.userAddress) continue;
    if (atk.endTimestamp - Date.now() > 0) continue;
    const key = `ready:${targetId}:${atk.attackIndex}`;
    if (shownNotifKeys.has(key)) continue;
    shownNotifKeys.add(key);
    new Notification('⚔️ Attack Ready', {
      body: `Your attack on #${targetId} is ready. Execute now!`,
      icon: '/favicon.ico',
      tag: `attack-ready-${targetId}`
    });
  }
}

// ============================================================
// PERFORMANCE BUDGET (Idee 6)
// ============================================================
let perfMode = localStorage.getItem(STORAGE_KEYS.perfMode) || 'auto';
let perfLevel = 'none'; // none / low / medium / high
let lowFpsSince = null;
let highFpsSince = null;
let fpsHistory = [];

function checkPerformance(now) {
  if (perfMode !== 'auto') return;
  const fps = (() => {
    // Grobe FPS aus Frame-Delta
    const delta = now - (window.__lastFrame || now);
    return delta > 0 ? Math.min(60, 1000 / delta) : 60;
  })();
  fpsHistory.push(fps);
  if (fpsHistory.length > 10) fpsHistory.shift();
  const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

  if (avgFps < PERF.lowFPS) {
    if (!lowFpsSince) lowFpsSince = now;
    if (now - lowFpsSince > PERF.lowFPSDurationMs && perfLevel !== 'high') {
      // Downgrade
      perfLevel = perfLevel === 'none' ? 'low' : perfLevel === 'low' ? 'medium' : 'high';
      document.body.classList.add(`perf-${perfLevel}`);
      debug(`Performance downgrade → ${perfLevel}`);
      lowFpsSince = null;
    }
  } else {
    lowFpsSince = null;
  }

  if (avgFps > PERF.highFPS) {
    if (!highFpsSince) highFpsSince = now;
    if (now - highFpsSince > PERF.highFPSDurationMs && perfLevel !== 'none') {
      // Upgrade
      document.body.classList.remove(`perf-${perfLevel}`);
      perfLevel = perfLevel === 'high' ? 'medium' : perfLevel === 'medium' ? 'low' : 'none';
      if (perfLevel !== 'none') document.body.classList.add(`perf-${perfLevel}`);
      debug(`Performance upgrade → ${perfLevel}`);
      highFpsSince = null;
    }
  } else {
    highFpsSince = null;
  }
}

// ============================================================
// VISIBILITY-CHANGE (Pause Rendering wenn Tab inaktiv)
// ============================================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    debug('Tab hidden — pausing refresh');
  } else {
    debug('Tab visible — refreshing');
    forceRefresh(state.userAddress);
  }
});

// ============================================================
// PERIODIC REFRESH (mit Backoff bei Fehlern)
// ============================================================
let refreshInterval = 30000;
function scheduleRefresh() {
  setTimeout(async () => {
    if (!document.hidden) {
      await loadLive({ force: false, wallet: state.userAddress });
      checkNotifications();
    }
    // Backoff: 30s → 60s bei Fehlern, zurück auf 30s bei Erfolg
    if (state.apiStatus === 'error') {
      refreshInterval = Math.min(60000, refreshInterval * 1.5);
    } else {
      refreshInterval = 30000;
    }
    scheduleRefresh();
  }, refreshInterval);
}

// ============================================================
// MAIN INIT
// ============================================================
(async () => {
  debug('Init starting', { IS_LOW_END, perfMode });

  // 1. Audio (User-Gesture erforderlich auf Mobile)
  initAudio();
  document.addEventListener('touchstart', initAudio, { once: true });
  document.addEventListener('click', initAudio, { once: true });

  // 2. Read-Only Contracts
  try {
    await connectReadOnly();
  } catch (e) {
    console.error('Read-only connection failed:', e);
    toast('⚠️ Contract connection failed', 'error', 5000);
  }

  // 3. Initial Data Load
  try {
    await loadLive({ force: true });
  } catch (e) {
    console.error('Initial data load failed:', e);
    toast('⚠️ Could not load data — retry in 10s', 'error', 5000);
    setTimeout(() => loadLive({ force: true }), 10000);
  }

  // 4. Start Render-Loop
  requestAnimationFrame(loop);

  // 5. Radar aktivieren
  document.getElementById('radar')?.classList.add('active');

  // 6. Wallet-Listener
  setupWalletListeners();

  // 7. Notifications
  requestNotificationPermission();

  // 8. Tutorial
  maybeAutoShowTutorial();

  // 9. Deep-Link
  parseDeepLink();

  // 10. Periodic Refresh (mit Backoff)
  scheduleRefresh();

  // 11. Performance-Monitoring
  const perfCheckInterval = setInterval(() => {
    checkPerformance(performance.now());
  }, 1000);

  // 12. Cleanup on unload
  window.addEventListener('beforeunload', () => {
    clearInterval(perfCheckInterval);
  });

  logActivity('Phircle V21 loaded', 'info');
  debug('Init complete');
})();

// ============================================================
// WINDOW GLOBALS für Debugging
// ============================================================
window.phircleDebug = {
  state,
  farms,
  attacks,
  minted,
  farmStartTimes,
  farmLastClaimTimes,
  version: 'V21',
  forceRefresh: () => forceRefresh(state.userAddress),
  perfLevel: () => perfLevel
};