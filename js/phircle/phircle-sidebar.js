import { rarityNames, resourceNames, RARITY_PRODUCTION, COLORS, RARITY_DAILY_OUTPUT, ID_STRIDE } from './phircle-config.js';
import {
  state, minted, farms, attacks, executedAttacks, partnerships, farmStartTimes,
  getProfitPrediction, calculateFarmDurationDays, calculateEffectiveFarmDays,
  getFarmRewardBreakdown, getFarmAttackedInfo, isFarmAttacked, isFarmClaimed,
  canStartAttack, getAttacksUsed, MAX_ATTACKS_PER_WALLET, MAX_FARM_PAYOUT_DAYS,
  formatDuration, idToRC
} from './phircle-state.js';
import { playSound, haptic, toast } from './phircle-utils.js';
import { addToHistory } from './phircle-history.js';
import { forceRefresh } from './phircle-data.js';

// ============================================================
// HELPER: Alle ausgehenden Angriffe von einem Block holen
// ============================================================
function getOutgoingAttacks(attackerId) {
  const list = [];
  for (const [targetId, atk] of attacks) {
    if (atk.attackerTokenId === attackerId) {
      const rem = Math.max(0, atk.endTimestamp - Date.now());
      list.push({ targetId, atk, rem, ready: rem <= 0 });
    }
  }
  return list;
}

// ============================================================
// HELPER: Attack-Quota-Anzeige
// ============================================================
function renderAttackQuota() {
  if (!state.userAddress) return '';
  const used = getAttacksUsed(state.userAddress);
  const remaining = Math.max(0, MAX_ATTACKS_PER_WALLET - used);
  const pct = (used / MAX_ATTACKS_PER_WALLET) * 100;
  const color = remaining === 0 ? '#ff3333' : remaining === 1 ? '#ff8800' : '#00ff88';
  return `
    <div class="info-row" style="background:rgba(255,255,255,0.02);padding:8px;border-radius:4px;margin:8px 0;">
      <span>🎯 Attacks today</span>
      <strong style="color:${color};">${used} / ${MAX_ATTACKS_PER_WALLET}</strong>
    </div>
    <div style="height:3px;background:#222;border-radius:2px;margin-bottom:10px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${color};transition:width 0.3s;"></div>
    </div>
  `;
}

// ============================================================
// HELPER: Farm-Attack-Warnung
// ============================================================
function renderFarmAttackedWarning(id) {
  if (!isFarmAttacked(id)) return '';
  const info = getFarmAttackedInfo(id);
  if (!info) return '';
  return `
    <div class="note" style="background:rgba(255,51,51,0.15);border-left-color:#ff3333;color:#ff8888;">
      ⚠️ <strong>Farm attacked!</strong> by Block #${info.attackerId}<br>
      <span style="font-size:10px;color:#ffaaaa;">Reward may be reduced. Claim soon!</span>
    </div>
  `;
}

// ============================================================
// HELPER: Eingehender Angriff auf diesen Block
// ============================================================
function renderIncomingAttack(id) {
  const atk = attacks.get(id);
  if (!atk) return '';
  const rem = Math.max(0, atk.endTimestamp - Date.now());
  const ready = rem <= 0;
  const color = ready ? '#ff3333' : '#ff8800';
  return `
    <div class="info-row" style="color:${color};background:rgba(255,51,51,0.1);padding:10px;border-radius:4px;border-left:3px solid ${color};margin:8px 0;">
      <span>⚠️ Incoming Attack</span>
      <strong>${ready ? 'READY!' : formatDuration(rem)}</strong>
    </div>
    <div style="font-size:10px;color:#888;margin-bottom:8px;">
      From Block #${atk.attackerTokenId} · Resource: ${resourceNames[atk.resource] || '?'}
    </div>
  `;
}

