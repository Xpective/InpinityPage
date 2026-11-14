import { ethers } from 'ethers';
import {
  NFT_ADDRESS, FARMING_V6_ADDRESS, PIRATES_V6_ADDRESS, MERCENARY_V4_ADDRESS,
  PUBLIC_RPC, NFT_ABI, FARMING_V6_ABI, PIRATES_V6_ABI, MERCENARY_V4_ABI,
  ID_STRIDE, resourceNames
} from './phircle-config.js';
import {
  state, minted, farms, attacks, idToRC, updateMyBlockCounts,
  canStartAttack, incrementAttacksUsed, getAttacksUsed, MAX_ATTACKS_PER_WALLET,
  markFarmAttacked, isFarmAttacked, isFarmClaimed, markFarmClaimed
} from './phircle-state.js';
import { blockPosition } from './phircle-canvas.js';
import { toast, playSound, haptic, logActivity, spawnConfetti, debug } from './phircle-utils.js';
import { loadLive, forceRefresh } from './phircle-data.js';

// ============================================================
// CONTRACT INSTANCES (Cache)
// ============================================================
let provider;
let nftContract, farmingContract, piratesContract, mercenaryContract;
let readOnlyReady = false;

export async function connectReadOnly() {
  if (readOnlyReady) return;
  provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
  nftContract       = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
  farmingContract   = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, provider);
  piratesContract   = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, provider);
  mercenaryContract = new ethers.Contract(MERCENARY_V4_ADDRESS, MERCENARY_V4_ABI, provider);
  readOnlyReady = true;
}

// ============================================================
// ERROR DECODER (15 Fehlerarten)
// ============================================================
function decodeError(err) {
  // User rejected
  if (err?.code === 4001 || err?.code === 'ACTION_REJECTED' || /user rejected/i.test(err?.message || '')) {
    return { type: 'user-rejected', message: '❌ Transaction cancelled by user' };
  }
  // Extract reason
  const reason = (err?.reason || err?.shortMessage || err?.message || '').toLowerCase();

  // Contract revert reasons
  if (/already.?claim|already.?reward/i.test(reason)) return { type: 'already-claimed', message: '⚠️ Farm already claimed — nothing to claim' };
  if (/no.?reward|nothing.?to.?claim|zero.?reward/i.test(reason)) return { type: 'no-reward', message: '⚠️ No rewards to claim yet' };
  if (/already.?attack|already.?under.?attack|is.?attacked/i.test(reason)) return { type: 'already-attacked', message: '⚠️ Farm is already under attack' };
  if (/max.?attack|attack.?limit|daily.?limit/i.test(reason)) return { type: 'limit', message: '❌ Daily attack limit reached (3/3)' };
  if (/not.?owner|only.?owner/i.test(reason)) return { type: 'auth', message: '❌ You do not own this block' };
  if (/not.?ready|too.?early|not.?yet/i.test(reason)) return { type: 'timing', message: '⏳ Attack not ready yet' };
  if (/protect|shield/i.test(reason)) return { type: 'protected', message: '🛡️ Target is protected — cannot attack' };
  if (/not.?farming|farm.?not.?active/i.test(reason)) return { type: 'not-farming', message: '⚠️ Farm is not active' };
  if (/insufficient|funds|balance/i.test(reason)) return { type: 'funds', message: '💸 Insufficient funds for gas + tx' };
  if (/wrong.?chain|chain.?id|network/i.test(reason)) return { type: 'network', message: '🌐 Wrong network — switch to Base' };
  if (/already.?mint|mint.?exists/i.test(reason)) return { type: 'minted', message: '⚠️ Block already minted' };
  if (/not.?mint|not.?reveal/i.test(reason)) return { type: 'not-ready', message: '⚠️ Block not ready for this action' };
  if (/paused|halted/i.test(reason)) return { type: 'paused', message: '⏸️ Contract paused — try again later' };
  if (/gas.?limit|out.?of.?gas/i.test(reason)) return { type: 'gas', message: '⛽ Gas limit too low — retry' };
  if (/nonce/i.test(reason)) return { type: 'nonce', message: '🔄 Nonce error — refresh & retry' };

  // Fallback
  return {
    type: 'unknown',
    message: '❌ ' + (err?.shortMessage || err?.reason || 'Transaction failed').slice(0, 100)
  };
}

