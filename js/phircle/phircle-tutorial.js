import { STORAGE_KEYS, MAX_FARM_PAYOUT_DAYS, MAX_ATTACKS_PER_WALLET } from './phircle-config.js';
import { state, farms, attacks, farmStartTimes, getAttacksUsed, getMyReadyQueue } from './phircle-state.js';
import { playSound, haptic, logActivity } from './phircle-utils.js';

// ============================================================
// 8 TUTORIAL-STEPS (dynamisch an User-State angepasst)
// ============================================================
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Phircle',
    body: `The <strong>Inpinity Pyramid</strong> as a circle. <em>10,000 blocks</em> in 100 rings around the center. <br><br>👆 <strong>Swipe</strong> to explore · <strong>Pinch</strong> to zoom · <strong>Tap</strong> for details`,
    requiresWallet: false
  },
  {
    id: 'layers',
    title: '7 Visual Layers',
    body: `<strong>RARITY</strong> · <strong>OWNER</strong> · <strong>FARMING</strong> · <strong>ATTACK</strong> · <strong>PARTNER</strong><br><br>Plus: <em>💎 MY FARMS</em> · <em>🚨 WAR ROOM</em> · <em>📜 HISTORY</em><br><br>Keyboard <strong>1-7</strong> switches instantly.`,
    requiresWallet: false
  },
  {
    id: 'select',
    title: 'Select a Block',
    body: `<strong>Tap any block</strong> to open its sidebar.<br><br>• Own blocks: <em>Farm, Claim, Set as Attacker</em><br>• Foreign blocks: <em>Start Attack</em><br>• Empty blocks: <em>Mint</em><br><br>Your last 5 blocks stay at the bottom right.`,
    requiresWallet: false
  },
  {
    id: 'freeze',
    title: 'Quantum Freeze',
    body: `Press <strong>PAUSE / EXPLODE</strong> (or <kbd>Space</kbd>) — rings <em>explode outward</em>, zoom jumps to 2×.<br><br>Perfect for precisely tapping dense inner blocks. Press again to return live.`,
    requiresWallet: false
  },
  {
    id: 'farm',
    title: `Farming & the ${MAX_FARM_PAYOUT_DAYS}-Day Cap`,
    body: `Start farming on your own blocks — daily rewards compound at <em>+3% per day</em>.<br><br>⚠️ <strong>Important:</strong> After <em>${MAX_FARM_PAYOUT_DAYS} days</em>, rewards are <strong>CAPPED</strong>. You can keep the farm running, but no more tokens accrue.<br><br>Watch for the <em style="color:#ff8800">orange ring</em> — it means <strong>claim now</strong>!`,
    requiresWallet: true,
    highlightLayer: 'farming'
  },
  {
    id: 'attack',
    title: 'Attack & Daily Quota',
    body: `Attack foreign blocks with your own attacker block.<br><br>🎯 <strong>Quota:</strong> Only <em>${MAX_ATTACKS_PER_WALLET} attacks per wallet per day</em>.<br><br>⚔️ After the cooldown, your attacker block <strong>pulses green</strong> — tap it and press <em>Execute</em>. <br><br>Or open <strong>📜 HISTORY → ⚡ Queue</strong> for "Execute All Ready" in one tap.`,
    requiresWallet: true,
    highlightLayer: 'attack'
  },
  {
    id: 'search',
    title: 'Command Palette',
    body: `Press <strong>Ctrl/⌘ + K</strong> anywhere.<br><br>Try:<br>• <em>#1234</em> — jump to block<br>• <em>queue</em> — open attack queue<br>• <em>capped</em> — find farms at cap<br>• <em>quota</em> — check your daily attacks<br><br>The palette <strong>learns</strong> your favorites.`,
    requiresWallet: false
  },
  {
    id: 'share',
    title: 'Deep-Links & Notifications',
    body: `Every block you click updates the URL — e.g. <em>#block/1234</em>. <strong>Share it</strong> and the recipient lands exactly on that block.<br><br>🔔 Allow browser notifications to be alerted when your farms hit the cap or attacks are ready to execute.`,
    requiresWallet: false
  }
];