// ============================================================
// HELPER: Ausgehende Angriffe aufzeigen
// ============================================================
function renderOutgoingAttacks(attackerId) {
  const outgoing = getOutgoingAttacks(attackerId);
  if (!outgoing.length) return '';
  let html = `<div class="label" style="color:#00e5ff;">⚔️ Outgoing Attacks (${outgoing.length})</div>`;
  for (const { targetId, atk, rem, ready } of outgoing) {
    html += `
      <div style="background:rgba(0,229,255,0.08);border-left:3px solid ${ready ? '#00ff88' : '#00e5ff'};padding:10px;border-radius:4px;margin:6px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
          <span>→ Target #${targetId}</span>
          <strong style="color:${ready ? '#00ff88' : '#ffaa00'};">${ready ? '✓ READY' : formatDuration(rem)}</strong>
        </div>
        <div style="font-size:10px;color:#888;margin:4px 0;">${resourceNames[atk.resource] || '?'}</div>
        ${ready ? `<button class="execute-btn" onclick="window.executeAttack(${targetId}, ${atk.attackIndex})">⚔ Execute Now</button>` : `<button disabled>⏳ Wait ${formatDuration(rem)}</button>`}
      </div>
    `;
  }
  return html;
}

// ============================================================
// HELPER: Farm-Reward-Breakdown (7-Tage-Cap)
// ============================================================
function renderFarmBreakdown(id, rarity) {
  const bd = getFarmRewardBreakdown(rarity, id);
  const isCapped = bd.isCapped;
  const capColor = isCapped ? '#ff8800' : '#00ff88';
  const barPct = Math.min(100, (bd.effectiveDays / bd.maxPayoutDays) * 100);
  return `
    <div class="profit-box" style="background:rgba(0,255,136,0.05);border-color:${isCapped ? '#ff8800' : '#00ff88'};">
      <div class="label">🌾 Farm läuft seit</div>
      <div class="value" style="color:${capColor};font-size:16px;">${bd.actualDays.toFixed(1)} Tage</div>
      <div style="height:4px;background:#222;border-radius:2px;margin:6px 0;overflow:hidden;">
        <div style="height:100%;width:${barPct}%;background:${capColor};transition:width 0.4s;"></div>
      </div>
      <div class="sub" style="color:${capColor};">
        <strong>Auszahlung: ${bd.effectiveDays.toFixed(1)} / ${bd.maxPayoutDays} Tage</strong>${isCapped ? ' (MAX)' : ''}
      </div>
      ${isCapped ? `<div class="sub" style="color:#ff8888;font-size:10px;">⚠️ ${bd.lostDays.toFixed(1)} Tage über Cap — claimen!</div>` : ''}
      <div class="sub" style="margin-top:6px;">Erwartete Belohnung: <strong style="color:#00ff88;">${bd.dynamicReward.toFixed(1)}</strong> tokens</div>
      <div class="sub" style="font-size:10px;color:#888;">Basis: ${bd.baseReward.toFixed(0)} · Bonus: +${bd.bonus.toFixed(0)}</div>
      ${isFarmClaimed(id) ? `<div class="sub" style="color:#00e5ff;font-size:10px;margin-top:4px;">✓ Last claim: ${new Date(farmStartTimes.get(id) || 0).toLocaleTimeString()}</div>` : ''}
    </div>
  `;
}