// ============================================================
// SIGNER HELPER
// ============================================================
async function getSignerOrWarn() {
  if (!window.ethereum) { toast('No wallet found', 'error'); return null; }
  if (!state.userSigner) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // Network-Check: Base = 8453
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(chainId, 16) !== 8453) {
          toast('Please switch to Base network', 'error', 4000);
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }]
            });
          } catch { return null; }
        }
      } catch (e) { debug('Chain check failed', e); }

      const p = new ethers.BrowserProvider(window.ethereum);
      state.userSigner = await p.getSigner();
      state.userAddress = (await state.userSigner.getAddress()).toLowerCase();
      updateMyBlockCounts();
    } catch (e) {
      toast('Wallet connection failed', 'error');
      return null;
    }
  }
  return state.userSigner;
}

// ============================================================
// TX EXECUTOR (mit Pending-Toast + Status-Check)
// ============================================================
async function executeTx(label, txPromise, { successMsg, onSuccess } = {}) {
  try {
    debug(`${label}: submitting`);
    const tx = await txPromise;
    toast(`${label} submitted...`, 'info', 2000);

    // Timeout nach 90s (Base hat ~2s Blocks, 90s = viel Puffer)
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Transaction timeout (90s)')), 90000)
    );
    const receipt = await Promise.race([tx.wait(), timeout]);

    if (!receipt || receipt.status === 0) {
      throw new Error('Transaction reverted on-chain');
    }

    if (successMsg) toast(successMsg, 'success');
    debug(`${label}: success`, receipt);
    onSuccess?.(receipt);
    return receipt;
  } catch (err) {
    const decoded = decodeError(err);
    toast(decoded.message, 'error', 5000);
    debug(`${label}: failed`, decoded, err);
    throw err;
  }
}

// ============================================================
// CONNECT WALLET (Public)
// ============================================================
window.connectWallet = async () => {
  if (!window.ethereum) return toast('No wallet found. Please install MetaMask.', 'error');
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const p = new ethers.BrowserProvider(window.ethereum);
    state.userSigner = await p.getSigner();
    state.userAddress = (await state.userSigner.getAddress()).toLowerCase();

    const btn = document.getElementById('wallet');
    btn.textContent = state.userAddress.slice(0, 6) + '…' + state.userAddress.slice(-4);
    btn.classList.add('connected');
    updateMyBlockCounts();

    playSound(880, 0.15); haptic([20, 50, 20]);
    toast('Wallet connected ✓', 'success');
    logActivity(`Wallet connected: ${state.userAddress.slice(0, 6)}…`, 'info');

    // Initial sync inkl. Angriffs-Quota
    await forceRefresh(state.userAddress);

    // Wallet-Event-Listener (Account-Change)
    try {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          state.userAddress = null; state.userSigner = null;
          btn.textContent = '🔌 Wallet'; btn.classList.remove('connected');
          toast('Wallet disconnected', 'info');
        } else {
          state.userAddress = accounts[0].toLowerCase();
          state.userSigner = null;
          btn.textContent = state.userAddress.slice(0, 6) + '…' + state.userAddress.slice(-4);
          updateMyBlockCounts();
          loadLive({ force: true, wallet: state.userAddress });
        }
      });
    } catch (e) { debug('accountsChanged listener failed', e); }
  } catch (e) {
    const decoded = decodeError(e);
    toast(decoded.message, 'error');
  }
};

