import { MAX_ROW, PHI, PI, TAU, GOLDEN_ANGLE, CENTER_ANGLE, COLORS, rarityNames, IS_MOBILE } from './phircle-config.js';
import { state, view, minted, farms, attacks, executedAttacks, partnerships, attackHistory, activeFilters, isBlockVisible, idToRC, blockId, updateMyBlockCounts } from './phircle-state.js';
import { updateAndDrawConfetti } from './phircle-utils.js';

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d', { alpha:false });
let W, H, CX, CY, MAX_R;

function resize() {
  W = canvas.width = innerWidth; H = canvas.height = innerHeight;
  CX = W/2; CY = H/2;
  MAX_R = Math.max(150, Math.min(W, H) * 0.45);
}
window.addEventListener('resize', resize); resize();

export function blockRadius(row) {
  if (row === 0) return 0;
  return MAX_R * (row / MAX_ROW) * state.explosionFactor;
}
export function blockPosition(row, col) {
  const r = blockRadius(row), n = 2*row+1, step = TAU/n;
  const angle = CENTER_ANGLE + (col-row)*step;
  return { x: CX+Math.cos(angle)*r, y: CY+Math.sin(angle)*r, angle, r };
}
export function blockSize(row) {
  const base = MAX_R / 130;
  const lodFactor = Math.max(0.6, Math.min(1.5, view.zoom));
  const sizeFactor = 0.9 + (row / MAX_ROW) * 0.2;
  return Math.max(2.5, base * sizeFactor * lodFactor);
}
window.focusOnBlock = (row, col) => {
  const p = blockPosition(row, col);
  const targetZoom = Math.max(view.tZoom, 2.0);
  view.tZoom = targetZoom;
  view.tOx = -(p.x - CX) * targetZoom;
  view.tOy = -(p.y - CY) * targetZoom;
};
window.resetView = () => { view.tZoom = 1; view.tOx = 0; view.tOy = 0; };

function screenToWorld(sx, sy) {
  const bs = 1 + Math.sin(performance.now()/1000/PI)*.006;
  return { x:(sx-CX-view.ox)/(view.zoom*bs)+CX, y:(sy-CY-view.oy)/(view.zoom*bs)+CY };
}
export function hitTest(sx, sy) {
  const w = screenToWorld(sx, sy); let best = null, bestD = Infinity;
  for (let row = 0; row <= MAX_ROW; row++) {
    const n = 2*row+1, hitR = Math.max(blockSize(row)*1.7, 12);
    const ringRot = state.isPaused ? 0 : (1/Math.pow(PI, 4-Math.min(4,row/25)))*.3*(performance.now()/1000);
    for (let col = 0; col < n; col++) {
      let p = blockPosition(row, col);
      if (row > 0 && !state.isPaused) {
        const dx = p.x-CX, dy = p.y-CY, c = Math.cos(ringRot), s = Math.sin(ringRot);
        p = { x: CX+dx*c-dy*s, y: CY+dx*s+dy*c };
      }
      const dx = w.x-p.x, dy = w.y-p.y, d = Math.sqrt(dx*dx+dy*dy);
      if (d < hitR && d < bestD) { bestD = d; best = { row, col, id: blockId(row,col) }; }
    }
  }
  return best;
}

