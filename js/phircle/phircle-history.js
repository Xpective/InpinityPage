import { state, attacks, executedAttacks, blockHistory, minted, farms, idToRC, formatDuration } from './phircle-state.js';
import { resourceNames } from './phircle-config.js';

window.openAttackHistory = () => {
  document.getElementById('attackHistoryModal').classList.add('active');
  renderAttackHistory();
};
window.closeAttackHistory = () => { document.getElementById('attackHistoryModal').classList.remove('active'); };
window.filterAttackHistory = (tab) => {
  state.historyFilter = tab;
  document.querySelectorAll('.history-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderAttackHistory();
};

function renderAttackHistory() {
  const list = document.getElementById('attackHistoryList');
  let items = [];
  if (state.historyFilter === 'all' || state.historyFilter === 'active') {
    for (const [targetId, atk] of attacks) {
      items.push({
        status: 'pending',
        title: `#${atk.attackerTokenId} → #${targetId}`,
        meta: `${resourceNames[atk.resource]} · Ready in ${formatDuration(Math.max(0, atk.endTimestamp - Date.now()))}`,
        amount: '—'
      });
    }
  }
  if (state.historyFilter === 'all' || state.historyFilter === 'executed' || state.historyFilter === 'cancelled') {
    for (const a of executedAttacks) {
      let status = 'pending';
      if (a.executed) status = 'executed';
      else if (a.cancelled) status = 'cancelled';
      else if (a.endTimestamp < Date.now()) status = 'executed';
      if (state.historyFilter === 'executed' && status !== 'executed') continue;
      if (state.historyFilter === 'cancelled' && status !== 'cancelled') continue;
      items.push({
        status,
        title: `#${a.attackerTokenId} → #${a.targetTokenId}`,
        meta: `${resourceNames[a.resource]} · ${new Date(a.startTime * 1000).toLocaleString()}`,
        amount: status === 'executed' ? `+${a.stolenAmount || '?'}` : '—'
      });
    }
  }
  if (!items.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:#666;">No ${state.historyFilter === 'all' ? '' : state.historyFilter} attacks found.</div>`;
    return;
  }
  list.innerHTML = items.map(it => `
    <div class="history-item ${it.status}">
      <div class="hi-left"><div class="hi-title">${it.title}</div><div class="hi-meta">${it.meta}</div></div>
      <div class="hi-amount">${it.amount}</div>
    </div>
  `).join('');
}

export function addToHistory(id) {
  const existing = blockHistory.indexOf(id);
  if (existing >= 0) blockHistory.splice(existing, 1);
  blockHistory.unshift(id);
  if (blockHistory.length > 5) blockHistory.pop();
  renderBlockHistory();
}
export function renderBlockHistory() {
  const el = document.getElementById('blockHistory');
  if (!el) return;
  el.innerHTML = blockHistory.map(id => {
    const m = minted.get(id);
    const icon = m ? (farms.has(id) ? '🌾' : '📦') : '⭕';
    return `<div class="history-chip" onclick="window.jumpToBlock(${id})">${icon} #${id}</div>`;
  }).join('');
}
window.jumpToBlock = (id) => {
  const rc = idToRC(id);
  if (rc) { window.focusOnBlock(rc.row, rc.col); window.showBlockInfo({ row: rc.row, col: rc.col, id }); }
};
window.shareBlock = async (id) => {
  const url = `${location.origin}${location.pathname}#block/${id}`;
  try {
    if (navigator.share) await navigator.share({ title: `Phircle Block #${id}`, url });
    else { await navigator.clipboard.writeText(url); window.toast?.('Link copied ✓', 'success'); }
  } catch(e) { window.toast?.('Could not share: ' + e.message, 'error'); }
};
window.exportHistory = () => {
  const data = {
    exportedAt: new Date().toISOString(),
    activeAttacks: Array.from(attacks.values()),
    executedAttacks: executedAttacks
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `phircle-history-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  window.toast?.('History exported ✓', 'success');
};