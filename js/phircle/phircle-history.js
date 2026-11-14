import {
  state, attacks, executedAttacks, blockHistory, minted, farms,
  farmStartTimes, farmLastClaimTimes, idToRC, formatDuration,
  getFarmRewardBreakdown, MAX_FARM_PAYOUT_DAYS, MAX_ATTACKS_PER_WALLET,
  getAttacksUsed, isFarmAttacked
} from './phircle-state.js';
import { resourceNames } from './phircle-config.js';
import { toast, playSound, haptic, copyToClipboard, escapeHtml } from './phircle-utils.js';
import { forceRefresh } from './phircle-data.js';

// ============================================================
// STATE (lokal für History-UI)
// ============================================================
let historyState = {
  filter: 'all',
  searchQuery: '',
  pageSize: 50,
  page: 0,
  sortDir: 'desc' // 'desc' = neueste oben
};

// ============================================================
// HELPER: Time-Ago Formatierung
// ============================================================
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 0) return 'in ' + formatDuration(-s * 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ============================================================
// HELPER: Ausgehende ready-Attacks
// ============================================================
function getMyReadyQueue() {
  if (!state.userAddress) return [];
  const queue = [];
  for (const [targetId, atk] of attacks) {
    const attackerBlock = minted.get(atk.attackerTokenId);
    if (attackerBlock?.owner === state.userAddress) {
      const rem = Math.max(0, atk.endTimestamp - Date.now());
      queue.push({
        targetId,
        attackerId: atk.attackerTokenId,
        attackIndex: atk.attackIndex,
        resource: atk.resource,
        rem,
        ready: rem <= 0,
        endTimestamp: atk.endTimestamp
      });
    }
  }
  // Sortiert: reifste zuerst
  queue.sort((a, b) => a.rem - b.rem);
  return queue;
}

// ============================================================
// HELPER: "Dein Tag in Zahlen" — Wallet-Statement (IDEE 2)
// ============================================================
function renderWalletStatement() {
  if (!state.userAddress) {
    return `
      <div style="padding:12px;text-align:center;color:#888;font-size:11px;border:1px dashed #333;border-radius:6px;margin-bottom:14px;">
        🔌 Connect your wallet to see your daily activity
      </div>
    `;
  }
  const dayStart = Math.floor(Date.now() / 86400000) * 86400000;
  const myAttacks = executedAttacks.filter(a => {
    const block = minted.get(a.attackerTokenId);
    return block?.owner === state.userAddress && a.startTime * 1000 >= dayStart;
  });
  const myExecuted = myAttacks.filter(a => a.executed);
  const myCancelled = myAttacks.filter(a => a.cancelled);

  // Farms, die ich heute gestartet habe (approximation)
  const myFarmsStarted = [...farms].filter(id => {
    const block = minted.get(id);
    const start = farmStartTimes.get(id);
    return block?.owner === state.userAddress && start && start >= dayStart;
  }).length;

  // Farms am Cap (meine)
  const myCappedFarms = [...farms].filter(id => {
    const block = minted.get(id);
    if (block?.owner !== state.userAddress) return false;
    const start = farmStartTimes.get(id);
    if (!start) return false;
    const lastClaim = farmLastClaimTimes.get(id);
    const base = lastClaim || start;
    const days = (Date.now() - base) / (24 * 60 * 60 * 1000);
    return days >= MAX_FARM_PAYOUT_DAYS;
  }).length;

  // Grobe Token-Schätzung
  let tokenGain = 0n;
  for (const a of myExecuted) {
    try {
      tokenGain += BigInt(a.stolenAmount || 0);
    } catch {}
  }
  const tokenGainStr = tokenGain > 0n ? `+${tokenGain.toString()}` : '0';

  const quotaUsed = getAttacksUsed(state.userAddress);
  const quotaLeft = Math.max(0, MAX_ATTACKS_PER_WALLET - quotaUsed);
  const quotaColor = quotaLeft === 0 ? '#ff3333' : quotaLeft === 1 ? '#ff8800' : '#00ff88';

  return `
    <div class="wallet-statement" style="
      background:linear-gradient(135deg, rgba(0,229,255,0.08), rgba(0,255,136,0.05));
      border:1px solid rgba(0,229,255,0.3); border-radius:8px;
      padding:12px 14px; margin-bottom:14px; font-size:11px;">
      <div style="color:#00e5ff;font-size:10px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">
        📊 DEIN TAG IN ZAHLEN
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;">
        <div><span style="color:#888;">⚔ Gestartet:</span> <strong style="color:#fff;">${myAttacks.length}</strong></div>
        <div><span style="color:#888;">✅ Executed:</span> <strong style="color:#00ff88;">${myExecuted.length}</strong></div>
        <div><span style="color:#888;">💰 Tokens:</span> <strong style="color:#ffcc00;">${tokenGainStr}</strong></div>
        <div><span style="color:#888;">🌾 Farms gestartet:</span> <strong style="color:#00e5ff;">${myFarmsStarted}</strong></div>
        <div><span style="color:#888;">⚠️ Am Cap:</span> <strong style="color:#ff8800;">${myCappedFarms}</strong></div>
        <div><span style="color:#888;">🎯 Quota:</span> <strong style="color:${quotaColor};">${quotaUsed}/${MAX_ATTACKS_PER_WALLET}</strong></div>
      </div>
    </div>
  `;
}

// ============================================================
// HELPER: Sammle alle History-Items
// ============================================================
function collectItems() {
  const items = [];
  const q = historyState.searchQuery.trim().toLowerCase();

  // 1. Aktive Attacks
  if (historyState.filter === 'all' || historyState.filter === 'active') {
    for (const [targetId, atk] of attacks) {
      const attackerBlock = minted.get(atk.attackerTokenId);
      const isMine = state.userAddress && attackerBlock?.owner === state.userAddress;
      if (historyState.filter === 'active' && !isMine && historyState.filter !== 'all') continue;

      const rem = Math.max(0, atk.endTimestamp - Date.now());
      items.push({
        status: rem <= 0 ? 'ready' : 'pending',
        title: `#${atk.attackerTokenId} → #${targetId}`,
        meta: `${resourceNames[atk.resource] || '?'} · ${rem <= 0 ? '✓ READY' : formatDuration(rem)}`,
        amount: '—',
        sortTime: atk.startTime,
        isMine,
        targetId,
        attackerId: atk.attackerTokenId,
        attackIndex: atk.attackIndex,
        ready: rem <= 0
      });
    }
  }

  // 2. Executed / Cancelled
  if (historyState.filter === 'all' || historyState.filter === 'executed' || historyState.filter === 'cancelled' || historyState.filter === 'my') {
    for (const a of executedAttacks) {
      let status = 'pending';
      if (a.executed) status = 'executed';
      else if (a.cancelled) status = 'cancelled';
      else if (a.endTimestamp < Date.now()) status = 'executed';

      if (historyState.filter === 'executed' && status !== 'executed') continue;
      if (historyState.filter === 'cancelled' && status !== 'cancelled') continue;

      const attackerBlock = minted.get(a.attackerTokenId);
      const targetBlock = minted.get(a.targetTokenId);
      const isMine = state.userAddress && (
        attackerBlock?.owner === state.userAddress ||
        targetBlock?.owner === state.userAddress
      );

      if (historyState.filter === 'my' && !isMine) continue;

      items.push({
        status,
        title: `#${a.attackerTokenId} → #${a.targetTokenId}`,
        meta: `${resourceNames[a.resource] || '?'} · ${new Date(a.startTime * 1000).toLocaleString()}`,
        amount: status === 'executed' ? `+${a.stolenAmount || '?'}` : '—',
        sortTime: a.startTime * 1000,
        isMine,
        targetId: a.targetTokenId,
        attackerId: a.attackerTokenId,
        ready: false
      });
    }
  }

  // 3. Search filter
  let filtered = items;
  if (q) {
    filtered = items.filter(it =>
      it.title.toLowerCase().includes(q) ||
      it.meta.toLowerCase().includes(q)
    );
  }

  // 4. Sortieren
  filtered.sort((a, b) =>
    historyState.sortDir === 'desc'
      ? b.sortTime - a.sortTime
      : a.sortTime - b.sortTime
  );

  return filtered;
}

// ============================================================
// MAIN: Render Attack History
// ============================================================
function renderAttackHistory() {
  const list = document.getElementById('attackHistoryList');
  if (!list) return;

  // Header (mit Wallet-Statement — IDEE 2)
  const allItems = collectItems();
  const total = allItems.length;
  const start = 0;
  const end = Math.min(total, (historyState.page + 1) * historyState.pageSize);
  const items = allItems.slice(start, end);
  const hasMore = end < total;

  // Count badges pro Tab
  const counts = {
    all: allItems.length,
    active: Array.from(attacks.keys()).length,
    executed: executedAttacks.filter(a => a.executed || a.endTimestamp < Date.now()).length,
    cancelled: executedAttacks.filter(a => a.cancelled).length,
    my: allItems.filter(it => it.isMine).length,
    queue: getMyReadyQueue().filter(q => q.ready).length
  };

  // Tab-Labels mit Count
  document.querySelectorAll('.history-tab').forEach(tab => {
    const key = tab.dataset.tab;
    if (key === 'queue') {
      const c = counts.queue;
      tab.textContent = `⚡ Queue${c > 0 ? ' (' + c + ')' : ''}`;
      if (c > 0) tab.style.color = '#00ff88';
      else tab.style.color = '';
    } else {
      const baseLabels = { all: 'All', active: 'Active', executed: 'Executed', cancelled: 'Cancelled', my: 'Mine' };
      const base = baseLabels[key] || key;
      tab.textContent = `${base}${counts[key] > 0 ? ' (' + counts[key] + ')' : ''}`;
    }
  });

  // Search-Bar + Sort
  const statementHtml = renderWalletStatement();
  const searchBarHtml = `
    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <input type="text" id="historySearch" placeholder="🔍 Filter..."
             value="${escapeHtml(historyState.searchQuery)}"
             style="flex:1;background:#0a0a0a;border:1px solid #333;color:#e0e0e0;padding:8px 12px;font-family:inherit;font-size:11px;border-radius:4px;outline:none;">
      <button onclick="window.__historyToggleSort()" style="background:#1a1a1a;border:1px solid #333;color:#888;padding:8px 12px;cursor:pointer;border-radius:4px;font-family:inherit;font-size:11px;">
        ${historyState.sortDir === 'desc' ? '↓ Newest' : '↑ Oldest'}
      </button>
    </div>
  `;

  // Queue-Tab (IDEE 3)
  if (historyState.filter === 'queue') {
    renderQueueView(list, statementHtml);
    return;
  }

  // Empty state
  if (!items.length) {
    list.innerHTML = statementHtml + searchBarHtml + `
      <div style="padding:40px 20px;text-align:center;color:#666;">
        <div style="font-size:32px;margin-bottom:12px;">📭</div>
        <div style="font-size:12px;margin-bottom:8px;">No ${historyState.filter === 'all' ? '' : historyState.filter + ' '}attacks yet.</div>
        <div style="font-size:10px;color:#444;">Click a foreign block to start your first attack!</div>
      </div>
    `;
    bindHistorySearch();
    return;
  }

  // Render items
  const itemsHtml = items.map(it => {
    const statusClass = it.status === 'executed' ? 'executed'
                      : it.status === 'cancelled' ? 'cancelled'
                      : it.status === 'ready' ? 'executed'
                      : 'pending';
    const executeBtn = it.ready && it.isMine
      ? `<button onclick="window.executeAttack(${it.targetId},${it.attackIndex})"
              style="background:linear-gradient(135deg,#00ff88,#00aa55);color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:10px;font-weight:bold;margin-left:8px;">
           ⚔ Execute
         </button>`
      : '';
    const copyBtn = `<button onclick="window.__copyHistoryEntry('${it.title}')" title="Copy"
                              style="background:none;border:none;color:#555;cursor:pointer;padding:2px 4px;font-size:12px;">📋</button>`;
    return `
      <div class="history-item ${statusClass}" style="cursor:pointer;" onclick="window.__jumpToAttack(${it.targetId})">
        <div class="hi-left">
          <div class="hi-title">${escapeHtml(it.title)} ${copyBtn}</div>
          <div class="hi-meta">${escapeHtml(it.meta)}</div>
        </div>
        <div style="display:flex;align-items:center;">
          <div class="hi-amount">${it.amount}</div>
          ${executeBtn}
        </div>
      </div>
    `;
  }).join('');

  const loadMoreHtml = hasMore
    ? `<button onclick="window.__historyLoadMore()"
               style="width:100%;margin-top:12px;background:#1a1a1a;border:1px solid #333;color:#888;padding:10px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;">
         ↓ Load More (${total - end} remaining)
       </button>`
    : `<div style="text-align:center;padding:12px;color:#444;font-size:10px;">— End of history —</div>`;

  list.innerHTML = statementHtml + searchBarHtml + itemsHtml + loadMoreHtml;
  bindHistorySearch();
}

// ============================================================
// QUEUE VIEW (IDEE 3)
// ============================================================
function renderQueueView(list, statementHtml) {
  const queue = getMyReadyQueue();
  const ready = queue.filter(q => q.ready);
  const pending = queue.filter(q => !q.ready);

  if (!queue.length) {
    list.innerHTML = statementHtml + `
      <div style="padding:40px 20px;text-align:center;color:#666;">
        <div style="font-size:32px;margin-bottom:12px;">⚡</div>
        <div style="font-size:12px;margin-bottom:8px;">Your attack queue is empty.</div>
        <div style="font-size:10px;color:#444;">Start an attack on a foreign block to fill it.</div>
      </div>
    `;
    return;
  }

  const bulkBtn = ready.length > 0
    ? `<button onclick="window.__executeAllReady()"
                style="width:100%;margin-bottom:14px;background:linear-gradient(135deg,#00ff88,#00aa55);color:#000;border:none;padding:14px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:bold;letter-spacing:1px;box-shadow:0 4px 15px rgba(0,255,136,0.3);">
         ⚡ Execute All Ready (${ready.length})
       </button>`
    : '';

  const readyHtml = ready.map(q => `
    <div class="history-item executed" style="margin:8px 0;">
      <div class="hi-left">
        <div class="hi-title">#${q.attackerId} → #${q.targetId}</div>
        <div class="hi-meta">${resourceNames[q.resource] || '?'} · ✓ READY</div>
      </div>
      <button onclick="window.executeAttack(${q.targetId},${q.attackIndex})"
              style="background:#00ff88;color:#000;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:bold;">
        ⚔ Execute
      </button>
    </div>
  `).join('');

  const pendingHtml = pending.map(q => `
    <div class="history-item pending" style="margin:8px 0;opacity:0.7;">
      <div class="hi-left">
        <div class="hi-title">#${q.attackerId} → #${q.targetId}</div>
        <div class="hi-meta">${resourceNames[q.resource] || '?'} · ${formatDuration(q.rem)} remaining</div>
      </div>
      <div style="font-size:12px;color:#ffaa00;">⏳</div>
    </div>
  `).join('');

  list.innerHTML = statementHtml + bulkBtn
    + (ready.length ? `<div style="color:#00ff88;font-size:10px;letter-spacing:1px;margin:8px 0;">READY TO EXECUTE (${ready.length})</div>${readyHtml}` : '')
    + (pending.length ? `<div style="color:#888;font-size:10px;letter-spacing:1px;margin:14px 0 8px;">PENDING (${pending.length})</div>${pendingHtml}` : '');
}

// ============================================================
// EXECUTE ALL READY (IDEE 3)
// ============================================================
window.__executeAllReady = async () => {
  const queue = getMyReadyQueue().filter(q => q.ready);
  if (!queue.length) return toast('No ready attacks to execute', 'info');

  const confirmed = confirm(`Execute ${queue.length} attack(s) now?\n\nThis will require ${queue.length} separate transactions.`);
  if (!confirmed) return;

  let success = 0, failed = 0;
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    toast(`⚔ [${i + 1}/${queue.length}] Executing #${q.attackerId} → #${q.targetId}...`, 'info', 2500);
    try {
      await window.executeAttack(q.targetId, q.attackIndex);
      success++;
      await new Promise(r => setTimeout(r, 800)); // Block-Reorg-Puffer
    } catch (e) {
      failed++;
    }
  }
  toast(`✅ Done: ${success} success · ${failed} failed`, success > 0 ? 'success' : 'error', 5000);
  forceRefresh(state.userAddress);
  setTimeout(renderAttackHistory, 2000);
};