function ownerColor(addr) {
  if (!addr) return '#444';
  let h = 0;
  for (let i = 2; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
}
function getBlockColor(id, m) {
  if (activeFilters.size > 0 && !isBlockVisible(id, m)) return '#151515';
  if (state.activeLayer === 'war-room') {
    if (!m) return '#0a0a0a';
    if (attacks.has(id)) return '#ff0000';
    if (m.owner === state.userAddress && !m.protected && m.rarity >= 3) return '#ff8800';
    if (m.rarity >= 4 && !m.protected) return '#ffff00';
    return '#151515';
  }
  if (state.activeLayer === 'my-farms') { if (!m) return COLORS.unminted; return farms.has(id) ? COLORS.farming : '#202020'; }
  if (state.activeLayer === 'rarity') {
    if (!m) return COLORS.unminted;
    if (!m.revealed) return '#2a2035';
    if (m.rarity == null) return '#888';
    return COLORS[rarityNames[m.rarity]?.toLowerCase()] || COLORS.gold;
  }
  if (state.activeLayer === 'owner') return m ? ownerColor(m.owner) : COLORS.unminted;
  if (state.activeLayer === 'farming') return m ? (farms.has(id) ? COLORS.farming : '#202020') : COLORS.unminted;
  if (state.activeLayer === 'attack') {
    if (!m) return COLORS.unminted;
    if (attacks.has(id)) return COLORS.attack;
    if (executedAttacks.some(a => a.targetTokenId === id)) return '#663300';
    return '#202020';
  }
  if (state.activeLayer === 'partner') return m ? (partnerships.has(id) ? COLORS.partner : '#202020') : COLORS.unminted;
  return COLORS.unminted;
}

function drawBackground(now) {
  const g = ctx.createRadialGradient(CX,CY,0,CX,CY,Math.max(10, MAX_R*1.7));
  g.addColorStop(0,'#0d0018'); g.addColorStop(.55,'#050008'); g.addColorStop(1,'#000');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(CX,CY); ctx.beginPath();
  const turns = 6, pts = 240;
  for (let i = 0; i <= pts; i++) {
    const t = i/pts, a = t*turns*TAU + now/1000*.02;
    const r = ((Math.pow(PHI,t*turns)-1)/(Math.pow(PHI,turns)-1))*MAX_R;
    i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  ctx.strokeStyle='rgba(255,204,0,.045)'; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(CX,CY);
  for (let s = 0; s < 12; s++) {
    const a = (s/12)*TAU;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*MAX_R, Math.sin(a)*MAX_R);
    ctx.strokeStyle = 'rgba(255,204,0,.035)'; ctx.stroke();
  }
  ctx.restore();
  const radarAngle = (now/1000)*0.4;
  const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(10, MAX_R));
  grad.addColorStop(0, 'rgba(255,204,0,.10)'); grad.addColorStop(1, 'rgba(255,204,0,0)');
  ctx.beginPath(); ctx.moveTo(CX, CY); ctx.arc(CX, CY, MAX_R, radarAngle, radarAngle + GOLDEN_ANGLE);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
}

