import { ethers } from 'ethers';
import { NFT_ADDRESS, FARMING_V6_ADDRESS, PIRATES_V6_ADDRESS, MERCENARY_V4_ADDRESS, PUBLIC_RPC, NFT_ABI, FARMING_V6_ABI, PIRATES_V6_ABI, MERCENARY_V4_ABI, ID_STRIDE, resourceNames } from './phircle-config.js';
import { state, minted, farms, attacks, idToRC, updateMyBlockCounts } from './phircle-state.js';
import { blockPosition } from './phircle-canvas.js';
import { toast, playSound, haptic, logActivity, spawnConfetti } from './phircle-utils.js';
import { loadLive } from './phircle-data.js';

let provider, nftContract, farmingContract, piratesContract, mercenaryContract;

export async function connectReadOnly() {
  provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
  nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
  farmingContract = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, provider);
  piratesContract = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, provider);
  mercenaryContract = new ethers.Contract(MERCENARY_V4_ADDRESS, MERCENARY_V4_ABI, provider);
}

async function getSignerOrWarn() {
  if (!window.ethereum) { toast('No wallet found', 'error'); return null; }
  if (!state.userSigner) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const p = new ethers.BrowserProvider(window.ethereum);
      state.userSigner = await p.getSigner();
      state.userAddress = (await state.userSigner.getAddress()).toLowerCase();
      updateMyBlockCounts();
    } catch (e) { toast('Wallet connection failed', 'error'); return null; }
  }
  return state.userSigner;
}

window.connectWallet = async () => {
  if (!window.ethereum) return toast('No wallet found. Please install MetaMask.', 'error');
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const p = new ethers.BrowserProvider(window.ethereum);
    state.userSigner = await p.getSigner();
    state.userAddress = (await state.userSigner.getAddress()).toLowerCase();
    const btn = document.getElementById('wallet');
    btn.textContent = state.userAddress.slice(0,6) + '…' + state.userAddress.slice(-4);
    btn.classList.add('connected');
    updateMyBlockCounts();
    playSound(880, 0.15); haptic([20, 50, 20]);
    toast('Wallet connected ✓', 'success');
    logActivity(`Wallet connected: ${state.userAddress.slice(0,6)}…`, 'info');
    loadLive();
  } catch (e) { toast('Wallet connection failed: ' + e.message, 'error'); }
};

window.mintBlock = async (row, col) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
  try {
    const tx = await nft.mintWithINPI(row, col);
    await tx.wait();
    toast('Block minted ✓', 'success');
    playSound(660, 0.15);
    spawnConfetti(innerWidth/2, innerHeight/2, '#ffcc00');
    logActivity(`Block #${row*ID_STRIDE + col} minted`, 'mint');
    loadLive();
  } catch (e) { toast('Mint failed: ' + (e.reason||e.message), 'error'); }
};

window.toggleFarm = async (id) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);
  const isFarming = farms.has(id);
  try {
    const tx = isFarming ? await c.stopFarming(id) : await c.startFarming(id);
    await tx.wait();
    if (isFarming) farms.delete(id); else farms.add(id);
    toast(isFarming ? 'Farming stopped' : 'Farming started ✓', 'success');
    playSound(isFarming ? 400 : 720, 0.12);
    haptic([10, 30, 10]);
  } catch (e) { toast('Farming failed: ' + (e.reason||e.message), 'error'); }
};

window.claimResources = async (id) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);
  try {
    const tx = await c.claimResources(id);
    await tx.wait();
    toast('Resources claimed ✓', 'success');
    playSound(880, 0.15);
    spawnConfetti(innerWidth/2, innerHeight/2, '#00ff88');
  } catch (e) { toast('Claim failed: ' + (e.reason||e.message), 'error'); }
};

window.startAttackFromSidebar = async (targetId) => {
  const attackerSel = document.getElementById('sbAttackerSelect');
  const resourceSel = document.getElementById('sbResourceSelect');
  if (!attackerSel || !attackerSel.value) return toast('Choose an attacker first!', 'error');
  if (!resourceSel) return toast('Choose a resource!', 'error');
  const attackerId = parseInt(attackerSel.value);
  const resourceId = parseInt(resourceSel.value);
  state.selectedAttackerId = attackerId;
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
  try {
    const tx = await c.startAttack(attackerId, targetId, resourceId);
    await tx.wait();
    toast(`Attack started: #${attackerId} → #${targetId}`, 'success');
    playSound(220, 0.2, 'sawtooth'); haptic([30, 50, 30]);
    logActivity(`Attack #${attackerId} → #${targetId} (${resourceNames[resourceId]})`, 'attack');
    const rc = idToRC(attackerId);
    attacks.set(targetId, {
      attackerTokenId: attackerId, attackerRow: rc.row, attackerCol: rc.col,
      attackIndex: 0, resource: resourceId,
      startTime: performance.now(), interval: 60, endTimestamp: Date.now() + 60000
    });
    setTimeout(() => loadLive(), 2000);
  } catch (e) { toast('Attack failed: ' + (e.reason||e.message), 'error'); }
};

window.executeAttack = async (targetId, attackIndex) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
  const atk = attacks.get(targetId);
  try {
    const tx = await c.executeAttack(targetId, attackIndex);
    await tx.wait();
    toast('Attack executed! 💰', 'success');
    playSound(440, 0.3, 'triangle'); haptic([50, 30, 50]);
    spawnConfetti(innerWidth/2, innerHeight/2, '#00ff88');
    logActivity(`Attack executed on #${targetId}`, 'executed');
    if (atk) {
      const targetRc = idToRC(targetId);
      if (targetRc) {
        window.__attackHistoryPush?.({
          fromP: blockPosition(atk.attackerRow, atk.attackerCol),
          toP: blockPosition(targetRc.row, targetRc.col),
          startTime: performance.now()
        });
      }
    }
    attacks.delete(targetId);
    loadLive();
  } catch (e) { toast('Execute failed: ' + (e.reason||e.message), 'error'); }
};

window.buyPirateBoost = async () => {
  if (!state.selectedAttackerId) return toast('Choose an attacker first!', 'error');
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
  try {
    const tx = await c.buyPirateBoost(state.selectedAttackerId, 1);
    await tx.wait();
    toast('Pirate Boost activated ⚡', 'success');
    playSound(740, 0.15);
  } catch (e) { toast('Boost failed: ' + (e.reason||e.message), 'error'); }
};