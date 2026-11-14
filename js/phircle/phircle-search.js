import {
  state, idToRC, isValidBlockId, minted, farms, attacks, executedAttacks,
  canStartAttack, getAttacksUsed, MAX_ATTACKS_PER_WALLET,
  MAX_FARM_PAYOUT_DAYS, farmStartTimes, farmLastClaimTimes
} from './phircle-state.js';
import { playSound, haptic, copyToClipboard, toast } from './phircle-utils.js';

// ============================================================
// LERN-RANKING (IDEE 1)
// ============================================================
const USAGE_KEY = 'phircle_search_usage_v1';
let usageWeights = {};
try {
  usageWeights = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
} catch { usageWeights = {}; }

function getUsageScore(id) {
  return usageWeights[id] || 0;
}
function bumpUsage(id) {
  usageWeights[id] = getUsageScore(id) + 1;
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(usageWeights)); } catch {}
}

// ============================================================
// FUZZY MATCH (IDEE 1)
// ============================================================
function fuzzyScore(query, target) {
  if (!query) return 0;
  query = query.toLowerCase();
  target = target.toLowerCase();

  // Exakter Substring → höchster Score
  if (target.includes(query)) {
    const idx = target.indexOf(query);
    return 1000 - idx * 5;
  }

  // Subsequenz-Match mit Gap-Penalty
  let qi = 0, score = 0, lastMatchIdx = -1;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      score += 10;
      if (lastMatchIdx === ti - 1) score += 5; // consecutive bonus
      if (ti === 0 || target[ti - 1] === ' ' || target[ti - 1] === '#') score += 3; // word-start bonus
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi < query.length) return -1; // nicht alle Zeichen gematcht
  return score;
}

