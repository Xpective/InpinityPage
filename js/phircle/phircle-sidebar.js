import { rarityNames, resourceNames, RARITY_PRODUCTION, COLORS } from './phircle-config.js';
import { state, minted, farms, attacks, executedAttacks, partnerships, farmStartTimes, getProfitPrediction, calculateFarmDurationDays, calculateDynamicReward, formatDuration, idToRC } from './phircle-state.js';
import { playSound, haptic } from './phircle-utils.js';
import { blockPosition } from './phircle-canvas.js';
import { addToHistory } from './phircle-history.js';

export async function showBlockInfo(hit) {
  document.getElementById('tooltip').style.display = 'none';
  playSound(660, 0.05); haptic([5]);
  if (state.view_zoom_check?.() ?? false) {}
  window.focusOnBlock?.(hit.row, hit.col);
  if (state.lastClickedBlockId !== hit.id) {
    state.lastClickedBlockId = hit.id;
    addToHistory(hit.id);
  }
  history.replaceState(null, '', `#block/${hit.id}`);

  const id = hit.id, m = minted.get(id), atk = attacks.get(id);
  document.getElementById('sbTitle').textContent = `Block #${id}`;
  const rIdx = m ? m.rarity : null;
  const rName = rIdx != null ? rarityNames[rIdx] : null;
  const isMine = state.userAddress && m && m.owner === state.userAddress;
  const historyAttacks = executedAttacks.filter(a => a.targetTokenId === id || a.attackerTokenId === id);

  let h = `
    <div class="info-row"><span>Row</span><strong>${hit.row}</strong></div>
    <div class="info-row"><span>Column</span><strong>${hit.col}</strong></div>
    <div class="info-row"><span>ID</span><strong>#${id}</strong></div>
    <div class="info-row"><span>Status</span><strong style="color:${m?'#ffcc00':'#888'}">${m?'Minted':'Unminted'}</strong></div>`;
  if (m) {
    h += `<div class="info-row"><span>Reveal</span><strong style="color:${m.revealed?'#00ff88':'#888'}">${m.revealed?'● Yes':'○ No'}</strong></div>`;
    if (m.owner) h += `<div class="info-row"><span>Owner</span><strong style="font-size:10px; color:${isMine?'#00e5ff':'#e0e0e0'}">${isMine?'YOU':m.owner.slice(0,6)+'…'+m.owner.slice(-4)}</strong></div>`;
    if (rName) {
      h += `<div class="info-row"><span>Rarity</span><strong style="color:${COLORS[rName.toLowerCase()]||'#fff'}">${rName.toUpperCase()}</strong></div>`;
      h += `<div class="rarity-bar" style="background:${COLORS[rName.toLowerCase()]||'#fff'}"></div>`;
    }
    h += `<div class="info-row"><span>Farming</span><strong style="color:${farms.has(id)?'#00ff88':'#666'}">${farms.has(id)?'● Active':'○ Inactive'}</strong></div>`;
    // 🆕 Farmdauer + dynamische Belohnung
    if (farms.has(id) && rIdx != null) {
      const days = calculateFarmDurationDays(id);
      const dynReward = calculateDynamicReward(rIdx, days);
      const baseReward = (RARITY_DAILY_OUTPUT_CACHE[rIdx] || 0) * days;
      h += `<div class="profit-box" style="background:rgba(0,255,136,0.05);border-color:#00ff88;">
        <div class="label">🌾 Farm läuft seit</div>
        <div class="value" style="font-size:16px;color:#00ff88;">${days < 1 ? (days * 24).toFixed(1) + 'h' : days.toFixed(2) + ' Tage'}</div>
        <div class="sub">Erwartete Belohnung: <strong style="color:#00ff88;">${dynReward.toFixed(1)}</strong> tokens</div>
        <div class="sub" style="font-size:10px;color:#888;">Basis (linear): ${baseReward.toFixed(0)} · Bonus: +${(dynReward - baseReward).toFixed(0)}</div>
      </div>`;
    }
  }
  if (atk) {
    const rem = Math.max(0, atk.endTimestamp - Date.now());
    h += `<div class="info-row" style="color:#ff3333"><span>⚠ Incoming Attack</span><strong>${(rem/1000).toFixed(1)}s</strong></div>`;
  }
  if (historyAttacks.length) h += `<div class="info-row"><span>📜 History</span><strong>${historyAttacks.length} attacks</strong></div>`;
  if (partnerships.has(id)) h += `<div class="info-row"><span>Partner</span><strong>● Active</strong></div>`;
  h += '<hr style="border:none;border-top:1px solid #222;margin:14px 0;">';

  if (!m) {
    h += `<button onclick="window.mintBlock(${hit.row},${hit.col})">⛏ Mint with INPI</button>`;
  } else if (isMine) {
    if (state.selectedAttackerId !== id) {
      h += `<button class="clear-btn" onclick="window.setAttackerFromSidebar(${id})" style="background:#ff3333; color:#fff;">⚔ Set as Attacker</button>`;
    } else {
      h += `<div class="note" style="background:rgba(0,229,255,0.1); border-left-color:#00e5ff; color:#00e5ff;">✓ This is your current attacker</div>`;
    }
    h += `<button onclick="window.toggleFarm(${id})">🌾 ${farms.has(id)?'Stop Farming':'Start Farming'}</button>
          <button onclick="window.claimResources(${id})">💰 Claim</button>`;
  } else {
    if (atk) {
      const rem = Math.max(0, atk.endTimestamp - Date.now());
      if (rem <= 0) {
        h += `<div class="note">⚔️ Attack is ready!</div><button class="execute-btn" onclick="window.executeAttack(${id},${atk.attackIndex})">⚔ Execute (Ready!)</button>`;
      } else {
        h += `<div class="note">⏳ Attack in progress. Ready in ${formatDuration(rem)}</div><button disabled>⏳ Wait</button>`;
      }
    } else {
      h += `<div class="label">1. Choose your attacker</div><select id="sbAttackerSelect" onchange="window.updateProfitPreview(${id})">`;
      if (state.userAddress) {
        let found = false;
        for (const [tid, myM] of minted) {
          if (myM.owner === state.userAddress) { found = true; h += `<option value="${tid}" ${state.selectedAttackerId===tid?'selected':''}>Block #${tid}</option>`; }
        }
        if (!found) h += `<option value="">No owned blocks</option>`;
      } else h += `<option value="">Connect Wallet</option>`;
      h += `</select>`;
      const prodIds = rIdx != null ? RARITY_PRODUCTION[rIdx] : [0,1,2];
      h += `<div class="label">2. Choose resource to steal</div><select id="sbResourceSelect" onchange="window.updateProfitPreview(${id})">`;
      for (const resId of prodIds) h += `<option value="${resId}">${resourceNames[resId]}</option>`;
      h += `</select>`;
      if (rIdx != null) {
        const prediction = getProfitPrediction(rIdx, 0);
        h += `<div class="profit-box" id="profitBox"><div class="label">💰 Profit Predictor</div><div class="value">~${prediction.estimatedSteal} ${resourceNames[0]}</div><div class="sub">Steal: ${prediction.effectiveStealPercent}% · Expected: ${prediction.perResource} ${resourceNames[0]}/day</div></div>`;
      }
      h += `<div class="label">3. Optional: Pirate Boost (+25% Steal)</div>
            <button style="background:#333; color:#ffb347; font-size:11px; padding:8px;" onclick="window.buyPirateBoost()">⚡ Buy Pirate Boost (100 PIT/day)</button>
            <button class="attack-btn" onclick="window.startAttackFromSidebar(${id})">⚔ Start Attack</button>`;
    }
  }
  h += `<button class="share-btn" onclick="window.shareBlock(${id})">🔗 Share Link</button>`;
  if (state.lastClickedBlockId) h += `<button class="clear-btn" onclick="window.clearSelection()">✕ Clear Selection</button>`;
  h += `<button class="close" onclick="document.getElementById('sidebar').classList.remove('active')">Close</button>`;
  document.getElementById('sbContent').innerHTML = h;
  document.getElementById('sidebar').classList.add('active');
}

