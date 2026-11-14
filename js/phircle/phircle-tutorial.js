import { playSound } from './phircle-utils.js';

const TUTORIAL_STEPS = [
  { title: "Welcome to Phircle", body: "This is the <strong>Inpinity Pyramid</strong> as a circle. 10,000 blocks arranged in 100 rings. <em>Swipe to explore. Pinch to zoom.</em>" },
  { title: "Your Layers", body: "On the right: <strong>Layer Bar</strong>. RARITY, OWNER, FARMING, ATTACK. <em>WAR ROOM</em> zeigt kritische Blöcke, <em>HISTORY</em> zeigt executed attacks." },
  { title: "Select a Block", body: "<strong>Tap a block</strong> to inspect. On your own blocks: <em>start farming, claim, set as attacker</em>. On foreign: <em>start attacks</em>." },
  { title: "Quantum Freeze", body: "Press <strong>PAUSE/EXPLODE</strong> (or Space) — rings explode outward. Perfect for precise tapping." },
  { title: "Start an Attack", body: "Click a <strong>foreign block</strong>. Choose <em>attacker</em> and <em>resource</em>. <strong>Profit Predictor</strong> shows expected steal. Track in <em>Attack History</em> (📜)." },
  { title: "Share & Deep-Link", body: "Every block updates the URL — e.g. <em>#block/1234</em>. Share it. Use <strong>Ctrl+K</strong> for command palette." }
];
let tutStep = 0;

function renderTutStep() {
  const step = TUTORIAL_STEPS[tutStep];
  document.getElementById('tutStep').textContent = `STEP ${tutStep+1} / ${TUTORIAL_STEPS.length}`;
  document.getElementById('tutTitle').textContent = step.title;
  document.getElementById('tutBody').innerHTML = step.body;
  document.getElementById('tutPrev').disabled = tutStep === 0;
  document.getElementById('tutNext').textContent = tutStep === TUTORIAL_STEPS.length - 1 ? 'Finish ✓' : 'Next →';
  document.getElementById('tutDots').innerHTML = TUTORIAL_STEPS.map((_, i) =>
    `<span class="${i === tutStep ? 'active' : ''}"></span>`).join('');
}
window.startTutorial = () => { tutStep = 0; renderTutStep(); document.getElementById('tutorial').classList.add('active'); };
window.nextTutStep = () => {
  if (tutStep < TUTORIAL_STEPS.length - 1) { tutStep++; renderTutStep(); playSound(520 + tutStep * 60, 0.06); }
  else window.closeTutorial();
};
window.prevTutStep = () => { if (tutStep > 0) { tutStep--; renderTutStep(); } };
window.closeTutorial = () => {
  document.getElementById('tutorial').classList.remove('active');
  localStorage.setItem('phircle_tutorial_done_v20', '1');
};