// ============================================================
// MAIN: showBlockInfo
// ============================================================
export async function showBlockInfo(hit) {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) tooltip.style.display = 'none';
  playSound(660, 0.05); haptic([5]);

  // Deep-Link + Zoom
  window.focusOnBlock?.(hit.row, hit.col);
  if (state.lastClickedBlockId !== hit.id) {
    state.lastClickedBlockId = hit.id;
    addToHistory(hit.id);
  }
  try { history.replaceState(null, '', `#block/${hit.id}`); } catch {}

  const id = hit.id;
  const m = minted.get(id);
  const atk = attacks.get(id);
  const rIdx = m ? m.rarity : null;
  const rName = rIdx != null ? rarityNames[rIdx] : null;
  const isMine = state.userAddress && m && m.owner === state.userAddress;
  const outgoing = isMine ? getOutgoingAttacks(id) : [];
  const canAttack = state.userAddress && canStartAttack(state.userAddress);

  document.getElementById('sbTitle').textContent = `Block #${id}`;

  // ============ INFO SECTION ============
  let h = `
    <div class="info-row"><span>Row</span><strong>${hit.row}</strong></div>
    <div class="info-row"><span>Column</span><strong>${hit.col}</strong></div>
    <div class="info-row"><span>ID</span><strong>#${id}</strong></div>
    <div class="info-row"><span>Status</span><strong style="color:${m?'#ffcc00':'#888'}">${m?'Minted':'Unminted'}</strong></div>`;

  if (m) {
    h += `<div class="info-row"><span>Reveal</span><strong style="color:${m.revealed?'#00ff88':'#888'}">${m.revealed?'● Yes':'○ No'}</strong></div>`;
    if (m.owner) {
      h += `<div class="info-row"><span>Owner</span><strong style="font-size:10px;color:${isMine?'#00e5ff':'#e0e0e0'}">${isMine?'YOU':m.owner.slice(0,6)+'…'+m.owner.slice(-4)}</strong></div>`;
    }
    if (rName) {
      h += `<div class="info-row"><span>Rarity</span><strong style="color:${COLORS[rName.toLowerCase()]||'#fff'}">${rName.toUpperCase()}</strong></div>`;
      h += `<div class="rarity-bar" style="background:${COLORS[rName.toLowerCase()]||'#fff'}"></div>`;
    }
    h += `<div class="info-row"><span>Farming</span><strong style="color:${farms.has(id)?'#00ff88':'#666'}">${farms.has(id)?'● Active':'○ Inactive'}</strong></div>`;
  }

  h += renderFarmAttackedWarning(id);
  h += renderIncomingAttack(id);

  // Farm-Breakdown (nur wenn farming + rarity vorhanden)
  if (farms.has(id) && rIdx != null) {
    h += renderFarmBreakdown(id, rIdx);
  }

  // Outgoing attacks (nur bei eigenen Blöcken)
  if (isMine && outgoing.length) {
    h += renderOutgoingAttacks(id);
  }

  h += '<hr style="border:none;border-top:1px solid #222;margin:14px 0;">';

  // ============ ACTIONS SECTION ============
  if (!m) {
    // Unminted
    h += `<button onclick="window.mintBlock(${hit.row},${hit.col})">⛏ Mint with INPI</button>`;

  } else if (isMine) {
    // My block
    if (state.selectedAttackerId !== id) {
      h += `<button class="clear-btn" onclick="window.setAttackerFromSidebar(${id})" style="background:#ff3333;color:#fff;">⚔ Set as Attacker</button>`;
    } else {
      h += `<div class="note" style="background:rgba(0,229,255,0.1);border-left-color:#00e5ff;color:#00e5ff;">✓ This is your current attacker</div>`;
    }
    h += `<button onclick="window.toggleFarm(${id})">🌾 ${farms.has(id)?'Stop Farming':'Start Farming'}</button>`;
    if (farms.has(id)) {
      h += `<button onclick="window.claimResources(${id})" style="background:linear-gradient(135deg,#00ff88,#00aa55);">💰 Claim Resources</button>`;
    }

  } else {
    // Foreign block
    if (atk) {
      // Under attack — show warning only (execute stays on attacker block)
      h += `<div class="note">⚠️ This block is under attack. The attacker must execute.</div>`;
    } else {
      // Attack setup
      h += `<div class="label">1. Choose your attacker</div>`;
      h += `<select id="sbAttackerSelect" onchange="window.updateProfitPreview(${id})">`;
      if (state.userAddress) {
        let found = false;
        for (const [tid, myM] of minted) {
          if (myM.owner === state.userAddress) {
            found = true;
            const busy = getOutgoingAttacks(tid).length > 0;
            h += `<option value="${tid}" ${state.selectedAttackerId===tid?'selected':''}>Block #${tid}${busy?' (attacking!)':''}</option>`;
          }
        }
        if (!found) h += `<option value="">No owned blocks</option>`;
      } else {
        h += `<option value="">Connect Wallet</option>`;
      }
      h += `</select>`;

      const prodIds = rIdx != null ? RARITY_PRODUCTION[rIdx] : [0, 1, 2];
      h += `<div class="label">2. Choose resource to steal</div>`;
      h += `<select id="sbResourceSelect" onchange="window.updateProfitPreview(${id})">`;
      for (const resId of prodIds) h += `<option value="${resId}">${resourceNames[resId]}</option>`;
      h += `</select>`;

      if (rIdx != null) {
        const prediction = getProfitPrediction(rIdx, 0);
        h += `<div class="profit-box" id="profitBox">
          <div class="label">💰 Profit Predictor</div>
          <div class="value">~${prediction.estimatedSteal} ${resourceNames[0]}</div>
          <div class="sub">Steal: ${prediction.effectiveStealPercent}% · Expected: ${prediction.perResource} ${resourceNames[0]}/day</div>
        </div>`;
      }

      // Attack-Quota Warnung
      h += renderAttackQuota();

      if (!canAttack && state.userAddress) {
        h += `<div class="note" style="background:rgba(255,51,51,0.15);border-left-color:#ff3333;">❌ Daily attack limit reached (3/3). Try again tomorrow.</div>`;
      }

      h += `<div class="label">3. Optional: Pirate Boost (+25% Steal)</div>`;
      h += `<button style="background:#333;color:#ffb347;font-size:11px;padding:8px;" onclick="window.buyPirateBoost()">⚡ Buy Pirate Boost (100 PIT/day)</button>`;
      h += `<button class="attack-btn" onclick="window.startAttackFromSidebar(${id})" ${!canAttack && state.userAddress ? 'disabled' : ''}>⚔ Start Attack</button>`;
    }
  }

  // ============ META SECTION ============
  h += `<hr style="border:none;border-top:1px solid #222;margin:14px 0;">`;
  h += `<button class="share-btn" onclick="window.shareBlock(${id})">🔗 Share Link</button>`;
  h += `<button class="share-btn" style="background:#222;color:#00e5ff;" onclick="window.__sidebarRefresh?.()">🔄 Refresh Data</button>`;
  if (state.lastClickedBlockId) {
    h += `<button class="clear-btn" onclick="window.clearSelection()">✕ Clear Selection</button>`;
  }
  h += `<button class="close" onclick="document.getElementById('sidebar').classList.remove('active')">Close</button>`;

  document.getElementById('sbContent').innerHTML = h;
  document.getElementById('sidebar').classList.add('active');
}

