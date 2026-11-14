import { state, idToRC, isValidBlockId } from './phircle-state.js';

window.openSearch = () => {
  document.getElementById('searchModal').classList.add('active');
  setTimeout(() => document.getElementById('searchInput').focus(), 100);
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchInput').oninput = (e) => runSearch(e.target.value);
};
window.closeSearch = () => { document.getElementById('searchModal').classList.remove('active'); };

function runSearch(query) {
  const q = query.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  if (!q) { results.innerHTML = ''; return; }
  const items = [];
  const blockMatch = q.match(/^#?(\d+)$/);
  if (blockMatch) {
    const id = parseInt(blockMatch[1]);
    if (isValidBlockId(id)) {
      const rc = idToRC(id);
      items.push({ icon: '📦', text: `Block #${id} (Row ${rc.row}, Col ${rc.col})`,
        action: () => { window.closeSearch(); window.focusOnBlock(rc.row, rc.col); window.showBlockInfo({ row: rc.row, col: rc.col, id }); } });
    }
  }
  const actions = [
    { kw: ['pause','freeze'], icon: '⏸️', text: 'Toggle Pause', action: () => { window.closeSearch(); window.togglePause(); } },
    { kw: ['tutorial','help'], icon: '❓', text: 'Open Tutorial', action: () => { window.closeSearch(); window.startTutorial(); } },
    { kw: ['wallet','connect'], icon: '🔌', text: 'Connect Wallet', action: () => { window.closeSearch(); window.connectWallet(); } },
    { kw: ['farm'], icon: '🌾', text: 'Switch to FARMING', action: () => { window.closeSearch(); window.switchLayer('farming'); } },
    { kw: ['attack'], icon: '⚔️', text: 'Switch to ATTACK', action: () => { window.closeSearch(); window.switchLayer('attack'); } },
    { kw: ['mine','my farms'], icon: '💎', text: 'Show MY FARMS', action: () => { window.closeSearch(); window.switchLayer('my-farms'); } },
    { kw: ['war','critical'], icon: '🚨', text: 'WAR ROOM', action: () => { window.closeSearch(); window.switchLayer('war-room'); } },
    { kw: ['history','executed'], icon: '📜', text: 'Open Attack History', action: () => { window.closeSearch(); window.openAttackHistory(); } },
    { kw: ['sound'], icon: '🔊', text: 'Toggle Sound', action: () => { window.closeSearch(); window.toggleSound(); } },
    { kw: ['center','reset'], icon: '🎯', text: 'Reset View', action: () => { window.closeSearch(); state.view?.tZoom; window.resetView?.(); } },
  ];
  for (const a of actions) {
    if (a.kw.some(k => k.includes(q) || q.includes(k)) || a.text.toLowerCase().includes(q)) items.push(a);
  }
  if (!items.length) { results.innerHTML = `<div style="padding:20px;text-align:center;color:#666;">No results for "${query}"</div>`; return; }
  results.innerHTML = items.slice(0, 8).map((it, i) => `<div class="search-result" data-idx="${i}">${it.icon} ${it.text}</div>`).join('');
  results.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => items[parseInt(el.dataset.idx)].action());
  });
}