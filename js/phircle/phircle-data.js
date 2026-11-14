import { WORKER_URL } from './phircle-config.js';
import {
  state, minted, farms, farmStartTimes, farmLastClaimTimes,
  attacks, executedAttacks, partnerships, attackedTokenIds, farmAttackedBy,
  idToRC, updateMyBlockCounts, markFarmClaimed, markFarmAttacked,
  resetAttacksUsed, incrementAttacksUsed
} from './phircle-state.js';

const CACHE_TTL_MS = 15000;
let lastFetchTime = 0;
let lastFetchOk = false;
let abortCtrl = null;

async function fetchGraphQL(query, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${WORKER_URL}/api/subgraph`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ query }),
        signal: abortCtrl?.signal
      });
      const json = await res.json();
      if (!res.ok || json.errors) {
        if (i === retries - 1) return null;
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return json.data;
    } catch (e) {
      if (e.name === 'AbortError') return null;
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

export function updateApiStatus(status, extra = '') {
  state.apiStatus = status;
  const el = document.getElementById('statusText');
  if (!el) return;
  if (status === 'live') {
    el.innerHTML = `<span class="live">● LIVE</span> · ${minted.size} Tokens · ${farms.size} Farms${extra ? ' · ' + extra : ''}`;
  } else if (status === 'error') {
    el.innerHTML = `<span class="demo">● Subgraph offline${extra ? ' · ' + extra : ''}</span>`;
  } else {
    el.innerHTML = `<span class="live">● Loading Data...</span>`;
  }
}

// 🆕 Helper: Farm aus Subgraph parsen
function parseFarm(f) {
  const id = parseInt(f.id);
  const startMs = f.startTime ? Number(f.startTime) * 1000 : null;
  const lastClaimMs = f.lastClaim ? Number(f.lastClaim) * 1000 : null;
  return { id, active: f.active === true, startMs, lastClaimMs };
}

// 🆕 Helper: Attack aus Subgraph parsen
function parseAttack(a) {
  const end = Number(a.endTime) * 1000;
  const rc = idToRC(parseInt(a.attackerTokenId));
  if (!rc) return null;
  return {
    attackerTokenId: parseInt(a.attackerTokenId),
    attackerRow: rc.row, attackerCol: rc.col,
    targetTokenId: parseInt(a.targetTokenId),
    attackIndex: parseInt(a.attackIndex),
    resource: parseInt(a.resource),
    startTime: parseInt(a.startTime),
    endTime: parseInt(a.endTime),
    endTimestamp: end,
    executed: a.executed === true,
    cancelled: a.cancelled === true,
    stolenAmount: a.stolenAmount || '0',
    isActive: !a.executed && !a.cancelled && end > Date.now()
  };
}

// 🆕 Cache-Wrapper
export async function loadLive(opts = {}) {
  const { force = false, wallet = null } = opts;
  if (!force && Date.now() - lastFetchTime < CACHE_TTL_MS && lastFetchOk) {
    return;
  }
  // Alten Request abbrechen
  abortCtrl?.abort();
  abortCtrl = new AbortController();

  updateApiStatus('loading');
  try {
    // 1. Tokens
    const dataTokens = await fetchGraphQL(`{ tokens(first: 1000) { id revealed owner { id } } }`);
    if (dataTokens?.tokens) {
      for (const t of dataTokens.tokens) {
        const id = parseInt(t.id);
        minted.set(id, { revealed: t.revealed === true, owner: t.owner?.id ? t.owner.id.toLowerCase() : null, rarity: null });
      }
    }

    // 2. Rarity
    const dataRevealed = await fetchGraphQL(`{ blockRevealeds(first: 1000) { tokenId rarity } }`);
    if (dataRevealed?.blockRevealeds) {
      for (const br of dataRevealed.blockRevealeds) {
        const m = minted.get(parseInt(br.tokenId));
        if (m) m.rarity = parseInt(br.rarity);
      }
    }

    // 3. Farms (mit lastClaim-Fallback)
    let dataFarms = await fetchGraphQL(`{ farmV6S(first: 1000) { id active startTime lastClaim } }`);
    if (!dataFarms) dataFarms = await fetchGraphQL(`{ farmV6S(first: 1000) { id active startTime } }`);
    if (!dataFarms) dataFarms = await fetchGraphQL(`{ farmV6S(first: 1000) { id active } }`);
    if (dataFarms?.farmV6S) {
      farms.clear(); farmStartTimes.clear(); farmLastClaimTimes.clear();
      for (const raw of dataFarms.farmV6S) {
        const f = parseFarm(raw);
        if (f.active) {
          farms.add(f.id);
          if (f.startMs) farmStartTimes.set(f.id, f.startMs);
          if (f.lastClaimMs) farmLastClaimTimes.set(f.id, f.lastClaimMs);
        }
      }
    }

    // 4. Attacks
    const dataAttacks = await fetchGraphQL(`{ attackV6S(first: 1000) { attackerTokenId targetTokenId attackIndex resource startTime endTime executed cancelled stolenAmount } }`);
    attacks.clear();
    executedAttacks.length = 0;
    attackedTokenIds.clear();
    farmAttackedBy.clear();

    if (dataAttacks?.attackV6S) {
      for (const raw of dataAttacks.attackV6S) {
        const a = parseAttack(raw);
        if (!a) continue;

        if (a.executed || a.cancelled || a.endTimestamp < Date.now()) {
          // History
          executedAttacks.push(a);
          // 🆕 Farm-Attack-Tracking (nur wenn executed oder nicht cancelled)
          if (!a.cancelled) {
            markFarmAttacked(a.targetTokenId, {
              attackerId: a.attackerTokenId,
              resource: a.resource,
              executed: a.executed
            });
          }
        } else {
          // Aktiv
          attacks.set(a.targetTokenId, {
            ...a,
            startTime: performance.now(),
            interval: Math.max(2, a.endTime - a.startTime)
          });
        }
      }
    }

    // 5. Partnerships
    const dataPartners = await fetchGraphQL(`{ partnerships(first: 1000, where: {active: true}) { id } }`);
    if (dataPartners?.partnerships) {
      partnerships.clear();
      for (const p of dataPartners.partnerships) partnerships.add(parseInt(p.id));
    }

    // 6. 🆕 Attacks pro Wallet vom Tag (max 3)
    if (wallet) {
      try {
        const dayStart = Math.floor(Date.now() / 86400000) * 86400; // UTC midnight
        const dataMyAttacks = await fetchGraphQL(`{
          attackV6S(first: 100, where: { attacker: "${wallet.toLowerCase()}", startTime_gte: "${dayStart}" }) {
            id attackerTokenId
          }
        }`);
        resetAttacksUsed(wallet);
        if (dataMyAttacks?.attackV6S) {
          for (let i = 0; i < dataMyAttacks.attackV6S.length; i++) {
            incrementAttacksUsed(wallet);
          }
        }
      } catch (e) { console.warn('Could not sync wallet attack count', e); }
    }

    lastFetchTime = Date.now();
    lastFetchOk = true;
    state.apiErrorCount = 0;
    updateApiStatus('live');
    updateMyBlockCounts();
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.warn('Subgraph failed', e);
    state.apiErrorCount++;
    lastFetchOk = false;
    updateApiStatus('error', `${state.apiErrorCount} Fehler`);
  }

  const ov = document.getElementById('loadingOverlay');
  if (ov && !ov.classList.contains('hidden')) {
    ov.classList.add('hidden');
    setTimeout(() => ov.style.display = 'none', 500);
  }
}

// 🆕 Force-Refresh
export function forceRefresh(wallet = null) {
  lastFetchTime = 0;
  lastFetchOk = false;
  return loadLive({ force: true, wallet });
}