function drawBlocks(now) {
  const t = now/1000;
  const myBlocksPos = [];
  for (let row = 0; row <= MAX_ROW; row++) {
    const n = 2*row+1, sz = blockSize(row);
    const ringRot = state.isPaused ? 0 : (1/Math.pow(PI, 4-Math.min(4,row/25)))*.3*t;
    for (let col = 0; col < n; col++) {
      let p = blockPosition(row, col);
      if (row > 0 && !state.isPaused) {
        const dx = p.x-CX, dy = p.y-CY, c = Math.cos(ringRot), s = Math.sin(ringRot);
        p = { x:CX+dx*c-dy*s, y:CY+dx*s+dy*c };
      }
      if (state.isPaused && Math.random() > 0.8) { p.x += (Math.random()-0.5)*3; p.y += (Math.random()-0.5)*3; }
      const id = blockId(row,col), m = minted.get(id), atk = attacks.get(id);
      const fill = getBlockColor(id, m);
      const isMine = state.userAddress && m && m.owner === state.userAddress;
      if (isMine) myBlocksPos.push(p);
      const isDimmed = activeFilters.size > 0 && !isBlockVisible(id, m);
      if (m && !m.revealed && !isDimmed) {
        const sp = .35 + .3*Math.sin(t*2+id);
        ctx.beginPath(); ctx.arc(p.x,p.y,sz*1.6,0,TAU);
        ctx.fillStyle=`rgba(140,100,255,${sp*.3})`; ctx.fill();
      }
      if (isMine && !isDimmed) {
        const pulse = .5 + .5*Math.sin(t*3+id);
        ctx.beginPath(); ctx.arc(p.x,p.y,sz+3+pulse*2,0,TAU);
        ctx.strokeStyle=COLORS.mine; ctx.lineWidth=1.5; ctx.stroke();
      }
      if (m && farms.has(id) && state.activeLayer !== 'farming' && state.activeLayer !== 'my-farms' && !isMine && !isDimmed) {
        ctx.beginPath(); ctx.arc(p.x,p.y,sz+1.5,0,TAU);
        ctx.fillStyle=COLORS.farming+'33'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x,p.y,sz,0,TAU);
      ctx.fillStyle = fill; ctx.fill();
      if (atk && !isDimmed) {
        const pulse = .5 + .5*Math.sin(t*6);
        ctx.beginPath(); ctx.arc(p.x,p.y,sz+2+pulse*3,0,TAU);
        ctx.strokeStyle=`rgba(255,51,51,${0.6+pulse*0.4})`; ctx.lineWidth=2.5; ctx.stroke();
      }
      if (state.selectedAttackerId === id) {
        ctx.beginPath(); ctx.arc(p.x,p.y,sz+4,0,TAU);
        ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2; ctx.stroke();
      }
      if (atk && !isDimmed) {
        const rem = Math.max(0, atk.endTimestamp - Date.now());
        const total = atk.interval*1000;
        const prog = 1 - rem/total;
        ctx.beginPath(); ctx.arc(p.x,p.y,sz,-PI/2,-PI/2+TAU*prog);
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
      }
    }
  }
  if (myBlocksPos.length > 1) {
    ctx.beginPath(); ctx.moveTo(myBlocksPos[0].x, myBlocksPos[0].y);
    for (let i = 1; i < myBlocksPos.length; i++) ctx.lineTo(myBlocksPos[i].x, myBlocksPos[i].y);
    ctx.strokeStyle = 'rgba(0,229,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
  }
  if (state.selectedAttackerId && state.lastClickedBlockId && state.lastClickedBlockId !== state.selectedAttackerId) {
    const rcA = idToRC(state.selectedAttackerId), rcB = idToRC(state.lastClickedBlockId);
    if (rcA && rcB) {
      const pA = blockPosition(rcA.row, rcA.col), pB = blockPosition(rcB.row, rcB.col);
      ctx.beginPath(); ctx.setLineDash([6,6]); ctx.moveTo(pA.x,pA.y); ctx.lineTo(pB.x,pB.y);
      ctx.strokeStyle = 'rgba(255,51,51,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

function drawPartnerships(now) {
  if (state.activeLayer !== 'partner' && state.activeLayer !== 'rarity') return;
  const t = now/1000;
  for (const id of partnerships) {
    const rc = idToRC(id); if (!rc) continue;
    const p = blockPosition(rc.row, rc.col);
    const alpha = 0.2 + 0.15*Math.sin(t*2+id);
    ctx.beginPath(); ctx.arc(p.x, p.y, blockSize(rc.row)*3, 0, TAU);
    ctx.strokeStyle = `rgba(192,96,255,${alpha})`; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawAttackRays(now) {
  for (const [targetId, atk] of attacks) {
    const trc = idToRC(targetId); if (!trc) continue;
    const tp = blockPosition(trc.row, trc.col);
    const ap = blockPosition(atk.attackerRow, atk.attackerCol);
    const el = (now-atk.startTime)/1000;
    const prog = (el % atk.interval) / atk.interval;
    const mx=(ap.x+tp.x)/2, my=(ap.y+tp.y)/2;
    const dx=tp.x-ap.x, dy=tp.y-ap.y;
    const cxp=mx-dy*.28/PHI, cyp=my+dx*.28/PHI;
    ctx.beginPath(); ctx.moveTo(ap.x,ap.y);
    const steps=28, upto=Math.max(1,Math.floor(steps*prog));
    for (let i=1;i<=upto;i++){
      const t=i/steps;
      ctx.lineTo((1-t)*(1-t)*ap.x+2*(1-t)*t*cxp+t*t*tp.x,
                 (1-t)*(1-t)*ap.y+2*(1-t)*t*cyp+t*t*tp.y);
    }
    ctx.strokeStyle=`rgba(255,51,51,${.85-prog*.55})`;
    ctx.lineWidth=3; ctx.shadowColor='#ff3333'; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
    const hx=(1-prog)*(1-prog)*ap.x+2*(1-prog)*prog*cxp+prog*prog*tp.x;
    const hy=(1-prog)*(1-prog)*ap.y+2*(1-prog)*prog*cyp+prog*prog*tp.y;
    ctx.beginPath(); ctx.arc(hx,hy,4,0,TAU); ctx.fillStyle='#fff'; ctx.fill();
  }
  for (let i = attackHistory.length - 1; i >= 0; i--) {
    const h = attackHistory[i];
    const el = (now - h.startTime) / 1000;
    if (el > 3) { attackHistory.splice(i,1); continue; }
    const alpha = 1 - el/3;
    ctx.beginPath(); ctx.moveTo(h.fromP.x, h.fromP.y); ctx.lineTo(h.toP.x, h.toP.y);
    ctx.strokeStyle = `rgba(255,200,50,${alpha*0.8})`; ctx.lineWidth = 4*alpha+1; ctx.stroke();
    ctx.beginPath(); ctx.arc(h.toP.x, h.toP.y, 6*alpha, 0, TAU);
    ctx.fillStyle = `rgba(255,220,80,${alpha*0.6})`; ctx.fill();
  }
}

function drawCenter(now) {
  const t = now/1000, pulse = .5+.5*Math.sin(t);
  ctx.save(); ctx.translate(CX, CY); ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = i*0.5 + t*0.6, r = i*0.35;
    i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  ctx.strokeStyle = `rgba(255,204,0,${0.25+pulse*0.3})`; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.arc(CX,CY,7+pulse*2.5,0,TAU); ctx.fillStyle=COLORS.gold; ctx.fill();
  ctx.beginPath(); ctx.arc(CX,CY,11+pulse*5,0,TAU); ctx.strokeStyle=`rgba(255,204,0,${.28+pulse*.32})`; ctx.stroke();
}

function drawRadar(now) {
  const radarCanvas = document.getElementById('radar');
  if (!radarCanvas.classList.contains('active')) return;
  const rctx = radarCanvas.getContext('2d');
  const R = radarCanvas.width = 120, r = R/2;
  rctx.clearRect(0,0,R,R);
  rctx.beginPath(); rctx.arc(r,r,r-2,0,TAU);
  rctx.fillStyle='rgba(0,0,0,0.5)'; rctx.fill();
  rctx.strokeStyle='#ffcc00'; rctx.stroke();
  for (const [id, m] of minted) {
    const rc = idToRC(id); if (!rc) continue;
    const dist = rc.row/MAX_ROW;
    const ang = CENTER_ANGLE + ((rc.col-rc.row)/(2*rc.row+1))*TAU;
    const px = r + Math.cos(ang)*dist*(r-4);
    const py = r + Math.sin(ang)*dist*(r-4);
    let color = '#666';
    if (m.owner === state.userAddress) color = '#00e5ff';
    else if (farms.has(id)) color = '#00ff88';
    else if (attacks.has(id)) color = '#ff3333';
    else if (m.rarity != null) color = COLORS[rarityNames[m.rarity].toLowerCase()];
    rctx.beginPath(); rctx.arc(px,py,1.2,0,TAU); rctx.fillStyle=color; rctx.fill();
  }
  rctx.strokeStyle = 'rgba(255,204,0,0.5)'; rctx.lineWidth=1;
  rctx.beginPath(); rctx.arc(r,r,(r-4)*(1/view.zoom),0,TAU); rctx.stroke();
}

let lastStats = 0, lastFrameTime = performance.now();
export function loop(now) {
  const dt = (now - lastFrameTime) / 1000; lastFrameTime = now;
  view.zoom += (view.tZoom-view.zoom)*.12;
  view.ox += (view.tOx-view.ox)*.12;
  view.oy += (view.tOy-view.oy)*.12;
  const targetExplosion = state.isPaused ? 2.5 : 1.0;
  state.explosionFactor += (targetExplosion - state.explosionFactor) * 0.05;

  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  drawBackground(now);
  const bs = 1 + Math.sin(now/1000/PI)*.006;
  ctx.save();
  ctx.translate(CX+view.ox, CY+view.oy);
  ctx.scale(view.zoom*bs, view.zoom*bs);
  ctx.translate(-CX,-CY);
  drawBlocks(now); drawPartnerships(now); drawAttackRays(now); drawCenter(now);
  ctx.restore();
  updateAndDrawConfetti(ctx, dt);
  drawRadar(now);

  if (now-lastStats > 600) {
    lastStats = now;
    const mi = document.getElementById('mintedCount');
    if (mi) mi.textContent = minted.size.toLocaleString('en-US');
    const ac = document.getElementById('attackCount'); if (ac) ac.textContent = attacks.size;
    const ec = document.getElementById('executedCount'); if (ec) ec.textContent = executedAttacks.length;
    const fc = document.getElementById('farmCount'); if (fc) fc.textContent = farms.size;
    const pc = document.getElementById('partnerCount'); if (pc) pc.textContent = partnerships.size;
    const r = MAX_R, vol = (PI*r*r*r*PHI/3)/1e9;
    const vc = document.getElementById('volCount'); if (vc) vc.textContent = vol.toFixed(2) + ' km³';
    if (state.userAddress) updateMyBlockCounts();
  }
  requestAnimationFrame(loop);
}

window.toggleRadarZoom = () => {
  state.radarMode = !state.radarMode;
  view.tZoom = state.radarMode ? 0.5 : 1.0;
  view.tOx = 0; view.tOy = 0;
};