// ============================================================
// REFRESH BUTTON
// ============================================================
window.__sidebarRefresh = async () => {
  toast('Refreshing...', 'info', 1500);
  await forceRefresh(state.userAddress);
  if (state.lastClickedBlockId) {
    const rc = idToRC(state.lastClickedBlockId);
    if (rc) showBlockInfo({ row: rc.row, col: rc.col, id: state.lastClickedBlockId });
  }
};

// ============================================================
// PROFIT PREVIEW (verbessert mit Protection-Level)
// ============================================================
window.updateProfitPreview = (targetId) => {
  const m = minted.get(targetId);
  const resourceSel = document.getElementById('sbResourceSelect');
  const profitBox = document.getElementById('profitBox');
  if (!m || m.rarity == null || !profitBox || !resourceSel) return;
  const resourceId = parseInt(resourceSel.value);
  const prediction = getProfitPrediction(m.rarity, resourceId);
  const profitColor = prediction.profitScore === 'good' ? '#00ff88' : '#ff8800';
  profitBox.innerHTML = `
    <div class="label">💰 Profit Predictor</div>
    <div class="value">~${prediction.estimatedSteal} ${resourceNames[resourceId]}</div>
    <div class="sub">Steal: ${prediction.effectiveStealPercent}% · Expected: ${prediction.perResource.toFixed(1)} ${resourceNames[resourceId]}/day</div>
    <div class="sub" style="color:${profitColor};margin-top:4px;font-weight:bold;">
      ${prediction.profitScore === 'good' ? '✅ Good deal!' : '⚠️ Low profit'}
    </div>
  `;
};

// ============================================================
// ATTACKER SELECTION
// ============================================================
window.setAttackerFromSidebar = (id) => {
  state.selectedAttackerId = id;
  state.lastClickedBlockId = id;
  playSound(880, 0.08);
  const rc = idToRC(id);
  if (rc) showBlockInfo({ row: rc.row, col: rc.col, id });
};

window.clearSelection = () => {
  state.selectedAttackerId = null;
  state.lastClickedBlockId = null;
  try { history.replaceState(null, '', location.pathname); } catch {}
  document.getElementById('sidebar').classList.remove('active');
};

// ============================================================
// BRIDGE: Attack-Trail-Push für Canvas
// ============================================================
import { attackHistory } from './phircle-state.js';
window.__attackHistoryPush = (entry) => {
  attackHistory.push(entry);
  setTimeout(() => {
    const idx = attackHistory.indexOf(entry);
    if (idx >= 0) attackHistory.splice(idx, 1);
  }, 3100);
};