// ============================================================
// MINT (mit Balance-Check)
// ============================================================
window.mintBlock = async (row, col) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);

  // Balance-Check (nur Info, nicht blockierend)
  try {
    const balance = await provider.getBalance(state.userAddress);
    if (balance === 0n) {
      toast('⚠️ No ETH for gas — fund your wallet on Base', 'error', 5000);
      return;
    }
  } catch (e) { debug('Balance check failed', e); }

  const blockId = row * ID_STRIDE + col;
  try {
    await executeTx(
      `Mint #${blockId}`,
      nft.mintWithINPI(row, col),
      {
        successMsg: `Block #${blockId} minted ✓`,
        onSuccess: () => {
          playSound(660, 0.15);
          spawnConfetti(innerWidth/2, innerHeight/2, '#ffcc00');
          logActivity(`Block #${blockId} minted`, 'mint');
          loadLive({ force: true });
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};

// ============================================================
// TOGGLE FARM
// ============================================================
window.toggleFarm = async (id) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);
  const isFarming = farms.has(id);

  try {
    await executeTx(
      isFarming ? `Stop Farming #${id}` : `Start Farming #${id}`,
      isFarming ? c.stopFarming(id) : c.startFarming(id),
      {
        successMsg: isFarming ? 'Farming stopped' : 'Farming started ✓',
        onSuccess: () => {
          if (isFarming) farms.delete(id); else farms.add(id);
          playSound(isFarming ? 400 : 720, 0.12);
          haptic(isFarming ? [10] : [10, 30, 10]);
          logActivity(`Farm ${isFarming ? 'stopped' : 'started'} on #${id}`, 'info');
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};

// ============================================================
// CLAIM RESOURCES (mit Fehlerbehandlung für "already claimed")
// ============================================================
window.claimResources = async (id) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);

  // Pre-Check: Farm attacked?
  if (isFarmAttacked(id)) {
    toast('⚠️ Farm is attacked — reward may be reduced', 'info', 3000);
  }

  try {
    await executeTx(
      `Claim #${id}`,
      c.claimResources(id),
      {
        successMsg: 'Resources claimed ✓',
        onSuccess: () => {
          markFarmClaimed(id);
          playSound(880, 0.15);
          haptic([10, 30, 10]);
          spawnConfetti(innerWidth/2, innerHeight/2, '#00ff88');
          logActivity(`Claimed #${id}`, 'executed');
          forceRefresh(state.userAddress);
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};

// ============================================================
// START ATTACK (mit Max-3-Limit-Check)
// ============================================================
window.startAttackFromSidebar = async (targetId) => {
  const attackerSel = document.getElementById('sbAttackerSelect');
  const resourceSel = document.getElementById('sbResourceSelect');
  if (!attackerSel || !attackerSel.value) return toast('Choose an attacker first!', 'error');
  if (!resourceSel) return toast('Choose a resource!', 'error');

  const attackerId = parseInt(attackerSel.value);
  const resourceId = parseInt(resourceSel.value);

  // PRE-CHECK: Max 3 Attacks pro Wallet/Tag
  if (!canStartAttack(state.userAddress)) {
    toast(`❌ Daily attack limit reached (${MAX_ATTACKS_PER_WALLET}/${MAX_ATTACKS_PER_WALLET})`, 'error', 5000);
    return;
  }

  // PRE-CHECK: Target already under attack?
  if (attacks.has(targetId)) {
    toast('⚠️ Target already under attack', 'error', 4000);
    return;
  }

  // PRE-CHECK: Attacker owned by user?
  const attackerBlock = minted.get(attackerId);
  if (!attackerBlock || attackerBlock.owner !== state.userAddress) {
    toast('❌ You do not own this attacker block', 'error', 4000);
    return;
  }

  state.selectedAttackerId = attackerId;
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);

  try {
    await executeTx(
      `Attack #${attackerId} → #${targetId}`,
      c.startAttack(attackerId, targetId, resourceId),
      {
        successMsg: `⚔ Attack started: #${attackerId} → #${targetId}`,
        onSuccess: () => {
          incrementAttacksUsed(state.userAddress);
          playSound(220, 0.2, 'sawtooth');
          haptic([30, 50, 30]);
          logActivity(`Attack #${attackerId} → #${targetId} (${resourceNames[resourceId]})`, 'attack');

          // Optimistisches UI-Update
          const rc = idToRC(attackerId);
          attacks.set(targetId, {
            attackerTokenId: attackerId, attackerRow: rc.row, attackerCol: rc.col,
            attackIndex: 0, resource: resourceId,
            startTime: performance.now(), interval: 60, endTimestamp: Date.now() + 60000
          });

          setTimeout(() => loadLive({ force: true }), 2500);
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};

// ============================================================
// EXECUTE ATTACK
// ============================================================
window.executeAttack = async (targetId, attackIndex) => {
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
  const atk = attacks.get(targetId);

  try {
    await executeTx(
      `Execute #${targetId}`,
      c.executeAttack(targetId, attackIndex),
      {
        successMsg: '⚔ Attack executed! 💰',
        onSuccess: () => {
          playSound(440, 0.3, 'triangle');
          haptic([50, 30, 50]);
          spawnConfetti(innerWidth/2, innerHeight/2, '#00ff88');
          logActivity(`Attack executed on #${targetId}`, 'executed');

          if (atk) {
            markFarmAttacked(targetId, {
              attackerId: atk.attackerTokenId,
              resource: atk.resource,
              executed: true
            });
            // Trail-Effekt
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
          forceRefresh(state.userAddress);
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};

// ============================================================
// BUY PIRATE BOOST
// ============================================================
window.buyPirateBoost = async () => {
  if (!state.selectedAttackerId) return toast('Choose an attacker first!', 'error');
  const signer = await getSignerOrWarn(); if (!signer) return;
  const c = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);

  try {
    await executeTx(
      'Buy Pirate Boost',
      c.buyPirateBoost(state.selectedAttackerId, 1),
      {
        successMsg: '⚡ Pirate Boost activated!',
        onSuccess: () => {
          playSound(740, 0.15);
          haptic([15, 30, 15]);
          logActivity(`Boost bought for #${state.selectedAttackerId}`, 'info');
        }
      }
    );
  } catch (e) { /* Toast bereits gezeigt */ }
};