// ============================================================
// SUCHE AUSFÜHREN (mit Gruppen + Lern-Ranking)
// ============================================================
function runSearch(query) {
  const q = query.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  if (!results) return;

  if (!q) {
    results.innerHTML = renderRecentAndSuggestions();
    return;
  }

  const groups = { blocks: [], actions: [], info: [] };

  // Prefix-Handling
  let actionQuery = q;
  let blockQuery = q;

  // 1. Block-Suche (#123 oder 123)
  const blockMatch = q.match(/^#?(\d+)$/);
  if (blockMatch) {
    const id = parseInt(blockMatch[1]);
    if (isValidBlockId(id)) {
      const rc = idToRC(id);
      const m = minted.get(id);
      const status = m ? (farms.has(id) ? '🌾 Farming' : m.revealed ? '📦 Minted' : '🔒 Unrevealed') : '⭕ Unminted';
      groups.blocks.push({
        icon: '📦',
        text: `Block #${id} · Row ${rc.row}, Col ${rc.col} · ${status}`,
        score: 2000,
        action: () => { closeSearch(); window.focusOnBlock(rc.row, rc.col); window.showBlockInfo?.({ row: rc.row, col: rc.col, id }); },
        usageKey: `block:${id}`
      });
    }
  }

  // 2. Aktionen
  const actions = getAllActions();
  for (const a of actions) {
    // Fuzzy-Match auf Keywords + Text
    let bestScore = -1;
    for (const kw of a.kw) {
      const s = fuzzyScore(q, kw);
      if (s > bestScore) bestScore = s;
    }
    const textScore = fuzzyScore(q, a.text);
    if (textScore > bestScore) bestScore = textScore;

    if (bestScore > 0) {
      // Lern-Ranking: +50 pro Klick
      const usage = getUsageScore(a.usageKey);
      groups.actions.push({ ...a, score: bestScore + usage * 50 });
    }
  }

  // 3. Info-Results (Blöcke im Layer)
  if (q.length >= 2 && !blockMatch) {
    // Suche in Minted nach Rarity-Owner etc.
    const matches = [];
    for (const [id, m] of minted) {
      if (matches.length >= 5) break;
      const rc = idToRC(id);
      if (!rc) continue;
      const rarity = m.rarity != null ? ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][m.rarity] : '';
      const ownerStr = m.owner || '';
      if (rarity.toLowerCase().includes(q) || ownerStr.includes(q)) {
        matches.push({
          icon: '🔍',
          text: `Block #${id} · ${rarity || 'Unrevealed'} · ${ownerStr.slice(0, 8)}...`,
          score: 500,
          action: () => { closeSearch(); window.focusOnBlock(rc.row, rc.col); window.showBlockInfo?.({ row: rc.row, col: rc.col, id }); },
          usageKey: `block:${id}`
        });
      }
    }
    groups.blocks.push(...matches);
  }

  // Sortieren nach Score
  groups.blocks.sort((a, b) => b.score - a.score);
  groups.actions.sort((a, b) => b.score - a.score);

  // Rendern
  let html = '';
  let flatList = [];

  if (groups.blocks.length) {
    html += `<div style="font-size:9px;color:#666;letter-spacing:2px;padding:6px 4px;text-transform:uppercase;">Blocks</div>`;
    for (const r of groups.blocks.slice(0, 5)) {
      const idx = flatList.length;
      html += renderResult(r, idx);
      flatList.push(r);
    }
  }
  if (groups.actions.length) {
    html += `<div style="font-size:9px;color:#666;letter-spacing:2px;padding:6px 4px;margin-top:6px;text-transform:uppercase;">Actions</div>`;
    for (const r of groups.actions.slice(0, 8)) {
      const idx = flatList.length;
      html += renderResult(r, idx);
      flatList.push(r);
    }
  }

  if (!flatList.length) {
    // "Did you mean?"
    const suggestion = suggestClosest(q);
    html = `
      <div style="padding:30px 20px;text-align:center;color:#666;">
        <div style="font-size:24px;margin-bottom:8px;">🤔</div>
        <div style="font-size:12px;">No results for "<strong>${escapeHtml(query)}</strong>"</div>
        ${suggestion ? `<div style="font-size:11px;margin-top:10px;color:#00e5ff;cursor:pointer;" onclick="document.getElementById('searchInput').value='${escapeHtml(suggestion)}';window.__runSearch('${escapeHtml(suggestion)}');">Did you mean: <strong>${escapeHtml(suggestion)}</strong>?</div>` : ''}
        <div style="font-size:10px;margin-top:14px;color:#444;">Try: "#1234" · "attack" · "queue" · "pause"</div>
      </div>
    `;
  }

  results.innerHTML = html;

  // Click-Handler + Lern-Ranking
  results.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const item = flatList[idx];
      if (item) {
        bumpUsage(item.usageKey);
        item.action();
      }
    });
  });

  // Store flatList für Enter-Navigation
  window.__searchFlatList = flatList;
}

// ============================================================
// RESULT HTML
// ============================================================
function renderResult(item, idx) {
  return `<div class="search-result" data-idx="${idx}">${item.icon} ${escapeHtml(item.text)}</div>`;
}