let currentStep = 0;
let filteredSteps = [];

// ============================================================
// STEP FILTERING (basierend auf Wallet-Status)
// ============================================================
function getVisibleSteps() {
  return STEPS.filter(s => !s.requiresWallet || state.userAddress);
}

// ============================================================
// RENDER
// ============================================================
function renderStep() {
  const step = filteredSteps[currentStep];
  if (!step) return;

  document.getElementById('tutStep').textContent = `STEP ${currentStep + 1} / ${filteredSteps.length}`;
  document.getElementById('tutTitle').textContent = step.title;
  document.getElementById('tutBody').innerHTML = step.body;

  const prevBtn = document.getElementById('tutPrev');
  const nextBtn = document.getElementById('tutNext');
  prevBtn.disabled = currentStep === 0;
  const isLast = currentStep === filteredSteps.length - 1;
  nextBtn.textContent = isLast ? 'Start Exploring ✓' : 'Next →';
  nextBtn.style.background = isLast
    ? 'linear-gradient(135deg,#00ff88,#00aa55)'
    : 'linear-gradient(135deg,#ffcc00,#ffaa00)';

  // Dots
  document.getElementById('tutDots').innerHTML = filteredSteps.map((_, i) =>
    `<span class="${i === currentStep ? 'active' : ''}"></span>`
  ).join('');

  // Layer-Highlight
  if (step.highlightLayer && typeof window.switchLayer === 'function') {
    window.switchLayer(step.highlightLayer);
  }
}

// ============================================================
// PUBLIC API
// ============================================================
window.startTutorial = () => {
  filteredSteps = getVisibleSteps();
  currentStep = 0;
  renderStep();
  document.getElementById('tutorial').classList.add('active');
  playSound(520, 0.1);
  logActivity('Tutorial opened', 'info');
};

window.nextTutStep = () => {
  if (currentStep < filteredSteps.length - 1) {
    currentStep++;
    renderStep();
    playSound(520 + currentStep * 60, 0.06);
    haptic([5]);
  } else {
    window.closeTutorial();
  }
};

window.prevTutStep = () => {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
    playSound(480, 0.05);
  }
};

window.closeTutorial = () => {
  document.getElementById('tutorial').classList.remove('active');
  localStorage.setItem(STORAGE_KEYS.tutorialDone, '1');
  logActivity('Tutorial completed', 'info');
  playSound(660, 0.12);
};

// ============================================================
// KEYBOARD: ← → Navigation, ESC schließt
// ============================================================
window.addEventListener('keydown', (e) => {
  const modal = document.getElementById('tutorial');
  if (!modal?.classList.contains('active')) return;

  if (e.key === 'ArrowRight') { e.preventDefault(); window.nextTutStep(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); window.prevTutStep(); }
});

// ============================================================
// AUTO-SHOW (nur beim ersten Besuch)
// ============================================================
export function maybeAutoShowTutorial() {
  if (localStorage.getItem(STORAGE_KEYS.tutorialDone)) return;
  setTimeout(() => {
    if (!state.userAddress) {
      // Zeige nur Step 1-4 (kein Wallet nötig)
      window.startTutorial();
    } else {
      window.startTutorial();
    }
  }, 1800);
}

// ============================================================
// DYNAMIC TIP (nach Wallet-Connect, einmalig)
// ============================================================
let shownConnectTip = false;
export function maybeShowConnectTip() {
  if (shownConnectTip || !state.userAddress) return;
  shownConnectTip = true;
  const usesdQuota = getAttacksUsed(state.userAddress);
  if (usesdQuota === 0) {
    // Neuer User: kurzer Hinweis auf Attack-Quota
    setTimeout(() => {
      window.toast?.(`💡 Tip: You have ${MAX_ATTACKS_PER_WALLET} attacks per day. Open Search (⌘K) → "quota" to check.`, 'info', 6000);
    }, 2000);
  }
}