// ============================================================
// SEARCH-BAR BINDING
// ============================================================
let searchDebounce = null;
function bindHistorySearch() {
  const input = document.getElementById('historySearch');
  if (!input) return;
  input.oninput = (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      historyState.searchQuery = e.target.value;
      historyState.page = 0;
      renderAttackHistory();
      // Fokus wiederherstellen
      const newInput = document.getElementById('historySearch');
      if (newInput) { newInput.focus(); newInput.setSelectionRange(newInput.value.length, newInput.value.length); }
    }, 250);
  };
}

// ============================================================
// PUBLIC API
// ============================================================
window.openAttackHistory = () => {
  document.getElementById('attackHistoryModal').classList.add('active');
  historyState.page = 0;
  renderAttackHistory();
};
window.closeAttackHistory = () => {
  document.getElementById('attackHistoryModal').classList.remove('active');
};
window.filterAttackHistory = (tab) => {
  historyState.filter = tab;
  historyState.page = 0;
  document.querySelectorAll('.history-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderAttackHistory();
  playSound(480, 0.05);
};
window.__historyLoadMore = () => {
  historyState.page++;
  renderAttackHistory();
};
window.__historyToggleSort = () => {
  historyState.sortDir = historyState.sortDir === 'desc' ? 'asc' : 'desc';
  historyState.page = 0;
  renderAttackHistory();
};
window.__copyHistoryEntry = async (text) => {
  const ok = await copyToClipboard(text);
  if (ok) { toast('Copied ✓', 'success', 1500); haptic([5]); }
};
window.__jumpToAttack = (blockId) => {
  const rc = idToRC(blockId);
  if (rc) {
    window.closeAttackHistory();
    window.focusOnBlock(rc.row, rc.col);
    window.showBlockInfo?.({ row: rc.row, col: rc.col, id: blockId });
  }
};

// ============================================================
// EXPORT (CSV + JSON)
// ============================================================
window.exportHistory = (format = 'json') => {
  const items = collectItems();
  if (format === 'csv') {
    // CSV-Export (Excel-kompatibel, UTF-8 BOM)
    const rows = [['Status', 'Attacker', 'Target', 'Resource', 'Amount', 'Time']];
    for (const it of items) {
      rows.push([
        it.status,
        it.attackerId,
        it.targetId,
        it.meta.split('·')[0].trim(),
        it.amount,
        new Date(it.sortTime).toISOString()
      ]);
    }
    const csv = '\uFEFF' + rows.map(r =>
      r.map(cell => {
        const s = String(cell ?? '');
        return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\n');
    downloadFile(`phircle-history-${Date.now()}.csv`, csv, 'text/csv');
  } else {
    const data = {
      exportedAt: new Date().toISOString(),
      wallet: state.userAddress,
      total: items.length,
      items,
      activeAttacks: Array.from(attacks.values()),
      executedAttacks
    };
    downloadFile(
      `phircle-history-${Date.now()}.json`,
      JSON.stringify(data, null, 2),
      'application/json'
    );
  }
  toast(`History exported as ${format.toUpperCase()} ✓`, 'success');
};

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ============================================================
// BLOCK-HISTORY (unten rechts — bleibt erhalten)
// ============================================================
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
  if (rc) {
    window.focusOnBlock(rc.row, rc.col);
    window.showBlockInfo?.({ row: rc.row, col: rc.col, id });
  }
};

// ============================================================
// SHARE
// ============================================================
window.shareBlock = async (id) => {
  const url = `${location.origin}${location.pathname}#block/${id}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `Phircle Block #${id}`, url });
    } else {
      const ok = await copyToClipboard(url);
      if (ok) toast('Link copied ✓', 'success');
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Could not share', 'error');
  }
};

// ============================================================
// AUTO-REFRESH (alle 15s neu rendern, wenn Modal offen)
// ============================================================
setInterval(() => {
  const modal = document.getElementById('attackHistoryModal');
  if (modal?.classList.contains('active')) {
    renderAttackHistory();
  }
}, 15000);