// Helper-Cache für Basis-Rate
import { RARITY_DAILY_OUTPUT } from './phircle-config.js';
const RARITY_DAILY_OUTPUT_CACHE = RARITY_DAILY_OUTPUT;

window.updateProfitPreview = (targetId) => {
  const m = minted.get(targetId);
  const resourceSel = document.getElementById('sbResourceSelect');
  const profitBox = document.getElementById('profitBox');
  if (!m || m.rarity == null || !profitBox || !resourceSel) return;
  const resourceId = parseInt(resourceSel.value);
  const prediction = getProfitPrediction(m.rarity, resourceId);
  profitBox.innerHTML = `
    <div class="label">💰 Profit Predictor</div>
    <div class="value">~${prediction.estimatedSteal} ${resourceNames[resourceId]}</div>
    <div class="sub">Steal: ${prediction.effectiveStealPercent}% · Expected: ${prediction.perResource.toFixed(1)} ${resourceNames[resourceId]}/day</div>
    <div class="sub" style="color:${prediction.profitScore==='good'?'#00ff88':'#ff8800'}; margin-top:4px; font-weight:bold;">${prediction.profitScore==='good'?'✅ Good deal!':'⚠️ Low profit'}</div>
  `;
};

window.setAttackerFromSidebar = (id) => {
  state.selectedAttackerId = id;
  state.lastClickedBlockId = id;
  playSound(880, 0.08);
  showBlockInfo({ row: Math.floor(id / 2049), col: id % 2049, id });
};

window.clearSelection = () => {
  state.selectedAttackerId = null;
  state.lastClickedBlockId = null;
  history.replaceState(null, '', location.pathname);
  document.getElementById('sidebar').classList.remove('active');
};

// Brücke: attackHistory-Push für Canvas
import { attackHistory } from './phircle-state.js';
window.__attackHistoryPush = (entry) => {
  attackHistory.push(entry);
  setTimeout(() => {
    const idx = attackHistory.indexOf(entry);
    if (idx >= 0) attackHistory.splice(idx, 1);
  }, 3100);
};