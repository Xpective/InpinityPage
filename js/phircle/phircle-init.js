import { state, idToRC, isValidBlockId } from './phircle-state.js';
import { loop } from './phircle-canvas.js';
import { connectReadOnly } from './phircle-contracts.js';
import { loadLive } from './phircle-data.js';
import { initAudio, logActivity } from './phircle-utils.js';

// Zusätzliche Module importieren, damit deren `window.xxx` registriert werden
import './phircle-tutorial.js';
import './phircle-search.js';
import './phircle-history.js';
import './phircle-sidebar.js';
import './phircle-interaction.js';

function parseDeepLink() {
  const hash = window.location.hash;
  const m = hash.match(/^#block\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1]);
    if (isValidBlockId(id)) {
      const rc = idToRC(id);
      setTimeout(() => {
        window.focusOnBlock(rc.row, rc.col);
        window.showBlockInfo({ row: rc.row, col: rc.col, id });
        logActivity(`Loaded from deep link: Block #${id}`, 'info');
      }, 1500);
    }
  }
}

// NEU: Browser-Notification bei fertigen Farmen
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch(e) {}
  }
}

(async () => {
  initAudio();
  await connectReadOnly();
  await loadLive();
  requestAnimationFrame(loop);
  setInterval(() => loadLive(), 30000);
  document.getElementById('radar').classList.add('active');

  if (!localStorage.getItem('phircle_tutorial_done_v20')) {
    setTimeout(() => window.startTutorial(), 1500);
  }
  requestNotificationPermission();
  logActivity('Phircle V20 loaded', 'info');
  parseDeepLink();
})();