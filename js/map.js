/* =========================================================
   INPINITY MAP – CLEAN V6 ONLY (MODULE VERSION)
   - nutzt config.js / state.js / contracts.js / subgraph.js / utils.js
   - ethers v5 kompatibel
   - FarmingV6 / PiratesV6 only
   - eigener Block = Angreifer
   - fremder Block = Ziel
   ========================================================= */

   import {
    NFT_ADDRESS,
    WORKER_URL,
    STORAGE_WALLET_FLAG,
    resourceNames,
    rarityNames,
    FARMING_V6_ADDRESS,
    MERCENARY_V2_ADDRESS
  } from "./config.js";
  
  import { state } from "./state.js";
  
  import {
    byId,
    safeText,
    shortenAddress,
    formatTime,
    formatDuration,
    debugLog
  } from "./utils.js";
  
  import {
    connectWalletCore,
    clearContracts
  } from "./contracts.js";
  
  import {
    fetchAllWithPagination
  } from "./subgraph.js";
  
  /* ==================== KONSTANTEN ==================== */
  const BASE_BLOCK_SIZE = 24;
  const MOVE_THRESHOLD = 10;
  
  const rarityClass = [
    "rarity-bronze",
    "rarity-silver",
    "rarity-gold",
    "rarity-platinum",
    "rarity-diamond"
  ];
  
  const rarityColors = [
    "#cd7f32",
    "#c0c0c0",
    "#ffd700",
    "#e5e4e2",
    "#b9f2ff"
  ];
  
  /* ==================== DOM ==================== */
  const canvas = byId("pyramidCanvas");
  const ctx = canvas?.getContext("2d");
  const container = byId("canvasContainer");
  const tooltip = byId("tooltip");
  
  const blockDetailDiv = byId("blockDetail");
  const actionPanel = byId("actionPanel");
  const ownerActionsDiv = byId("ownerActions");
  const protectionInput = byId("protectionInput");
  const attackInput = byId("attackInput");
  const actionMessage = byId("actionMessage");
  const userResourcesDiv = byId("userResources");
  const userAttacksList = byId("userAttacksList");
  
  /* ==================== MAP STATE ==================== */
  let readOnlyProvider = null;
  let nftReadOnlyContract = null;
  
  let tokens = {};
  let userResources = [];
  let userAttacks = [];
  
  let selectedTokenId = null;
  let selectedTokenOwner = null;
  
  let attacksTicker = null;
  let attacksPoller = null;
  let dataPoller = null;
  let isConnecting = false;
  
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let pinchStartDist = 0;
  
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  
  /* ==================== FALLBACK HELPERS ==================== */
  function normalizeAttackTuple(a) {
    return {
      attacker: a.attacker ?? a[0],
      attackerTokenId: Number(a.attackerTokenId ?? a[1] ?? 0),
      targetTokenId: Number(a.targetTokenId ?? a[2] ?? 0),
      startTime: Number(a.startTime ?? a[3] ?? 0),
      endTime: Number(a.endTime ?? a[4] ?? 0),
      resource: Number(a.resource ?? a[5] ?? 0),
      executed: Boolean(a.executed ?? a[6]),
      cancelled: Boolean(a.cancelled ?? a[7])
    };
  }
  
  function bnGtZero(value) {
    try {
      return ethers.BigNumber.from(value || 0).gt(0);
    } catch {
      return false;
    }
  }
  
  function getAttackStorageKey(targetTokenId) {
    return `attack_${targetTokenId}`;
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
  
  function isOwnToken(tokenId) {
    const token = tokens[String(tokenId)];
    return !!(
      state.userAddress &&
      token &&
      token.owner &&
      token.owner.toLowerCase() === state.userAddress.toLowerCase()
    );
  }
  
  function isForeignToken(tokenId) {
    const token = tokens[String(tokenId)];
    return !!(
      state.userAddress &&
      token &&
      token.owner &&
      token.owner.toLowerCase() !== state.userAddress.toLowerCase()
    );
  }
  
  async function getPreferredAttackerTokenId() {
    if (!state.userAddress) return null;
  
    if (selectedTokenId && isOwnToken(selectedTokenId)) {
      return parseInt(selectedTokenId, 10);
    }
  
    const ownTokens = Object.entries(tokens).filter(([_, t]) =>
      t.owner && t.owner.toLowerCase() === state.userAddress.toLowerCase()
    );
  
    if (!ownTokens.length) return null;
    return parseInt(ownTokens[0][0], 10);
  }
  
  function getProduction(rarity) {
    const p = {};
  
    if (rarity === 0) {
      p.OIL = 12; p.LEMONS = 8; p.IRON = 5; p.COPPER = 1;
    } else if (rarity === 1) {
      p.OIL = 14; p.LEMONS = 10; p.IRON = 7; p.GOLD = 1; p.COPPER = 2;
    } else if (rarity === 2) {
      p.OIL = 16; p.LEMONS = 12; p.IRON = 9; p.GOLD = 2; p.PLATINUM = 1; p.COPPER = 3; p.CRYSTAL = 1;
    } else if (rarity === 3) {
      p.OIL = 18; p.LEMONS = 14; p.IRON = 11; p.GOLD = 3; p.PLATINUM = 2; p.COPPER = 4; p.CRYSTAL = 2; p.MYSTERIUM = 1;
    } else if (rarity === 4) {
      p.OIL = 20; p.LEMONS = 15; p.IRON = 12; p.GOLD = 5; p.PLATINUM = 3; p.COPPER = 5; p.CRYSTAL = 3; p.OBSIDIAN = 1; p.MYSTERIUM = 1; p.AETHER = 1;
    }
  
    return p;
  }
  
  /* ==================== READ ONLY ==================== */
  async function initReadOnly() {
    readOnlyProvider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
    nftReadOnlyContract = new ethers.Contract(
      NFT_ADDRESS,
      [
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function calculateRarity(uint256 tokenId) view returns (uint8)"
      ],
      readOnlyProvider
    );
  }
  
  /* ==================== SAFE CONTRACT READS ==================== */
  async function safeGetFarm(tokenId) {
    try {
      const f = await state.farmingV6Contract.getFarmState(tokenId);
      return {
        ok: true,
        startTime: Number(f.startTime ?? 0),
        lastAccrualTime: Number(f.lastAccrualTime ?? 0),
        lastClaimTime: Number(f.lastClaimTime ?? 0),
        boostExpiry: Number(f.boostExpiry ?? 0),
        stopTime: Number(f.stopTime ?? 0),
        isActive: !!f.isActive
      };
    } catch {
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
  
  /* ==================== SUBGRAPH DATA ==================== */
  async function loadData() {
    try {
      const [
        tokenItems,
        blockRevealedItems,
        farmV6Items,
        protectionItems,
        partnerItems
      ] = await Promise.all([
        fetchAllWithPagination("tokens", "id owner { id } revealed").catch(() => []),
        fetchAllWithPagination("blockRevealeds", "tokenId rarity").catch(() => []),
        fetchAllWithPagination(
          "farmV6S",
          "id owner startTime lastAccrualTime lastClaimTime boostExpiry stopTime active updatedAt blockNumber",
          `{ active: true }`
        ).catch(() => []),
        fetchAllWithPagination("protections", "id active", `{ active: true }`).catch(() => []),
        fetchAllWithPagination("partnerships", "id active", `{ active: true }`).catch(() => [])
      ]);
  
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
  
      blockRevealedItems.forEach(br => {
        const tokenId = String(br.tokenId);
        if (tokens[tokenId]) {
          tokens[tokenId].rarity = parseInt(br.rarity, 10);
        }
      });
  
      farmV6Items.forEach(f => {
        const tokenId = String(f.id);
        if (tokens[tokenId]) {
          tokens[tokenId].farmActive = !!f.active;
          tokens[tokenId].farmStartTime = parseInt(f.startTime || "0", 10);
          tokens[tokenId].lastClaimTime = parseInt(f.lastClaimTime || "0", 10);
          tokens[tokenId].boostExpiry = parseInt(f.boostExpiry || "0", 10);
        }
      });
  
      protectionItems.forEach(p => {
        const tokenId = String(p.id);
        if (tokens[tokenId]) tokens[tokenId].protectionActive = !!p.active;
      });
  
      partnerItems.forEach(p => {
        const tokenId = String(p.id);
        if (tokens[tokenId]) tokens[tokenId].partnerActive = !!p.active;
      });
  
      drawPyramid();
    } catch (err) {
      console.error("loadData error:", err);
    }
  }
  
  /* ==================== RESOURCES ==================== */
  async function loadUserResources() {
    if (!state.userAddress || !state.resourceTokenContract) return;
  
    try {
      const ids = [...Array(10).keys()];
      const accounts = ids.map(() => state.userAddress);
      const balances = await state.resourceTokenContract.balanceOfBatch(accounts, ids);
  
      userResources = ids
        .map((id, idx) => ({
          resourceId: id,
          amount: balances[idx]
        }))
        .filter(r => bnGtZero(r.amount));
  
      updateUserResourcesDisplay();
    } catch (err) {
      console.error("loadUserResources error:", err);
      userResources = [];
      updateUserResourcesDisplay();
    }
  }
  
  function updateUserResourcesDisplay() {
    if (!userResourcesDiv) return;
  
    if (!state.userAddress) {
      userResourcesDiv.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
      return;
    }
  
    if (!userResources.length) {
      userResourcesDiv.innerHTML = `<p style="color:#98a9b9;">No resources</p>`;
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
  
  /* ==================== ATTACK HELPERS ==================== */
  function populateAttackResourceSelect(resourceIds = null, selectedValue = null) {
    const select = byId("attackResource");
    if (!select) return;
  
    select.innerHTML = "";
  
    const ids = Array.isArray(resourceIds)
      ? resourceIds
      : resourceNames.map((_, i) => i);
  
    if (!ids.length) {
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
    if (!state.piratesV6Contract) return [];
  
    const previews = await Promise.allSettled(
      resourceNames.map((_, i) =>
        state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, i)
      )
    );
  
    const ids = [];
    previews.forEach((res, i) => {
      if (res.status === "fulfilled" && res.value && res.value.allowed) ids.push(i);
    });
  
    return ids;
  }
  
  /* ==================== ATTACKS ==================== */
  async function loadUserAttacks() {
    if (!state.userAddress) return;
  
    try {
      const attacks = await fetchAllWithPagination(
        "attackV6S",
        "id attacker attackerTokenId targetTokenId attackIndex startTime endTime resource executed cancelled protectionLevel effectiveStealPercent stolenAmount",
        `{ attacker: "${state.userAddress.toLowerCase()}" }`
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
      console.error("loadUserAttacks error:", e);
    }
  }
  
  function displayUserAttacks() {
    if (!userAttacksList) return;
  
    if (!state.userAddress) {
      userAttacksList.innerHTML = `<p style="color:#98a9b9;">Connect wallet</p>`;
      return;
    }
  
    if (!userAttacks.length) {
      userAttacksList.innerHTML = `<p style="color:#98a9b9;">No active attacks</p>`;
      return;
    }
  
    const now = Math.floor(Date.now() / 1000);
  
    userAttacksList.innerHTML = userAttacks.map(attack => {
      const timeLeft = attack.endTime - now;
      const ready = timeLeft <= 0;
  
      return `
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
    }).join("");
  
    userAttacksList.querySelectorAll(".execute-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        await executeAttack({
          id: btn.dataset.attackid,
          targetTokenId: parseInt(btn.dataset.targetid, 10),
          attackIndex: parseInt(btn.dataset.attackindex, 10),
          resource: parseInt(btn.dataset.resource, 10)
        });
      });
    });
  
    userAttacksList.querySelectorAll(".cancel-attack-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await cancelAttack(
          parseInt(btn.dataset.targetid, 10),
          parseInt(btn.dataset.attackindex, 10)
        );
      });
    });
  }
  
  function startAttacksTicker() {
    if (attacksTicker) return;
  
    attacksTicker = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
  
      document.querySelectorAll(".attack-status").forEach(el => {
        const endTime = parseInt(el.dataset.endtime || "0", 10);
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
        const attackRow = btn.closest(".attack-item");
        const statusEl = attackRow?.querySelector(".attack-status");
        const endTime = parseInt(statusEl?.dataset.endtime || "0", 10);
        const timeLeft = endTime - now;
  
        btn.disabled = timeLeft > 0;
        btn.textContent = timeLeft <= 0 ? "⚔️" : "⏳";
      });
  
      drawPyramid();
    }, 1000);
  }
  
  async function executeAttack(attack) {
    if (!actionMessage) return;
  
    actionMessage.innerHTML = `<span class="success">⏳ Checking attack...</span>`;
  
    try {
      const liveAttack = await state.piratesV6Contract.getAttack(attack.targetTokenId, attack.attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
      const now = Math.floor(Date.now() / 1000);
  
      if (normalized.executed) {
        actionMessage.innerHTML = `<span class="error">❌ Attack already executed.</span>`;
        if (attack.id) dismissAttackById(attack.id);
        await loadUserAttacks();
        return;
      }
  
      if (normalized.cancelled) {
        actionMessage.innerHTML = `<span class="error">❌ Attack was cancelled.</span>`;
        if (attack.id) dismissAttackById(attack.id);
        await loadUserAttacks();
        return;
      }
  
      if (normalized.endTime > now) {
        actionMessage.innerHTML = `<span class="error">❌ Attack not ready yet. Wait ${formatDuration(normalized.endTime - now)}.</span>`;
        return;
      }
  
      const preview = await state.piratesV6Contract.previewExecuteAttack(
        attack.targetTokenId,
        attack.attackIndex
      );
  
      if (!preview.allowed) {
        actionMessage.innerHTML = `<span class="error">❌ Execute not allowed. Code: ${preview.code}</span>`;
        return;
      }
  
      const tx = await state.piratesV6Contract.executeAttack(
        attack.targetTokenId,
        attack.attackIndex,
        { gasLimit: 350000 }
      );
  
      actionMessage.innerHTML = `<span class="success">⏳ Executing attack...</span>`;
      await tx.wait();
  
      actionMessage.innerHTML = `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`;
  
      localStorage.removeItem(getAttackStorageKey(attack.targetTokenId));
      if (attack.id) dismissAttackById(attack.id);
  
      await loadUserAttacks();
      await loadUserResources();
      await loadData();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (e) {
      console.error("executeAttack error:", e);
      actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function cancelAttack(targetTokenId, attackIndex) {
    if (!actionMessage) return;
  
    try {
      const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
  
      if (normalized.attacker.toLowerCase() !== state.userAddress.toLowerCase()) {
        actionMessage.innerHTML = `<span class="error">❌ Not your attack to cancel.</span>`;
        return;
      }
  
      if (normalized.executed) {
        actionMessage.innerHTML = `<span class="error">❌ Cannot cancel executed attack.</span>`;
        return;
      }
  
      if (normalized.cancelled) {
        actionMessage.innerHTML = `<span class="error">❌ Attack already cancelled.</span>`;
        return;
      }
  
      const tx = await state.piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, {
        gasLimit: 300000
      });
  
      actionMessage.innerHTML = `<span class="success">⏳ Cancelling attack...</span>`;
      await tx.wait();
  
      actionMessage.innerHTML = `<span class="success">✅ Attack cancelled.</span>`;
      await loadUserAttacks();
      await loadData();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (e) {
      console.error("cancelAttack error:", e);
      actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== PREVIEW ==================== */
  async function refreshSelectedTargetAttackPreview() {
    const attackerBlockEl = byId("attackAttackerBlock");
    const targetStatusEl = byId("attackTargetStatus");
    const travelTimeEl = byId("attackTravelTime");
    const remainingEl = byId("attackRemainingToday");
    const pendingLootEl = byId("attackPendingLoot");
    const stealAmountEl = byId("attackStealAmount");
    const protectionEl = byId("attackProtection");
    const stealPercentEl = byId("attackStealPercent");
    const attackResourceEl = byId("attackResource");
    const attackBtn = byId("attackBtn");
  
    if (!selectedTokenId || !state.userAddress || !isForeignToken(selectedTokenId)) {
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
    const lootableIds = await getAttackableResourceIds(attackerTokenId, targetTokenIdNum);
  
    let selectedResourceId = attackResourceEl?.value ?? null;
    if (
      selectedResourceId === null ||
      selectedResourceId === "" ||
      !lootableIds.includes(Number(selectedResourceId))
    ) {
      selectedResourceId = lootableIds.length ? lootableIds[0] : null;
    }
  
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
  
    const resourceId = parseInt(byId("attackResource")?.value || "0", 10);
  
    try {
      const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resourceId);
  
      if (targetStatusEl) {
        if (preview.allowed) targetStatusEl.innerText = "✅ Attack allowed";
        else if (Number(preview.pendingAmount || 0) === 0) targetStatusEl.innerText = "⚠️ No loot available";
        else targetStatusEl.innerText = `❌ Blocked (Code ${preview.code})`;
      }
  
      if (travelTimeEl) travelTimeEl.innerText = formatDuration(Number(preview.travelTime || 0));
      if (remainingEl) remainingEl.innerText = String(Number(preview.remainingAttacksToday || 0));
      if (pendingLootEl) pendingLootEl.innerText = (preview.pendingAmount || 0).toString();
      if (stealAmountEl) stealAmountEl.innerText = (preview.stealAmount || 0).toString();
      if (protectionEl) protectionEl.innerText = `${Number(preview.protectionLevel || 0)}%`;
      if (stealPercentEl) stealPercentEl.innerText = `${Number(preview.effectiveStealPercent || 0)}%`;
      if (attackBtn) attackBtn.disabled = !preview.allowed;
    } catch (e) {
      console.warn("previewAttack failed", e);
      if (targetStatusEl) targetStatusEl.innerText = "⚠️ Preview failed";
      if (attackBtn) attackBtn.disabled = true;
    }
  }
  
  /* ==================== SIDEBAR ==================== */
  async function updateSidebar(tokenId) {
    selectedTokenId = String(tokenId);
    const token = tokens[selectedTokenId];
    const owner = token ? token.owner : null;
    selectedTokenOwner = owner;
  
    const now = Math.floor(Date.now() / 1000);
    let v6Active = false;
    let farmAgeTxt = "-";
    let claimTxt = "-";
    let pendingTotalTxt = "-";
    let boostTxt = "-";
  
    if (state.farmingV6Contract && token && token.owner) {
      const farmInfo = await safeGetFarm(selectedTokenId);
      v6Active = farmInfo.ok && farmInfo.isActive;
  
      if (v6Active && farmInfo.startTime > 0) {
        farmAgeTxt = formatDuration(now - farmInfo.startTime);
      }
  
      try {
        const preview = await state.farmingV6Contract.previewClaim(selectedTokenId);
        pendingTotalTxt = preview.pendingAmount ? preview.pendingAmount.toString() : "0";
        claimTxt = preview.allowed
          ? "READY"
          : (Number(preview.secondsRemaining || 0) > 0
              ? `in ${formatDuration(Number(preview.secondsRemaining))}`
              : "Not ready");
      } catch {}
  
      if (farmInfo.boostExpiry && farmInfo.boostExpiry > now) {
        boostTxt = "active";
      }
    }
  
    let productionHtml = "";
    let rarityDisplay = "";
  
    if (token && token.owner && token.revealed && nftReadOnlyContract) {
      try {
        const tokenIdNum = parseInt(selectedTokenId, 10);
        const rarity = token.rarity !== null
          ? token.rarity
          : await nftReadOnlyContract.calculateRarity(tokenIdNum);
  
        const r = Number(rarity);
        rarityDisplay = `<div class="detail-row"><span class="detail-label">Rarity</span><span class="detail-value ${rarityClass[r]}">${rarityNames[r]}</span></div>`;
  
        const production = getProduction(r);
        productionHtml = `<div class="detail-row"><span class="detail-label">Production</span></div>`;
        for (const [res, amount] of Object.entries(production)) {
          productionHtml += `<div class="detail-row"><span class="detail-label">${res}</span><span class="detail-value">${amount}/d</span></div>`;
        }
      } catch {}
    }
  
    if (token && owner) {
      blockDetailDiv.innerHTML = `
        <div class="detail-row"><span class="detail-label">Block</span><span class="detail-value">${selectedTokenId}</span></div>
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
      blockDetailDiv.innerHTML = `<p style="color:#98a9b9;">Block #${selectedTokenId} not minted</p>`;
    }
  
    if (actionPanel) actionPanel.style.display = token && owner ? "block" : "none";
    if (ownerActionsDiv) ownerActionsDiv.innerHTML = "";
    if (protectionInput) protectionInput.style.display = "none";
    if (attackInput) attackInput.style.display = "none";
    if (actionMessage) actionMessage.innerHTML = "";
  
    if (state.userAddress && owner && owner.toLowerCase() !== state.userAddress.toLowerCase()) {
      await refreshSelectedTargetAttackPreview();
    } else if (state.userAddress && owner && owner.toLowerCase() === state.userAddress.toLowerCase()) {
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
    }
  }
  
  /* ==================== TX HELPERS ==================== */
  async function sendTx(txPromise, successMsg) {
    if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Sending...</span>`;
  
    try {
      const tx = await txPromise;
      if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Confirming...</span>`;
      await tx.wait();
  
      if (actionMessage) actionMessage.innerHTML = `<span class="success">✅ ${successMsg}</span>`;
  
      await loadData();
      await loadUserResources();
      await loadUserAttacks();
      if (selectedTokenId) await updateSidebar(selectedTokenId);
    } catch (err) {
      console.error(err);
      if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${err.reason || err.message || "Tx failed"}</span>`;
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
  
      const formatProof = arr => arr.map(item => {
        const v = item.left ? item.left : item.right;
        return v.startsWith("0x") ? v : ("0x" + v);
      });
  
      await sendTx(
        state.nftContract.revealBlock(
          selectedTokenId,
          formatProof(proofs.pi.proof),
          formatProof(proofs.phi.proof),
          proofs.pi.digit,
          proofs.phi.digit,
          { gasLimit: 500000 }
        ),
        "Block revealed!"
      );
    } catch (e) {
      if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
  }
  
  async function handleStartFarm() {
    if (!selectedTokenId) return;
    await sendTx(
      state.farmingV6Contract.startFarming(selectedTokenId, { gasLimit: 500000 }),
      "Farming started."
    );
  }
  
  async function handleStopFarm() {
    if (!selectedTokenId) return;
    await sendTx(
      state.farmingV6Contract.stopFarming(selectedTokenId, { gasLimit: 500000 }),
      "Farming stopped."
    );
  }
  
  async function handleClaim() {
    if (!selectedTokenId) return;
  
    try {
      const preview = await state.farmingV6Contract.previewClaim(selectedTokenId);
      if (!preview.allowed) {
        actionMessage.innerHTML = `<span class="error">❌ Claim not ready. Code: ${preview.code}</span>`;
        return;
      }
  
      await sendTx(
        state.farmingV6Contract.claimResources(selectedTokenId, { gasLimit: 600000 }),
        "Resources claimed!"
      );
    } catch (e) {
      actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function handleBuyBoost() {
    if (!selectedTokenId) return;
  
    const days = parseInt(byId("boostDays")?.value, 10);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      alert("Please enter valid days (1-30)");
      return;
    }
  
    await sendTx(
      state.farmingV6Contract.buyBoost(selectedTokenId, days, { gasLimit: 300000 }),
      `Boost activated for ${days} days!`
    );
  }
  
  async function handleProtect() {
    if (!selectedTokenId || !state.userAddress) return;
  
    const level = parseInt(byId("protectLevel")?.value, 10);
    if (!Number.isFinite(level) || level < 0 || level > 50) {
      alert("Invalid level (0-50)");
      return;
    }
  
    try {
      const cost = level * 10;
      const amount = ethers.utils.parseEther(String(cost));
      const allowance = await state.inpiContract.allowance(state.userAddress, MERCENARY_V2_ADDRESS);
  
      if (allowance.lt(amount)) {
        if (actionMessage) actionMessage.innerHTML = `<span class="success">⏳ Approving...</span>`;
        const approveTx = await state.inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
        await approveTx.wait();
      }
  
      await sendTx(
        state.mercenaryV2Contract.hireMercenaries(selectedTokenId, level, { gasLimit: 400000 }),
        "Protection bought!"
      );
    } catch (e) {
      if (actionMessage) actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function handleAttack() {
    if (!selectedTokenId || !state.userAddress) return;
  
    const targetToken = tokens[selectedTokenId];
    if (!targetToken || !targetToken.owner) {
      actionMessage.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
      return;
    }
  
    if (targetToken.owner.toLowerCase() === state.userAddress.toLowerCase()) {
      actionMessage.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
      return;
    }
  
    const attackerTokenId = await getPreferredAttackerTokenId();
    if (!attackerTokenId) {
      actionMessage.innerHTML = `<span class="error">❌ Need your own block to attack from.</span>`;
      return;
    }
  
    const targetTokenIdNum = parseInt(selectedTokenId, 10);
    const resource = parseInt(byId("attackResource")?.value || "0", 10);
  
    if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
      actionMessage.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
      return;
    }
  
    try {
      const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenIdNum, resource);
  
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
  
      const tx = await state.piratesV6Contract.startAttack(
        attackerTokenId,
        targetTokenIdNum,
        resource,
        { gasLimit: 450000 }
      );
  
      await tx.wait();
  
      actionMessage.innerHTML = `<span class="success">✅ Attack launched!</span>`;
  
      localStorage.setItem(
        getAttackStorageKey(targetTokenIdNum),
        JSON.stringify({
          targetTokenId: targetTokenIdNum,
          attackerTokenId,
          resource,
          startTime: Math.floor(Date.now() / 1000)
        })
      );
  
      await loadUserAttacks();
      await loadData();
      await refreshSelectedTargetAttackPreview();
    } catch (e) {
      console.error("handleAttack error:", e);
      actionMessage.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== DRAW ==================== */
  function drawPyramid() {
    if (!canvas || !ctx) return;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
  
    const now = Math.floor(Date.now() / 1000);
  
    for (let row = 0; row < 100; row++) {
      const blocksInRow = 2 * row + 1;
      const y = row * BASE_BLOCK_SIZE;
  
      for (let col = 0; col < blocksInRow; col++) {
        const tokenIdNum = row * 2048 + col;
        const tokenId = String(tokenIdNum);
        const token = tokens[tokenId];
        const x = (col - row) * BASE_BLOCK_SIZE;
  
        let fillColor = "#3a4048";
        let strokeColor = null;
        let lineWidth = 0;
  
        if (token && token.owner) {
          if (token.revealed && token.rarity !== null && token.rarity >= 0 && token.rarity <= 4) {
            fillColor = rarityColors[token.rarity];
          } else {
            fillColor = token.revealed ? "#c9a959" : "#2e7d5e";
          }
  
          if (state.userAddress && token.owner.toLowerCase() === state.userAddress.toLowerCase()) {
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
        ctx.fillRect(x, y, BASE_BLOCK_SIZE, BASE_BLOCK_SIZE);
  
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.strokeRect(x, y, BASE_BLOCK_SIZE, BASE_BLOCK_SIZE);
        }
  
        if (token && token.partnerActive) {
          ctx.save();
          ctx.translate(x + BASE_BLOCK_SIZE - 8, y + 8);
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
    if (!canvas) return;
  
    const totalWidth = 199 * BASE_BLOCK_SIZE;
    const totalHeight = 100 * BASE_BLOCK_SIZE;
    const scaleX = (canvas.width / totalWidth) * 0.95;
    const scaleY = (canvas.height / totalHeight) * 0.95;
  
    scale = Math.min(scaleX, scaleY, 1.5);
    offsetX = (canvas.width - totalWidth * scale) / 2;
    offsetY = (canvas.height - totalHeight * scale) / 2;
    drawPyramid();
  }
  
  /* ==================== CANVAS INPUT ==================== */
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
  
  function handleClick(e) {
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / scale;
    const mouseY = (e.clientY - rect.top - offsetY) / scale;
  
    for (let row = 0; row < 100; row++) {
      const y = row * BASE_BLOCK_SIZE;
      if (mouseY < y || mouseY > y + BASE_BLOCK_SIZE) continue;
  
      const col = Math.round((mouseX / BASE_BLOCK_SIZE) + row);
      if (col >= 0 && col <= 2 * row) {
        updateSidebar(String(row * 2048 + col));
        drawPyramid();
        break;
      }
    }
  }
  
  function handleMouseMove(e) {
    if (!canvas || !tooltip || isDragging) return;
  
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offsetX) / scale;
    const mouseY = (e.clientY - rect.top - offsetY) / scale;
  
    let found = null;
  
    for (let row = 0; row < 100; row++) {
      const y = row * BASE_BLOCK_SIZE;
      if (mouseY < y - 5 || mouseY > y + BASE_BLOCK_SIZE + 5) continue;
      const minX = -row * BASE_BLOCK_SIZE;
      const maxX = (row + 1) * BASE_BLOCK_SIZE;
      if (mouseX < minX - 5 || mouseX > maxX + 5) continue;
  
      const col = Math.round((mouseX / BASE_BLOCK_SIZE) + row);
      if (col >= 0 && col <= 2 * row) {
        found = String(row * 2048 + col);
        break;
      }
    }
  
    if (!found) {
      tooltip.style.opacity = 0;
      return;
    }
  
    const token = tokens[found];
    let html = `<span>Block #${found}</span><br>`;
  
    if (token && token.owner) {
      html += `Owner: ${shortenAddress(token.owner)}<br>`;
      html += `Status: ${token.revealed ? "Revealed" : "Minted"}`;
  
      if (token.farmActive) html += " · Farming";
      if (token.protectionActive) html += " · Protected";
      if (token.partnerActive) html += " ⭐";
      if (token.rarity !== null) html += ` · ${rarityNames[token.rarity]}`;
  
      const attack = userAttacks.find(a => String(a.targetTokenId) === found);
      if (attack) {
        const now = Math.floor(Date.now() / 1000);
        html += attack.endTime <= now
          ? " · 🔴 Attack ready!"
          : ` · ⚔️ Attacking (${formatTime(attack.endTime - now)} left)`;
      }
    } else {
      html += "Not minted";
    }
  
    tooltip.innerHTML = html;
    tooltip.style.opacity = 1;
    tooltip.style.left = `${e.clientX + 20}px`;
    tooltip.style.top = `${e.clientY - 50}px`;
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
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
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
        handleClick({ clientX: touchStartX, clientY: touchStartY });
      }
      isDragging = false;
      pinchStartDist = 0;
      touchMoved = false;
    }
  }
  
  /* ==================== WALLET ==================== */
  async function connectWallet(forceRequest = true) {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    if (isConnecting) return;
    if (state.userAddress) return;
  
    isConnecting = true;
  
    try {
      const ok = await connectWalletCore(forceRequest);
      if (!ok) return;
  
      localStorage.setItem(STORAGE_WALLET_FLAG, "1");
  
      safeText("walletAddress", shortenAddress(state.userAddress));
      safeText("connectBtn", "Connected");
  
      await Promise.all([
        loadData(),
        loadUserResources(),
        loadUserAttacks()
      ]);
  
      drawPyramid();
  
      if (!attacksPoller) {
        attacksPoller = setInterval(() => loadUserAttacks(), 30000);
      }
  
      if (!dataPoller) {
        dataPoller = setInterval(async () => {
          await loadData();
          if (selectedTokenId) await updateSidebar(selectedTokenId);
        }, 30000);
      }
  
      debugLog("Map wallet connected", state.userAddress);
    } catch (err) {
      console.error(err);
      alert("Connection error: " + (err.reason || err.message || err));
      clearContracts();
    } finally {
      isConnecting = false;
    }
  }
  
  /* ==================== EVENTS ==================== */
  window.addEventListener("resize", () => {
    if (canvas && container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      centerPyramid();
    }
  });
  
  if (canvas) {
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);
  
    canvas.addEventListener("mousedown", e => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
    });
  }
  
  window.addEventListener("mousemove", e => {
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
  
  byId("connectBtn")?.addEventListener("click", () => connectWallet(true));
  
  byId("attackResource")?.addEventListener("change", async () => {
    if (selectedTokenId && isForeignToken(selectedTokenId)) {
      await refreshSelectedTargetAttackPreview();
    }
  });
  
  document.addEventListener("click", async e => {
    if (e.target.id === "revealBtn") await handleReveal();
    if (e.target.id === "startFarmBtn") await handleStartFarm();
    if (e.target.id === "stopFarmBtn") await handleStopFarm();
    if (e.target.id === "claimBtn") await handleClaim();
    if (e.target.id === "buyBoostBtn") await handleBuyBoost();
    if (e.target.id === "protectBtn") await handleProtect();
    if (e.target.id === "attackBtn") await handleAttack();
  });
  
  /* ==================== INIT ==================== */
  (async function init() {
    await initReadOnly();
  
    if (canvas && container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
  
    await loadData();
    centerPyramid();
  
    const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
    if (shouldReconnect) {
      connectWallet(false);
    }
  })();