// ============================================================
// AKTIONEN
// ============================================================
function getAllActions() {
  return [
    { kw: ['pause', 'freeze', 'quantum', 'space'], icon: '⏸️', text: 'Toggle Pause / Explode',
      action: () => { closeSearch(); window.togglePause(); }, usageKey: 'act:pause' },

    { kw: ['tutorial', 'help', 'how'], icon: '❓', text: 'Open Tutorial',
      action: () => { closeSearch(); window.startTutorial?.(); }, usageKey: 'act:tutorial' },

    { kw: ['wallet', 'connect', 'metamask'], icon: '🔌', text: 'Connect Wallet',
      action: () => { closeSearch(); window.connectWallet?.(); }, usageKey: 'act:wallet' },

    { kw: ['farm', 'farming'], icon: '🌾', text: 'Switch to FARMING Layer',
      action: () => { closeSearch(); window.switchLayer('farming'); }, usageKey: 'act:farming' },

    { kw: ['attack', 'attacks'], icon: '⚔️', text: 'Switch to ATTACK Layer',
      action: () => { closeSearch(); window.switchLayer('attack'); }, usageKey: 'act:attack' },

    { kw: ['mine', 'my farms', 'my'], icon: '💎', text: 'Show MY FARMS',
      action: () => { closeSearch(); window.switchLayer('my-farms'); }, usageKey: 'act:myfarms' },

    { kw: ['war', 'war room', 'critical'], icon: '🚨', text: 'WAR ROOM',
      action: () => { closeSearch(); window.switchLayer('war-room'); }, usageKey: 'act:warroom' },

    { kw: ['history', 'executed', 'log'], icon: '📜', text: 'Open Attack History',
      action: () => { closeSearch(); window.openAttackHistory?.(); }, usageKey: 'act:history' },

    { kw: ['queue', 'ready', 'execute'], icon: '⚡', text: 'My Attack Queue (Ready to Execute)',
      action: () => { closeSearch(); window.openAttackHistory?.(); window.filterAttackHistory?.('queue'); }, usageKey: 'act:queue' },

    { kw: ['sound', 'audio', 'mute'], icon: '🔊', text: 'Toggle Sound',
      action: () => { closeSearch(); window.toggleSound(); }, usageKey: 'act:sound' },

    { kw: ['center', 'reset', 'home', 'zoom out'], icon: '🎯', text: 'Reset View',
      action: () => { closeSearch(); window.resetView?.(); }, usageKey: 'act:reset' },

    { kw: ['capped farms', 'cap', '7 days', 'max'], icon: '⚠️', text: 'Show Farms at 7-Day Cap',
      action: () => {
        closeSearch();
        window.switchLayer('farming');
        // Filter setzen: nur Farming
        toast('Showing capped farms (orange rings)', 'info');
      }, usageKey: 'act:capped' },

    { kw: ['quota', 'limit', 'remaining attacks', 'how many attacks'], icon: '🎯', text: 'Show My Attack Quota',
      action: () => {
        closeSearch();
        if (!state.userAddress) return toast('Connect wallet first', 'error');
        const used = getAttacksUsed(state.userAddress);
        toast(`🎯 Attacks today: ${used}/${MAX_ATTACKS_PER_WALLET}`, used >= MAX_ATTACKS_PER_WALLET ? 'error' : 'info', 4000);
      }, usageKey: 'act:quota' },

    { kw: ['refresh', 'reload', 'sync', 'update'], icon: '🔄', text: 'Refresh Data',
      action: () => { closeSearch(); import('./phircle-data.js').then(m => m.forceRefresh(state.userAddress)); }, usageKey: 'act:refresh' },

    { kw: ['export', 'csv', 'json', 'download'], icon: '⬇️', text: 'Export History',
      action: () => { closeSearch(); window.exportHistory?.('csv'); }, usageKey: 'act:export' },

    { kw: ['debug', 'fps', 'performance'], icon: '🔧', text: 'Toggle Debug Mode',
      action: () => {
        closeSearch();
        const url = new URL(location.href);
        if (url.searchParams.has('debug')) url.searchParams.delete('debug');
        else url.searchParams.set('debug', '1');
        location.href = url.toString();
      }, usageKey: 'act:debug' },

    { kw: ['scan', 'address', '0x'], icon: '👤', text: 'Jump to Wallet (paste address)',
      action: () => { closeSearch(); toast('Paste a 0x address in the sidebar', 'info'); }, usageKey: 'act:wallet_jump' }
  ];
}

