import { WORKER_URL } from './phircle-config.js';
import { state, minted, farms, farmStartTimes, attacks, executedAttacks, partnerships, idToRC, updateMyBlockCounts } from './phircle-state.js';

async function fetchGraphQL(query, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${WORKER_URL}/api/subgraph`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ query })
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        if (i === retries - 1) return null;
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return json.data;
    } catch (e) {
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

export function updateApiStatus(status) {
  state.apiStatus = status;
  const el = document.getElementById('statusText');
  if (!el) return;
  if (status === 'live') el.innerHTML = `<span class="live">● LIVE</span> · ${minted.size} Tokens · ${farms.size} Farms`;
  else if (status === 'error') el.innerHTML = '<span class="demo">● Subgraph offline</span>';
  else el.innerHTML = '<span class="live">● Loading Data...</span>';
}

export async function loadLive() {
  updateApiStatus('loading');
  try {
    const dataTokens = await fetchGraphQL(`{ tokens(first: 1000) { id revealed owner { id } } }`);
    if (dataTokens?.tokens) {
      for (const t of dataTokens.tokens) {
        const id = parseInt(t.id);
        minted.set(id, { revealed: t.revealed === true, owner: t.owner?.id ? t.owner.id.toLowerCase() : null, rarity: null });
      }
    }
    const dataRevealed = await fetchGraphQL(`{ blockRevealeds(first: 1000) { tokenId rarity } }`);
    if (dataRevealed?.blockRevealeds) {
      for (const br of dataRevealed.blockRevealeds) {
        const m = minted.get(parseInt(br.tokenId));
        if (m) m.rarity = parseInt(br.rarity);
      }
    }
    // Farm query with startTime, fallback without
    let dataFarms = await fetchGraphQL(`{ farmV6S(first: 1000) { id active startTime } }`);
    if (!dataFarms) dataFarms = await fetchGraphQL(`{ farmV6S(first: 1000) { id active } }`);
    if (dataFarms?.farmV6S) {
      farms.clear(); farmStartTimes.clear();
      for (const f of dataFarms.farmV6S) {
        const id = parseInt(f.id);
        if (f.active) {
          farms.add(id);
          if (f.startTime) farmStartTimes.set(id, Number(f.startTime) * 1000);
        }
      }
    }
    const dataAttacks = await fetchGraphQL(`{ attackV6S(first: 1000) { attackerTokenId targetTokenId attackIndex resource startTime endTime executed cancelled stolenAmount } }`);
    attacks.clear(); executedAttacks.length = 0;
    if (dataAttacks?.attackV6S) {
      for (const a of dataAttacks.attackV6S) {
        const end = Number(a.endTime) * 1000;
        const isExecuted = a.executed === true, isCancelled = a.cancelled === true, isExpired = end < Date.now();
        const rc = idToRC(parseInt(a.attackerTokenId)); if (!rc) continue;
        const attackObj = {
          attackerTokenId: parseInt(a.attackerTokenId), attackerRow: rc.row, attackerCol: rc.col,
          targetTokenId: parseInt(a.targetTokenId), attackIndex: parseInt(a.attackIndex),
          resource: parseInt(a.resource), startTime: parseInt(a.startTime), endTime: parseInt(a.endTime),
          endTimestamp: end, executed: isExecuted, cancelled: isCancelled, stolenAmount: a.stolenAmount || '0'
        };
        if (isExecuted || isCancelled || isExpired) executedAttacks.push(attackObj);
        else attacks.set(attackObj.targetTokenId, { ...attackObj, startTime: performance.now(), interval: Math.max(2, attackObj.endTime - attackObj.startTime) });
      }
    }
    const dataPartners = await fetchGraphQL(`{ partnerships(first: 1000, where: {active: true}) { id } }`);
    if (dataPartners?.partnerships) {
      partnerships.clear();
      for (const p of dataPartners.partnerships) partnerships.add(parseInt(p.id));
    }
    updateApiStatus('live');
    updateMyBlockCounts();
  } catch (e) {
    console.warn('Subgraph failed', e);
    updateApiStatus('error');
  }
  const ov = document.getElementById('loadingOverlay');
  if (ov && !ov.classList.contains('hidden')) {
    ov.classList.add('hidden'); setTimeout(() => ov.style.display = 'none', 500);
  }
}