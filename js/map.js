// =========================================================
// INPINITY MAP – V6 ONLY
// - FarmingV6 und PiratesV6 als einzige aktive Contracts
// - Subgraph nur für V6 Entities (farmV6S, attackV6S)
// - Preview-Funktionen für alle Aktionen mit stealAmount
// - Fremder Block = Ziel
// - Eigener Block = Angreifer
// =========================================================

import {
    NFT_ADDRESS,
    FARMING_V6_ADDRESS,
    PIRATES_V6_ADDRESS,
    MERCENARY_V2_ADDRESS,
    PARTNERSHIP_V2_ADDRESS,
    RESOURCE_TOKEN_ADDRESS,
    INPI_ADDRESS,
    PITRONE_ADDRESS,
    WORKER_URL,
    MAX_ROW,
    resourceNames,
    rarityNames
  } from "./config.js";
  
  import {
    NFT_ABI,
    FARMING_V6_ABI,
    PIRATES_V6_ABI,
    MERCENARY_V2_ABI,
    PARTNERSHIP_V2_ABI,
    RESOURCE_TOKEN_ABI,
    INPI_ABI,
    PITRONE_ABI
  } from "./abis.js";
  
  import { state } from "./state.js";
  import {
    shortenAddress,
    formatTime,
    formatDuration,
    bn,
    bnGtZero,
    normalizeAttackTuple,
    debugLog,
    byId,
    safeText
  } from "./utils.js";
  
  import {
    ensureBaseNetwork,
    setupContracts,
    connectWalletCore
  } from "./contracts.js";
  
  import {
    fetchAllWithPagination,
    loadMyAttacksV6FromSubgraph,
    buildFarmV6Map,
    buildProtectionMap
  } from "./subgraph.js";
  
  /* ==================== KONSTANTEN ==================== */
  const BASE_BLOCK_SIZE = 24;
  const STORAGE_WALLET_FLAG = "inpinity_wallet_autoreconnect";
  
  /* ==================== STATE ==================== */
  let provider, signer, userAddress = null;
  let readOnlyProvider, nftReadOnlyContract;
  
  let tokens = {};
  let userResources = [];
  let selectedTokenId = null;
  let selectedTokenOwner = null;
  
  let userAttacks = [];
  let attacksTicker = null;
  let attacksPoller = null;
  let dataPoller = null;
  let isConnecting = false;
  
  let nftContract, farmingV6Contract, piratesV6Contract, mercenaryV2Contract, partnershipV2Contract;
  let inpiContract, pitroneContract, resourceTokenContract;
  
  const canvas = document.getElementById("pyramidCanvas");
  const ctx = canvas?.getContext("2d");
  const container = document.getElementById("canvasContainer");
  const tooltip = document.getElementById("tooltip");
  
  const blockDetailDiv = document.getElementById("blockDetail");
  const actionPanel = document.getElementById("actionPanel");
  const ownerActionsDiv = document.getElementById("ownerActions");
  const protectionInput = document.getElementById("protectionInput");
  const attackInput = document.getElementById("attackInput");
  const actionMessage = document.getElementById("actionMessage");
  const userResourcesDiv = document.getElementById("userResources");
  
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let pinchStartDist = 0;
  
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  const MOVE_THRESHOLD = 10;
  
  const rarityClass = ["rarity-bronze", "rarity-silver", "rarity-gold", "rarity-platinum", "rarity-diamond"];
  const rarityColors = ["#cd7f32", "#c0c0c0", "#ffd700", "#e5e4e2", "#b9f2ff"];
  
  /* ==================== HELPER ==================== */
  function populateAttackResourceSelect(resourceIds = null, selectedValue = null) {
    const select = document.getElementById("attackResource");
    if (!select) return;
  
    select.innerHTML = "";
  
    const ids = Array.isArray(resourceIds)
      ? resourceIds
      : resourceNames.map((_, i) => i);
  
    if (ids.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No loot available";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      select.disabled = true;
      return;
    }
  
    select.disabled = false;
  
    ids.forEach((id, idx) => {
      const option = document.createElement("option");
      option.value = String(id);
      option.textContent = resourceNames[id] || `Resource ${id}`;
      if (selectedValue !== null && Number(selectedValue) === Number(id)) {
        option.selected = true;
      } else if (selectedValue === null && idx === 0) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }
  
  async function getAttackableResourceIds(attackerTokenId, targetTokenId) {
    if (!piratesV6Contract) return [];
  
    try {
      const ids = [];
  
      for (let i = 0; i < resourceNames.length; i++) {
        try {
          const preview = await piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, i);
          if (preview && preview.allowed) {
            ids.push(i);
          }
        } catch (err) {
          console.warn(`previewAttack failed for resource ${i}`, err);
        }
      }
  
      return ids;
    } catch (e) {
      console.warn("getAttackableResourceIds failed", e);
      return [];
    }
  }
  
  function getAttackStorageKey(targetTokenId) {
    return `attack_${targetTokenId}`;
  }
  
  function isGtZero(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "bigint") return value > 0n;
    if (typeof value === "number") return value > 0;
    try {
      return BigInt(value.toString()) > 0n;
    } catch {
      return false;
    }
  }
  
  function isOwnToken(tokenId) {
    const token = tokens[String(tokenId)];
    return !!(
      userAddress &&
      token &&
      token.owner &&
      token.owner.toLowerCase() === userAddress.toLowerCase()
    );
  }
  
  function isForeignToken(tokenId) {
    const token = tokens[String(tokenId)];
    return !!(
      userAddress &&
      token &&
      token.owner &&
      token.owner.toLowerCase() !== userAddress.toLowerCase()
    );
  }
  
  async function getPreferredAttackerTokenId() {
    if (!userAddress) return null;
  
    if (selectedTokenId && isOwnToken(selectedTokenId)) {
      return parseInt(selectedTokenId, 10);
    }
  
    const ownTokens = Object.entries(tokens).filter(([_, t]) =>
      t.owner && t.owner.toLowerCase() === userAddress.toLowerCase()
    );
  
    if (ownTokens.length === 0) return null;
    return parseInt(ownTokens[0][0], 10);
  }
  
  function getProduction(rarity) {
    const production = {};
  
    if (rarity === 0) {
      production.OIL = 12;
      production.LEMONS = 8;
      production.IRON = 5;
      production.COPPER = 1;
    } else if (rarity === 1) {
      production.OIL = 14;
      production.LEMONS = 10;
      production.IRON = 7;
      production.GOLD = 1;
      production.COPPER = 2;
    } else if (rarity === 2) {
      production.OIL = 16;
      production.LEMONS = 12;
      production.IRON = 9;
      production.GOLD = 2;
      production.PLATINUM = 1;
      production.COPPER = 3;
      production.CRYSTAL = 1;
    } else if (rarity === 3) {
      production.OIL = 18;
      production.LEMONS = 14;
      production.IRON = 11;
      production.GOLD = 3;
      production.PLATINUM = 2;
      production.COPPER = 4;
      production.CRYSTAL = 2;
      production.MYSTERIUM = 1;
    } else if (rarity === 4) {
      production.OIL = 20;
      production.LEMONS = 15;
      production.IRON = 12;
      production.GOLD = 5;
      production.PLATINUM = 3;
      production.COPPER = 5;
      production.CRYSTAL = 3;
      production.OBSIDIAN = 1;
      production.MYSTERIUM = 1;
      production.AETHER = 1;
    } else {
      production.OIL = 22;
      production.LEMONS = 16;
      production.IRON = 14;
      production.GOLD = 7;
      production.PLATINUM = 5;
      production.COPPER = 6;
      production.CRYSTAL = 5;
      production.OBSIDIAN = 2;
      production.MYSTERIUM = 2;
      production.AETHER = 2;
    }
  
    return production;
  }
  
  /* ==================== SAFE CONTRACT READS ==================== */
  async function safeGetFarm(tokenId) {
    try {
      const f = await farmingV6Contract.getFarmState(tokenId);
      return {
        ok: true,
        startTime: Number(f.startTime ?? 0),
        lastAccrualTime: Number(f.lastAccrualTime ?? 0),
        lastClaimTime: Number(f.lastClaimTime ?? 0),
        boostExpiry: Number(f.boostExpiry ?? 0),
        stopTime: Number(f.stopTime ?? 0),
        isActive: !!f.isActive
      };
    } catch (e) {
      console.warn(`getFarmState() failed for token ${tokenId}`, e);
      return {
        ok: false,
        startTime: 0,
        lastAccrualTime: 0,
        lastClaimTime: 0,
        boostExpiry: 0,
        stopTime: 0,
        isActive: false
      };
    }
  }
  
  async function safeGetAllPending(tokenId) {
    try {
      const pending = await farmingV6Contract.getAllPending(tokenId);
      return { ok: true, pending, reason: "ok" };
    } catch (e) {
      console.warn(`getAllPending failed for token ${tokenId}`, e);
      return { ok: false, pending: null, reason: "pending-failed" };
    }
  }
  
  /* ==================== ATTACKS ==================== */
  async function loadUserAttacks() {
    if (!userAddress) return;
  
    try {
      const where = `{ attacker: "${userAddress.toLowerCase()}" }`;
      const attacks = await fetchAllWithPagination(
        "attackV6S",
        "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed cancelled protectionLevel effectiveStealPercent stolenAmount",
        where
      );
  
      const dismissed = loadDismissedAttacks();
  
      userAttacks = attacks
        .map(a => ({
          id: a.id,
          targetTokenId: parseInt(a.targetTokenId, 10),
          attackerTokenId: parseInt(a.attackerTokenId, 10),
          attackIndex: parseInt(a.attackIndex, 10),
          startTime: parseInt(a.startTime, 10),
          endTime: parseInt(a.endTime, 10),
          executed: !!a.executed,
          cancelled: !!a.cancelled,
          resource: parseInt(a.resource, 10),
          protectionLevel: a.protectionLevel ? parseInt(a.protectionLevel, 10) : 0,
          effectiveStealPercent: a.effectiveStealPercent ? parseInt(a.effectiveStealPercent, 10) : 0,
          stolenAmount: a.stolenAmount ? a.stolenAmount.toString() : "0"
        }))
        .filter(a => !a.executed && !a.cancelled && !dismissed.has(a.id));
  
      displayUserAttacks();
      drawPyramid();
      startAttacksTicker();
    } catch (e) {
      console.error("Failed to load attacks:", e);
    }
  }
  
  function displayUserAttacks() {
    const container = document.getElementById("userAttacksList");
    if (!container) return;
  
    if (!userAddress) {
      container.innerHTML = '<p style="color:#98a9b9;">Connect wallet</p>';
      return;
    }
  
    if (userAttacks.length === 0) {
      container.innerHTML = '<p style="color:#98a9b9;">No active attacks</p>';
      return;
    }
  
    const now = Math.floor(Date.now() / 1000);
    let html = "";
  
    userAttacks.forEach(attack => {
      const timeLeft = attack.endTime - now;
      const ready = timeLeft <= 0;
  
      html += `
        <div class="attack-item">
          <span>#${attack.targetTokenId} (${resourceNames[attack.resource]})</span>
          <span class="attack-status" data-endtime="${attack.endTime}" style="${ready ? "color:#51cf66;" : ""}">
            ${ready ? "Ready" : "⏳ " + formatTime(timeLeft)}
          </span>
          <div class="attack-actions">
            <button
              class="execute-btn"
              data-attackid="${attack.id}"
              data-targetid="${attack.targetTokenId}"
              data-attackindex="${attack.attackIndex}"
              data-resource="${attack.resource}"
              ${ready ? "" : "disabled"}
            >${ready ? "⚔️" : "⏳"}</button>
            <button
              class="cancel-attack-btn"
              data-targetid="${attack.targetTokenId}"
              data-attackindex="${attack.attackIndex}"
              title="Cancel attack"
            >✖️</button>
          </div>
        </div>
      `;
    });
  
    container.innerHTML = html;
  
    container.querySelectorAll(".execute-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const attackId = btn.dataset.attackid;
        const targetTokenId = parseInt(btn.dataset.targetid, 10);
        const attackIndex = parseInt(btn.dataset.attackindex, 10);
        const resource = parseInt(btn.dataset.resource, 10);
        await executeAttack({ id: attackId, targetTokenId, attackIndex, resource });
      });
    });
  
    container.querySelectorAll(".cancel-attack-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetTokenId = parseInt(btn.dataset.targetid, 10);
        const attackIndex = parseInt(btn.dataset.attackindex, 10);
        await cancelAttack(targetTokenId, attackIndex);
      });
    });
  }
  
  function startAttacksTicker() {
    if (attacksTicker) return;
  
    attacksTicker = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
  
      document.querySelectorAll(".attack-status").forEach(el => {
        const endTime = parseInt(el.dataset.endtime || "0", 10);
        if (!endTime) return;
        const timeLeft = endTime - now;
        if (timeLeft <= 0) {
          el.textContent = "Ready";
          el.style.color = "#51cf66";
        } else {
          el.textContent = "⏳ " + formatTime(timeLeft);
          el.style.color = "";
        }
      });
  
      document.querySelectorAll(".execute-btn").forEach(btn => {
        const endTimeEl = btn.parentElement?.parentElement?.querySelector(".attack-status");
        const endTime = endTimeEl ? parseInt(endTimeEl.dataset.endtime || "0", 10) : 0;
        const timeLeft = endTime - now;
  
        if (timeLeft <= 0) {
          btn.disabled = false;
          btn.textContent = "⚔️";
        } else {
          btn.disabled = true;
          btn.textContent = "⏳";
        }
      });
  
      drawPyramid();
    }, 1000);
  }
  
  function dismissAttackById(attackId) {
    const key = "dismissedAttacks";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    if (!arr.includes(attackId)) arr.push(attackId);
    localStorage.setItem(key, JSON.stringify(arr));
  }
  
  function loadDismissedAttacks() {
    return new Set(JSON.parse(localStorage.getItem("dismissedAttacks") || "[]"));
  }
  
  async function executeAttack(attack) {
    const msgDiv = actionMessage;
    if (!msgDiv) return;
  
    msgDiv.innerHTML = '<span class="success">⏳ Checking attack...</span>';
  
    try {
      if (!piratesV6Contract) throw new Error("Connect wallet first.");
  
      // On-chain Status vor Ausführung prüfen
      const liveAttack = await piratesV6Contract.getAttack(attack.targetTokenId, attack.attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
      const now = Math.floor(Date.now() / 1000);
  
      if (normalized.executed) {
        msgDiv.innerHTML = `<span class="error">❌ Attack already executed.</span>`;
        if (attack.id) dismissAttackById(attack.id);
        await loadUserAttacks();
        return;
      }
  
      if (normalized.cancelled) {
        msgDiv.innerHTML = `<span class="error">❌ Attack was cancelled.</span>`;
        if (attack.id) dismissAttackById(attack.id);
        await loadUserAttacks();
        return;
      }
  
      if (normalized.endTime > now) {
        msgDiv.innerHTML = `<span class="error">❌ Attack not ready yet. Wait ${formatDuration(normalized.endTime - now)}.</span>`;
        return;
      }
  
      const preview = await piratesV6Contract.previewExecuteAttack(
        attack.targetTokenId,
        attack.attackIndex
      );
  
      if (!preview.allowed) {
        msgDiv.innerHTML = `<span class="error">❌ Execute not allowed. Code: ${preview.code}</span>`;
        return;
      }
  
      msgDiv.innerHTML = '<span class="success">⏳ Executing attack...</span>';
  
      const tx = await piratesV6Contract.executeAttack(
        attack.targetTokenId,
        attack.attackIndex,
        { gasLimit: 350000 }
      );
  
      msgDiv.innerHTML = '<span class="success">⏳ Confirming...</span>';
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`;
  
      localStorage.removeItem(getAttackStorageKey(attack.targetTokenId));
      if (attack.id) dismissAttackById(attack.id);
  
      await loadUserAttacks();
      await loadUserResources();
      await loadData();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (e) {
      console.error("executeAttack error:", e);
      const msg = e?.reason || e?.message || "Unknown error";
      msgDiv.innerHTML = `<span class="error">❌ ${msg}</span>`;
    }
  }
  
  async function cancelAttack(targetTokenId, attackIndex) {
    const msgDiv = actionMessage;
    if (!msgDiv) return;
  
    try {
      const liveAttack = await piratesV6Contract.getAttack(targetTokenId, attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
  
      if (normalized.attacker.toLowerCase() !== userAddress.toLowerCase()) {
        msgDiv.innerHTML = `<span class="error">❌ Not your attack to cancel.</span>`;
        return;
      }
  
      if (normalized.executed) {
        msgDiv.innerHTML = `<span class="error">❌ Cannot cancel executed attack.</span>`;
        return;
      }
  
      if (normalized.cancelled) {
        msgDiv.innerHTML = `<span class="error">❌ Attack already cancelled.</span>`;
        return;
      }
  
      msgDiv.innerHTML = '<span class="success">⏳ Cancelling attack...</span>';
  
      const tx = await piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, { gasLimit: 300000 });
      await tx.wait();
  
      msgDiv.innerHTML = '<span class="success">✅ Attack cancelled.</span>';
      await loadUserAttacks();
      await loadData();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (e) {
      console.error("cancelAttack error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== MAP DATA ==================== */
  async function loadData() {
    try {
      const tokenItems = await fetchAllWithPagination(
        "tokens",
        "id owner { id } revealed"
      ).catch(() => []);
  
      tokens = {};
      tokenItems.forEach(t => {
        tokens[t.id] = {
          owner: t.owner ? t.owner.id : null,
          revealed: !!t.revealed,
          farmActive: false,
          protectionActive: false,
          partnerActive: false,
          rarity: null,
          farmStartTime: 0,
          lastClaimTime: 0,
          boostExpiry: 0
        };
      });
  
      const blockRevealedItems = await fetchAllWithPagination(
        "blockRevealeds",
        "tokenId rarity"
      ).catch(() => []);
  
      blockRevealedItems.forEach(br => {
        const tokenId = br.tokenId;
        if (tokens[tokenId]) {
          tokens[tokenId].rarity = parseInt(br.rarity, 10);
        }
      });
  
      const farmV6Items = await fetchAllWithPagination(
        "farmV6S",
        "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
        `{ active: true }`
      ).catch(() => []);
  
      farmV6Items.forEach(f => {
        if (tokens[f.id]) {
          tokens[f.id].farmActive = !!f.active;
          tokens[f.id].farmStartTime = parseInt(f.startTime, 10) || 0;
          tokens[f.id].lastClaimTime = parseInt(f.lastClaimTime, 10) || 0;
          tokens[f.id].boostExpiry = parseInt(f.boostExpiry, 10) || 0;
        }
      });
  
      const protectionItems = await fetchAllWithPagination(
        "protections",
        "id active",
        `{ active: true }`
      ).catch(() => []);
  
      protectionItems.forEach(p => {
        if (tokens[p.id]) tokens[p.id].protectionActive = !!p.active;
      });
  
      const partnerItems = await fetchAllWithPagination(
        "partnerships",
        "id active",
        `{ active: true }`
      ).catch(() => []);
  
      partnerItems.forEach(p => {
        if (tokens[p.id]) tokens[p.id].partnerActive = !!p.active;
      });
  
      drawPyramid();
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    }
  }
  
  /* ==================== RESOURCES ==================== */
  async function loadUserResources() {
    if (!userAddress) return;
    await loadUserResourcesOnChain();
  }
  
  async function loadUserResourcesOnChain() {
    if (!userAddress || !resourceTokenContract) return;
  
    try {
      const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const accounts = ids.map(() => userAddress);
      const balances = await resourceTokenContract.balanceOfBatch(accounts, ids);
  
      userResources = ids
        .map((id, idx) => ({
          resourceId: id,
          amount: balances[idx]
        }))
        .filter(r => isGtZero(r.amount));
  
      updateUserResourcesDisplay();
    } catch (err) {
      console.error("On-chain resource fetch failed:", err);
      userResources = [];
      updateUserResourcesDisplay();
    }
  }
  
  function updateUserResourcesDisplay() {
    if (!userResourcesDiv) return;
  
    if (!userAddress) {
      userResourcesDiv.innerHTML = '<p style="color:#98a9b9;">Connect wallet</p>';
      return;
    }
  
    if (!userResources || userResources.length === 0) {
      userResourcesDiv.innerHTML = '<p style="color:#98a9b9;">No resources</p>';
      return;
    }
  
    userResources.sort((a, b) => a.resourceId - b.resourceId);
  
    let html = "";
    for (const r of userResources) {
      const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
      const imgUrl = `https://inpinity.online/img/${r.resourceId}.PNG`;
      html += `
        <div class="resource-row">
          <img src="${imgUrl}" alt="${name}" class="resource-icon" onerror="this.style.display='none'">
          <span class="resource-name">${name}</span>
          <span class="resource-amount">${r.amount.toString()}</span>
        </div>
      `;
    }
  
    userResourcesDiv.innerHTML = html;
  }
  
  /* ==================== DRAW ==================== */
  function drawPyramid() {
    if (!canvas || !ctx) return;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
  
    const blockSize = BASE_BLOCK_SIZE;
    const now = Math.floor(Date.now() / 1000);
  
    for (let row = 0; row < 100; row++) {
      const blocksInRow = 2 * row + 1;
      const y = row * blockSize;
  
      for (let col = 0; col < blocksInRow; col++) {
        const tokenIdNum = row * 2048 + col;
        const tokenId = String(tokenIdNum);
        const token = tokens[tokenId];
        const x = (col - row) * blockSize;
  
        let fillColor = "#3a4048";
        let strokeColor = null;
        let lineWidth = 0;
  
        if (token && token.owner) {
          if (token.revealed && token.rarity !== null && token.rarity >= 0 && token.rarity <= 4) {
            fillColor = rarityColors[token.rarity];
          } else {
            fillColor = token.revealed ? "#c9a959" : "#2e7d5e";
          }
  
          if (userAddress && token.owner.toLowerCase() === userAddress.toLowerCase()) {
            fillColor = "#9b59b6";
          }
  
          const attack = userAttacks.find(a => String(a.targetTokenId) === tokenId);
          if (attack) {
            if (attack.endTime <= now) {
              strokeColor = "#e74c3c";
              lineWidth = 4;
            } else {
              strokeColor = "#000000";
              lineWidth = 4;
            }
          } else {
            if (token.protectionActive) {
              strokeColor = "#9b59b6";
              lineWidth = 3;
            } else if (token.farmActive) {
              strokeColor = "#3498db";
              lineWidth = 3;
            }
          }
        }
  
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, blockSize, blockSize);
  
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.strokeRect(x, y, blockSize, blockSize);
        }
  
        if (token && token.partnerActive) {
          ctx.save();
          ctx.translate(x + blockSize - 8, y + 8);
          ctx.font = 'bold 16px "Inter", sans-serif';
          ctx.fillStyle = "#FFD700";
          ctx.shadowColor = "#000";
          ctx.shadowBlur = 4;
          ctx.fillText("★", -8, 4);
          ctx.restore();
        }
      }
    }
  
    ctx.restore();
  }
  
  function centerPyramid() {
    const totalWidth = 199 * BASE_BLOCK_SIZE;
    const totalHeight = 100 * BASE_BLOCK_SIZE;
    const scaleX = (canvas.width / totalWidth) * 0.95;
    const scaleY = (canvas.height / totalHeight) * 0.95;
    scale = Math.min(scaleX, scaleY, 1.5);
    offsetX = (canvas.width - totalWidth * scale) / 2;
    offsetY = (canvas.height - totalHeight * scale) / 2;
    drawPyramid();
  }
  
  /* ==================== ATTACK PREVIEW ==================== */
  async function loadAttackPreview(attackerTokenId, targetTokenId, resourceId) {
    try {
      return await piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resourceId);
    } catch (e) {
      console.warn("previewAttack failed", e);
      return null;
    }
  }
  
  async function refreshSelectedTargetAttackPreview() {
    const attackerBlockEl = document.getElementById("attackAttackerBlock");
    const targetStatusEl = document.getElementById("attackTargetStatus");
    const travelTimeEl = document.getElementById("attackTravelTime");
    const remainingEl = document.getElementById("attackRemainingToday");
    const pendingLootEl = document.getElementById("attackPendingLoot");
    const stealAmountEl = document.getElementById("attackStealAmount");
    const protectionEl = document.getElementById("attackProtection");
    const stealPercentEl = document.getElementById("attackStealPercent");
    const attackResourceEl = document.getElementById("attackResource");
    const attackBtn = document.getElementById("attackBtn");
  
    if (!selectedTokenId || !userAddress || !isForeignToken(selectedTokenId)) {
      if (attackInput) attackInput.style.display = "none";
      return;
    }
  
    if (attackInput) attackInput.style.display = "flex";
  
    const attackerTokenId = await getPreferredAttackerTokenId();
    if (!attackerTokenId) {
      if (attackerBlockEl) attackerBlockEl.innerText = "—";
      if (targetStatusEl) targetStatusEl.innerText = "❌ No attacker block";
      if (travelTimeEl) travelTimeEl.innerText = "—";
      if (remainingEl) remainingEl.innerText = "—";
      if (pendingLootEl) pendingLootEl.innerText = "—";
      if (stealAmountEl) stealAmountEl.innerText = "—";
      if (protectionEl) protectionEl.innerText = "—";
      if (stealPercentEl) stealPercentEl.innerText = "—";
      populateAttackResourceSelect([]);
      if (attackBtn) attackBtn.disabled = true;
      return;
    }
  
    if (attackerBlockEl) attackerBlockEl.innerText = `#${attackerTokenId}`;
  
    const targetTokenIdNum = parseInt(selectedTokenId, 10);
  
    // echte pending Ressourcen holen
    const lootableIds = await getAttackableResourceIds(attackerTokenId, targetTokenIdNum);
  
    // aktuell ausgewählten Wert merken
    let selectedResourceId = attackResourceEl?.value ?? null;
    if (
      selectedResourceId === null ||
      selectedResourceId === "" ||
      !lootableIds.includes(Number(selectedResourceId))
    ) {
      selectedResourceId = lootableIds.length > 0 ? lootableIds[0] : null;
    }
  
    // Dropdown dynamisch nur mit lootbaren Ressourcen füllen
    populateAttackResourceSelect(lootableIds, selectedResourceId);
  
    if (!lootableIds.length) {
      if (targetStatusEl) targetStatusEl.innerText = "⚠️ No loot available";
      if (travelTimeEl) travelTimeEl.innerText = "—";
      if (remainingEl) remainingEl.innerText = "—";
      if (pendingLootEl) pendingLootEl.innerText = "0";
      if (stealAmountEl) stealAmountEl.innerText = "—";
      if (protectionEl) protectionEl.innerText = "—";
      if (stealPercentEl) stealPercentEl.innerText = "—";
      if (attackBtn) attackBtn.disabled = true;
      return;
    }
  
    const resourceId = parseInt(document.getElementById("attackResource")?.value || "0", 10);
  
    const preview = await loadAttackPreview(attackerTokenId, targetTokenIdNum, resourceId);
    if (!preview) {
      if (targetStatusEl) targetStatusEl.innerText = "⚠️ Preview failed";
      if (travelTimeEl) travelTimeEl.innerText = "—";
      if (remainingEl) remainingEl.innerText = "—";
      if (pendingLootEl) pendingLootEl.innerText = "—";
      if (stealAmountEl) stealAmountEl.innerText = "—";
      if (protectionEl) protectionEl.innerText = "—";
      if (stealPercentEl) stealPercentEl.innerText = "—";
      if (attackBtn) attackBtn.disabled = true;
      return;
    }
  
    if (targetStatusEl) {
      if (preview.allowed) {
        targetStatusEl.innerText = "✅ Attack allowed";
      } else if (Number(preview.pendingAmount || 0) === 0) {
        targetStatusEl.innerText = "⚠️ No loot available";
      } else {
        targetStatusEl.innerText = `❌ Blocked (Code ${preview.code})`;
      }
    }
  
    if (travelTimeEl) travelTimeEl.innerText = formatDuration(Number(preview.travelTime || 0));
    if (remainingEl) remainingEl.innerText = String(Number(preview.remainingAttacksToday || 0));
    if (pendingLootEl) pendingLootEl.innerText = (preview.pendingAmount || 0).toString();
    if (stealAmountEl) stealAmountEl.innerText = (preview.stealAmount || 0).toString();
    if (protectionEl) protectionEl.innerText = `${Number(preview.protectionLevel || 0)}%`;
    if (stealPercentEl) stealPercentEl.innerText = `${Number(preview.effectiveStealPercent || 0)}%`;
    if (attackBtn) attackBtn.disabled = !preview.allowed;
  }
  
  /* ==================== SIDEBAR ==================== */
  async function updateSidebar(tokenId) {
    selectedTokenId = tokenId;
    const token = tokens[tokenId];
    const owner = token ? token.owner : null;
    selectedTokenOwner = owner;
  
    const now = Math.floor(Date.now() / 1000);
    let v6Active = false;
    let farmStartTime = 0;
    let farmAgeTxt = "-";
    let claimTxt = "-";
    let pendingTotalTxt = "-";
    let boostTxt = "-";
  
    if (farmingV6Contract && token && token.owner) {
      const farmInfo = await safeGetFarm(tokenId);
      v6Active = farmInfo.ok && farmInfo.isActive;
      farmStartTime = farmInfo.startTime || 0;
  
      if (v6Active && farmStartTime > 0) {
        farmAgeTxt = formatDuration(now - farmStartTime);
      }
  
      try {
        const preview = await farmingV6Contract.previewClaim(tokenId);
        pendingTotalTxt = preview.pendingAmount ? preview.pendingAmount.toString() : "0";
        claimTxt = preview.allowed
          ? "READY"
          : (Number(preview.secondsRemaining || 0) > 0
              ? `in ${formatDuration(Number(preview.secondsRemaining))}`
              : "Not ready");
      } catch (e) {
        console.warn("previewClaim failed", e);
      }
  
      if (farmInfo.boostExpiry && farmInfo.boostExpiry > now) {
        boostTxt = "active";
      }
    }
  
    let productionHtml = "";
    let rarityDisplay = "";
  
    if (token && token.owner && token.revealed && nftReadOnlyContract) {
      try {
        const tokenIdNum = parseInt(tokenId, 10);
        const row = Math.floor(tokenIdNum / 2048);
        const rarity = token.rarity !== null ? token.rarity : await nftReadOnlyContract.calculateRarity(tokenIdNum);
        const r = Number(rarity);
  
        rarityDisplay = `<div class="detail-row"><span class="detail-label">Rarity</span><span class="detail-value ${rarityClass[r]}">${rarityNames[r]}</span></div>`;
  
        const production = getProduction(r);
        let prodText = "";
        for (const [res, amount] of Object.entries(production)) {
          prodText += `<div class="detail-row"><span class="detail-label">${res}</span><span class="detail-value">${amount}/d</span></div>`;
        }
        productionHtml = `<div class="detail-row"><span class="detail-label">Production</span></div>${prodText}`;
      } catch (_) { }
    }
  
    let detailHtml = "";
    if (token && owner) {
      detailHtml = `
        <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${tokenId}</span></div>
        <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value">${shortenAddress(owner)}</span></div>
        <div class="detail-row"><span class="detail-label">Revealed</span><span class="detail-value">${token.revealed ? "✅" : "❌"}</span></div>
        ${rarityDisplay}
        <div class="detail-row"><span class="detail-label">Farming (V6)</span><span class="detail-value">${v6Active ? "Active" : "Inactive"}</span></div>
        <div class="detail-row"><span class="detail-label">Farm age</span><span class="detail-value">${farmAgeTxt}</span></div>
        <div class="detail-row"><span class="detail-label">Boost</span><span class="detail-value">${boostTxt}</span></div>
        <div class="detail-row"><span class="detail-label">Claim-ready</span><span class="detail-value">${claimTxt}</span></div>
        <div class="detail-row"><span class="detail-label">Pending</span><span class="detail-value">${pendingTotalTxt}</span></div>
        ${productionHtml}
      `;
    } else {
      detailHtml = `<p style="color:#98a9b9;">Block #${tokenId} not minted</p>`;
    }
  
    if (blockDetailDiv) blockDetailDiv.innerHTML = detailHtml;
    if (actionPanel) actionPanel.style.display = "block";
    if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
    if (protectionInput) protectionInput.style.display = "none";
    if (attackInput) attackInput.style.display = "none";
    if (actionMessage) actionMessage.innerHTML = "";
  
    if (userAddress && owner && owner.toLowerCase() !== userAddress.toLowerCase()) {
      await refreshSelectedTargetAttackPreview();
    } else if (userAddress && owner && owner.toLowerCase() === userAddress.toLowerCase()) {
      let btns = "";
      if (!token.revealed) btns += `<button class="action-btn" id="revealBtn">🔓 Reveal</button>`;
      if (!v6Active) btns += `<button class="action-btn" id="startFarmBtn">🌾 Start Farming (V6)</button>`;
      else {
        btns += `<button class="action-btn" id="stopFarmBtn">⏹️ Stop</button>`;
        btns += `<button class="action-btn" id="claimBtn">💰 Claim</button>`;
        btns += `<button class="action-btn boost-btn" id="buyBoostBtn">⚡ Buy Boost</button>`;
      }
      if (protectionInput) protectionInput.style.display = "flex";
      if (ownerActionsDiv) ownerActionsDiv.innerHTML = btns;
    } else {
      if (actionPanel) actionPanel.style.display = "none";
    }
  }
  
  /* ==================== TX HELPER ==================== */
  async function sendTx(txPromise, messageDiv, successMsg) {
    if (messageDiv) messageDiv.innerHTML = '<span class="success">⏳ Sending...</span>';
    try {
      const tx = await txPromise;
      if (messageDiv) messageDiv.innerHTML = '<span class="success">⏳ Confirming...</span>';
      await tx.wait();
      if (messageDiv) messageDiv.innerHTML = `<span class="success">✅ ${successMsg}</span>`;
      await loadData();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (err) {
      console.error(err);
      if (messageDiv) messageDiv.innerHTML = `<span class="error">❌ ${err.message || "Tx failed"}</span>`;
    }
  }
  
  /* ==================== ACTIONS ==================== */
  async function handleReveal() {
    if (!selectedTokenId || !selectedTokenOwner) return;
  
    const tokenIdNum = parseInt(selectedTokenId, 10);
    const row = Math.floor(tokenIdNum / 2048);
    const col = tokenIdNum % 2048;
  
    try {
      const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
      if (!response.ok) throw new Error("Proofs not found");
      const proofs = await response.json();
  
      const formatProof = (arr) => arr.map(item => {
        const v = (item.left ? item.left : item.right);
        return (v || "").startsWith("0x") ? v : ("0x" + v);
      });
  
      const piProof = formatProof(proofs.pi.proof);
      const phiProof = formatProof(proofs.phi.proof);
  
      await sendTx(
        nftContract.revealBlock(selectedTokenId, piProof, phiProof, proofs.pi.digit, proofs.phi.digit, { gasLimit: 500000 }),
        actionMessage,
        "Block revealed!"
      );
    } catch (e) {
      if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
  }
  
  async function handleStartFarm() {
    if (!selectedTokenId) return;
    await sendTx(
      farmingV6Contract.startFarming(selectedTokenId, { gasLimit: 500000 }),
      actionMessage,
      "Farming started."
    );
  }
  
  async function handleStopFarm() {
    if (!selectedTokenId) return;
    await sendTx(
      farmingV6Contract.stopFarming(selectedTokenId, { gasLimit: 500000 }),
      actionMessage,
      "Farming stopped."
    );
  }
  
  async function handleClaim() {
    if (!selectedTokenId) return;
  
    try {
      const preview = await farmingV6Contract.previewClaim(selectedTokenId);
  
      if (!preview.allowed) {
        actionMessage.innerHTML = `<span class="error">❌ Claim not ready. Code: ${preview.code}</span>`;
        return;
      }
  
      await sendTx(
        farmingV6Contract.claimResources(selectedTokenId, { gasLimit: 600000 }),
        actionMessage,
        "Resources claimed!"
      );
  
      await loadUserResources();
    } catch (e) {
      actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
  }
  
  async function handleBuyBoost() {
    if (!selectedTokenId) return;
  
    const days = parseInt(document.getElementById("boostDays")?.value, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      alert("Please enter valid days (1-30)");
      return;
    }
  
    await sendTx(
      farmingV6Contract.buyBoost(selectedTokenId, days, { gasLimit: 300000 }),
      actionMessage,
      `Boost activated for ${days} days!`
    );
  }
  
  async function handleProtect() {
    if (!selectedTokenId || !userAddress) return;
  
    const level = parseInt(document.getElementById("protectLevel")?.value, 10);
    if (!Number.isFinite(level) || level < 0 || level > 50) {
      return alert("Invalid level (0-50)");
    }
  
    try {
      const cost = level * 10;
      const amount = ethers.parseEther(String(cost));
      const allowance = await inpiContract.allowance(userAddress, MERCENARY_V2_ADDRESS);
  
      if (allowance < amount) {
        if (actionMessage) actionMessage.innerHTML = '<span class="success">⏳ Approving...</span>';
        const approveTx = await inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
        await approveTx.wait();
      }
  
      await sendTx(
        mercenaryV2Contract.hireMercenaries(selectedTokenId, level, { gasLimit: 400000 }),
        actionMessage,
        "Protection bought!"
      );
    } catch (e) {
      if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
  }
  
  async function handleAttack() {
    if (!selectedTokenId || !userAddress) return;
  
    const targetToken = tokens[selectedTokenId];
    if (!targetToken || !targetToken.owner) {
      actionMessage.innerHTML = '<span class="error">❌ Target block does not exist.</span>';
      return;
    }
  
    if (targetToken.owner.toLowerCase() === userAddress.toLowerCase()) {
      actionMessage.innerHTML = '<span class="error">❌ You cannot attack your own block.</span>';
      return;
    }
  
    const attackerTokenId = await getPreferredAttackerTokenId();
    if (!attackerTokenId) {
      actionMessage.innerHTML = '<span class="error">❌ Need your own block to attack from.</span>';
      return;
    }
  
    const targetTokenIdNum = parseInt(selectedTokenId, 10);
    const resource = parseInt(document.getElementById("attackResource")?.value || "0", 10);
  
    if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
      actionMessage.innerHTML = '<span class="error">❌ Invalid resource selected.</span>';
      return;
    }
  
    try {
      const preview = await piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resource);
  
      if (!preview.allowed) {
        actionMessage.innerHTML = `<span class="error">❌ Attack not allowed. Code: ${preview.code}</span>`;
        await refreshSelectedTargetAttackPreview();
        return;
      }
  
      actionMessage.innerHTML = `
        <span class="success">
          ⏳ Starting attack...<br>
          Travel time: ${formatDuration(Number(preview.travelTime || 0))}<br>
          Steal amount: ${(preview.stealAmount || 0).toString()}<br>
          Remaining today: ${Number(preview.remainingAttacksToday || 0)}
        </span>
      `;
  
      const tx = await piratesV6Contract.startAttack(
        attackerTokenId,
        targetTokenIdNum,
        resource,
        { gasLimit: 450000 }
      );
  
      await tx.wait();
  
      actionMessage.innerHTML = '<span class="success">✅ Attack launched!</span>';
  
      localStorage.setItem(getAttackStorageKey(targetTokenIdNum), JSON.stringify({
        targetTokenId: targetTokenIdNum,
        attackerTokenId,
        resource,
        startTime: Math.floor(Date.now() / 1000)
      }));
  
      await loadUserAttacks();
      await loadData();
      await refreshSelectedTargetAttackPreview();
    } catch (e) {
      console.error("handleAttack error:", e);
      actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== WALLET ==================== */
  async function connectWallet() {
    if (!window.ethereum) return alert("Please install MetaMask!");
    if (isConnecting) return;
    if (userAddress) return;
  
    isConnecting = true;
  
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      userAddress = await signer.getAddress();
  
      const network = await provider.getNetwork();
      if (network.chainId !== 8453n) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }]
          });
  
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          userAddress = await signer.getAddress();
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x2105",
                chainName: "Base Mainnet",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"]
              }]
            });
  
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();
          } else {
            throw switchError;
          }
        }
      }
  
      nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
      farmingV6Contract = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, signer);
      piratesV6Contract = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, signer);
      mercenaryV2Contract = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, signer);
      partnershipV2Contract = new ethers.Contract(PARTNERSHIP_V2_ADDRESS, PARTNERSHIP_V2_ABI, signer);
      inpiContract = new ethers.Contract(INPI_ADDRESS, INPI_ABI, signer);
      pitroneContract = new ethers.Contract(PITRONE_ADDRESS, PITRONE_ABI, signer);
      resourceTokenContract = new ethers.Contract(RESOURCE_TOKEN_ADDRESS, RESOURCE_TOKEN_ABI, signer);
  
      safeText("walletAddress", shortenAddress(userAddress));
      safeText("connectBtn", "Connected");
  
      await loadData();
      await loadUserResources();
      await loadUserAttacks();
      drawPyramid();
  
      if (!attacksPoller) {
        attacksPoller = setInterval(() => { loadUserAttacks(); }, 30000);
      }
      if (!dataPoller) {
        dataPoller = setInterval(async () => {
          await loadData();
          if (selectedTokenId) await updateSidebar(selectedTokenId);
        }, 30000);
      }
    } catch (err) {
      console.error(err);
      alert("Connection error: " + (err?.message || err));
    } finally {
      isConnecting = false;
    }
  }
  
  async function initReadOnly() {
    readOnlyProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    nftReadOnlyContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, readOnlyProvider);
  }
  
  /* ==================== INPUT / CANVAS ==================== */
  function handleWheel(e) {
    if (!canvas) return;
  
    e.preventDefault();
    const zoomFactor = 1.1;
    const delta = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;
  
    scale = Math.max(0.2, Math.min(5, scale * delta));
    offsetX = mouseX - worldX * scale;
    offsetY = mouseY - worldY * scale;
  
    drawPyramid();
  }
  
  function handleMouseMove(e) {
    if (!canvas || !tooltip) return;
    if (isDragging) return;
  
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / scale;
    const mouseY = (e.clientY - rect.top - offsetY) / scale;
    const blockSize = BASE_BLOCK_SIZE;
  
    let found = null;
  
    for (let row = 0; row < 100; row++) {
      const y = row * blockSize;
      if (mouseY < y - 5 || mouseY > y + blockSize + 5) continue;
      const minX = -row * blockSize;
      const maxX = (row + 1) * blockSize;
      if (mouseX < minX - 5 || mouseX > maxX + 5) continue;
      const col = Math.round((mouseX / blockSize) + row);
      if (col >= 0 && col <= 2 * row) {
        found = String(row * 2048 + col);
        break;
      }
    }
  
    if (found) {
      const token = tokens[found];
      let text = `<span>Block #${found}</span><br>`;
  
      if (token && token.owner) {
        text += `Owner: ${shortenAddress(token.owner)}<br>`;
        text += `Status: ${token.revealed ? "Revealed" : "Minted"}`;
        if (token.farmActive) text += " · Farming";
        if (token.protectionActive) text += " · Protected";
        if (token.partnerActive) text += " ⭐";
        if (token.rarity !== null) text += ` · ${rarityNames[token.rarity]}`;
  
        const attack = userAttacks.find(a => String(a.targetTokenId) === found);
        if (attack) {
          const now = Math.floor(Date.now() / 1000);
          if (attack.endTime <= now) text += " · 🔴 Attack ready!";
          else text += ` · ⚔️ Attacking (${formatTime(attack.endTime - now)} left)`;
        }
      } else {
        text += "Not minted";
      }
  
      tooltip.innerHTML = text;
      tooltip.style.opacity = 1;
      tooltip.style.left = (e.clientX + 20) + "px";
      tooltip.style.top = (e.clientY - 50) + "px";
    } else {
      tooltip.style.opacity = 0;
    }
  }
  
  function handleClick(e) {
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / scale;
    const mouseY = (e.clientY - rect.top - offsetY) / scale;
    const blockSize = BASE_BLOCK_SIZE;
  
    for (let row = 0; row < 100; row++) {
      const y = row * blockSize;
      if (mouseY < y || mouseY > y + blockSize) continue;
  
      const col = Math.round((mouseX / blockSize) + row);
      if (col >= 0 && col <= 2 * row) {
        const tokenId = String(row * 2048 + col);
        updateSidebar(tokenId);
        drawPyramid();
        break;
      }
    }
  }
  
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
      isDragging = false;
      e.preventDefault();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDist = dist;
    }
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
  
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      const distance = Math.hypot(dx, dy);
  
      if (distance > MOVE_THRESHOLD) {
        touchMoved = true;
        isDragging = true;
        offsetX += dx;
        offsetY += dy;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        drawPyramid();
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
  
      if (pinchStartDist > 0) {
        const zoomFactor = dist / pinchStartDist;
        pinchStartDist = dist;
  
        const rect = canvas.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const worldX = (mx - offsetX) / scale;
        const worldY = (my - offsetY) / scale;
  
        scale = Math.max(0.2, Math.min(5, scale * zoomFactor));
        offsetX = mx - worldX * scale;
        offsetY = my - worldY * scale;
        drawPyramid();
      }
    }
  }
  
  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      if (!touchMoved && !isDragging) {
        const fakeClick = { clientX: touchStartX, clientY: touchStartY };
        handleClick(fakeClick);
      }
      isDragging = false;
      pinchStartDist = 0;
      touchMoved = false;
    }
  }
  
  /* ==================== SIDEBAR DRAG / RESIZE ==================== */
  const legendPanel = document.getElementById("legendPanel");
  const dragHandle = document.getElementById("dragHandle");
  const resizeHandle = document.getElementById("resizeHandle");
  const collapseBtn = document.getElementById("collapseBtn");
  const resetPosBtn = document.getElementById("resetPosBtn");
  const legendContent = document.getElementById("legendContent");
  
  let isDraggingPanel = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartLeft = 0;
  let panelStartTop = 0;
  let isResizing = false;
  
  if (dragHandle) {
    dragHandle.addEventListener("mousedown", (e) => {
      if (!legendPanel) return;
      isDraggingPanel = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
  
      const rect = legendPanel.getBoundingClientRect();
      panelStartLeft = rect.left;
      panelStartTop = rect.top;
      legendPanel.style.transition = "none";
      e.preventDefault();
    });
  }
  
  if (resizeHandle) {
    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      e.preventDefault();
    });
  }
  
  window.addEventListener("mousemove", (e) => {
    if (isDraggingPanel && legendPanel) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      legendPanel.style.left = (panelStartLeft + dx) + "px";
      legendPanel.style.top = (panelStartTop + dy) + "px";
      legendPanel.style.right = "auto";
    }
  
    if (isResizing && legendPanel) {
      const rect = legendPanel.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      if (newWidth > 200 && newWidth < 520) {
        legendPanel.style.width = newWidth + "px";
        legendPanel.style.right = "auto";
      }
    }
  });
  
  window.addEventListener("mouseup", () => {
    isDraggingPanel = false;
    isResizing = false;
    if (legendPanel) legendPanel.style.transition = "";
  });
  
  if (collapseBtn && legendContent) {
    collapseBtn.addEventListener("click", () => {
      if (legendContent.classList.contains("collapsed")) {
        legendContent.classList.remove("collapsed");
        collapseBtn.textContent = "−";
      } else {
        legendContent.classList.add("collapsed");
        collapseBtn.textContent = "+";
      }
    });
  }
  
  if (resetPosBtn && legendPanel) {
    resetPosBtn.addEventListener("click", () => {
      legendPanel.style.left = "auto";
      legendPanel.style.top = "20px";
      legendPanel.style.right = "20px";
      legendPanel.style.width = "380px";
    });
  }
  
  /* ==================== CANVAS EVENTS ==================== */
  window.addEventListener("resize", () => {
    if (canvas && container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      centerPyramid();
    }
  });
  
  if (canvas) {
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);
  
    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
    });
  
    canvas.addEventListener("click", handleClick);
  }
  
  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      offsetX += dx;
      offsetY += dy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      drawPyramid();
    } else {
      handleMouseMove(e);
    }
  });
  
  window.addEventListener("mouseup", () => {
    isDragging = false;
    if (canvas) canvas.style.cursor = "grab";
  });
  
  /* ==================== EVENT LISTENERS ==================== */
  document.getElementById("connectBtn")?.addEventListener("click", connectWallet);
  
  document.getElementById("attackResource")?.addEventListener("change", async () => {
    if (selectedTokenId && isForeignToken(selectedTokenId)) {
      await refreshSelectedTargetAttackPreview();
    }
  });
  
  document.addEventListener("click", async (e) => {
    if (e.target.id === "revealBtn") await handleReveal();
    if (e.target.id === "startFarmBtn") await handleStartFarm();
    if (e.target.id === "stopFarmBtn") await handleStopFarm();
    if (e.target.id === "claimBtn") await handleClaim();
    if (e.target.id === "buyBoostBtn") await handleBuyBoost();
    if (e.target.id === "protectBtn") await handleProtect();
    if (e.target.id === "attackBtn") await handleAttack();
  });
  
  /* ==================== START ==================== */
  (async function init() {
    await initReadOnly();
    if (canvas && container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    await loadData();
    centerPyramid();
  
    // Auto-connect wenn vorher verbunden
    const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
    if (shouldReconnect) {
      connectWallet();
    }
  })();