// ============================================================
// "Did you mean?" (einfache Levenshtein)
// ============================================================
function suggestClosest(query) {
  const actions = getAllActions();
  const keywords = actions.flatMap(a => a.kw);
  let best = null, bestScore = Infinity;
  for (const kw of keywords) {
    const d = levenshtein(query, kw);
    if (d < bestScore && d <= 2) {
      bestScore = d;
      best = kw;
    }
  }
  return best;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ============================================================
// RECENT & SUGGESTIONS
// ============================================================
function renderRecentAndSuggestions() {
  // Top-5 meistgenutzte Aktionen
  const allActions = getAllActions();
  const sortedByUsage = allActions
    .map(a => ({ ...a, usage: getUsageScore(a.usageKey) }))
    .filter(a => a.usage > 0)
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 5);

  const recentHtml = sortedByUsage.length
    ? `
      <div style="font-size:9px;color:#666;letter-spacing:2px;padding:6px 4px;text-transform:uppercase;">Your Favorites</div>
      ${sortedByUsage.map((a, idx) => renderResult(a, idx)).join('')}
    `
    : '';

  const suggestionsHtml = `
    <div style="font-size:9px;color:#666;letter-spacing:2px;padding:6px 4px;margin-top:6px;text-transform:uppercase;">Suggested</div>
    <div class="search-result" data-idx="0" onclick="window.__quickAction('queue')">⚡ My Attack Queue</div>
    <div class="search-result" data-idx="1" onclick="window.__quickAction('capped')">⚠️ Farms at 7-Day Cap</div>
    <div class="search-result" data-idx="2" onclick="window.__quickAction('history')">📜 Recent History</div>
  `;

  // Click-Handler für Favorites
  setTimeout(() => {
    const results = document.getElementById('searchResults');
    if (!results) return;
    const favItems = results.querySelectorAll('.search-result');
    favItems.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        if (sortedByUsage[idx]) {
          bumpUsage(sortedByUsage[idx].usageKey);
          sortedByUsage[idx].action();
        }
      });
    });
  }, 0);

  return recentHtml + suggestionsHtml;
}

window.__quickAction = (type) => {
  closeSearch();
  if (type === 'queue') { window.openAttackHistory?.(); window.filterAttackHistory?.('queue'); }
  else if (type === 'capped') { window.switchLayer?.('farming'); toast('Showing capped farms (orange)', 'info'); }
  else if (type === 'history') { window.openAttackHistory?.(); }
};

// ============================================================
// KEYBOARD NAVIGATION (↑↓ Enter)
// ============================================================
let selectedIdx = -1;
function navigate(direction) {
  const list = window.__searchFlatList || [];
  if (!list.length) return;
  selectedIdx = Math.max(0, Math.min(list.length - 1, selectedIdx + direction));
  const results = document.getElementById('searchResults');
  if (!results) return;
  results.querySelectorAll('.search-result').forEach((el, i) => {
    el.style.background = i === selectedIdx ? 'rgba(255,204,0,0.15)' : '';
    el.style.color = i === selectedIdx ? '#ffcc00' : '';
    if (i === selectedIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function executeSelected() {
  const list = window.__searchFlatList || [];
  if (selectedIdx >= 0 && list[selectedIdx]) {
    bumpUsage(list[selectedIdx].usageKey);
    list[selectedIdx].action();
  }
}

// ============================================================
// PUBLIC API
// ============================================================
window.openSearch = () => {
  document.getElementById('searchModal').classList.add('active');
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
    input.oninput = (e) => {
      selectedIdx = -1;
      window.__runSearch(e.target.value);
    };
  }
  runSearch('');
};
window.closeSearch = () => {
  document.getElementById('searchModal').classList.remove('active');
  selectedIdx = -1;
};

window.__runSearch = runSearch;

// Global keydown für Navigation
window.addEventListener('keydown', (e) => {
  const modal = document.getElementById('searchModal');
  if (!modal?.classList.contains('active')) return;

  if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); executeSelected(); }
  else if (e.key === 'Escape') {
    const input = document.getElementById('searchInput');
    if (input && input.value) {
      input.value = '';
      runSearch('');
      e.stopPropagation();
    } else {
      closeSearch();
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    // Cmd/Ctrl+Enter = kopiere Block-Link (falls Block-Result)
    e.preventDefault();
    const list = window.__searchFlatList || [];
    if (list[selectedIdx]?.usageKey?.startsWith('block:')) {
      const id = list[selectedIdx].usageKey.split(':')[1];
      copyToClipboard(`${location.origin}${location.pathname}#block/${id}`).then(ok => {
        if (ok) toast('Block link copied ✓', 'success');
      });
    }
  }
});

// Escape-Helper
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}