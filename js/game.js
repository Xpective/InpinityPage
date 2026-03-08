/* =========================================================
   INPINITY GAME – V6 ONLY
   - FarmingV6 / PiratesV6 aktiv
   - Subgraph nutzt farmV6S / attackV6S
   - ethers v5 kompatibel
   ========================================================= */

   import {
    resourceNames,
    rarityNames,
    STORAGE_WALLET_FLAG,
    PRICE_ETH,
    PRICE_INPI,
    PRICE_ETH_MIXED,
    PRICE_INPI_MIXED,
    MAX_ROW,
    WORKER_URL,
    FARMING_V6_ADDRESS
  } from "./config.js";
  
  import { state } from "./state.js";
  import {
    byId,
    safeText,
    safeHTML,
    safeValue,
    safeDisabled,
    shortenAddress,
    formatTime,
    formatDuration,
    bn,
    bnGtZero,
    normalizeAttackTuple,
    getProduction,
    debugLog
  } from "./utils.js";
  
  import {
    clearContracts,
    connectWalletCore
  } from "./contracts.js";
  
  import {
    loadMyTokensFromSubgraph,
    loadMyFarmsV6FromSubgraph,
    loadMyAttacksV6FromSubgraph,
    loadProtectionsFromSubgraph,
    buildFarmV6Map,
    buildProtectionMap
  } from "./subgraph.js";
  
  /* ==================== UI HELPERS ==================== */
  
  function setWalletUIConnected(addr) {
    safeHTML("walletStatus", "🟢 Connected");
    safeHTML("walletAddress", shortenAddress(addr));
    safeText("connectWallet", "Wallet Connected");
    safeDisabled("disconnectWallet", false);
  }
  
  function setWalletUIDisconnected() {
    safeHTML("walletStatus", "🔴 Not connected");
    safeHTML("walletAddress", "—");
    safeText("balanceEth", "0 ETH");
    safeText("balanceInpi", "0 INPI");
    safeText("balancePit", "0 PIT");
    safeText("userInpi", "0");
    safeText("userPitrone", "0");
    safeText("activeFarms", "0");
    safeText("connectWallet", "Connect Wallet");
    safeDisabled("disconnectWallet", true);
  
    const blocksGrid = byId("blocksGrid");
    if (blocksGrid) {
      blocksGrid.innerHTML = `<p class="empty-state">Connect wallet to see your blocks.</p>`;
    }
  
    const userAttacksList = byId("userAttacksList");
    if (userAttacksList) {
      userAttacksList.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
    }
  
    const userResourcesEl = byId("userResources");
    if (userResourcesEl) {
      userResourcesEl.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
    }
  
    const selectedBlockInfo = byId("selectedBlockInfo");
    const blockActions = byId("blockActions");
    const noBlockSelected = byId("noBlockSelected");
  
    if (selectedBlockInfo) selectedBlockInfo.style.display = "none";
    if (blockActions) blockActions.style.display = "none";
    if (noBlockSelected) noBlockSelected.style.display = "block";
  
    safeValue("protectTokenId", "");
  }
  
  /* ==================== ATTACKER VALIDATION ==================== */
  
  async function getValidAttackerTokenId() {
    if (!state.userAddress || !state.nftContract) return null;
  
    // Prüfe ob selectedBlock existiert und dem User gehört
    if (state.selectedBlock && state.selectedBlock.tokenId) {
      try {
        const owner = await state.nftContract.ownerOf(state.selectedBlock.tokenId);
        if (owner.toLowerCase() === state.userAddress.toLowerCase()) {
          return parseInt(state.selectedBlock.tokenId, 10);
        }
      } catch (e) {
        // selectedBlock nicht mehr im Besitz
      }
    }
  
    // Fallback: erstes eigenes Token
    const balance = await state.nftContract.balanceOf(state.userAddress);
    if (balance.gt(0)) {
      const firstToken = await state.nftContract.tokenOfOwnerByIndex(state.userAddress, 0);
      return firstToken.toNumber();
    }
  
    return null;
  }
  
  /* ==================== BALANCES ==================== */
  
  async function updateBalances() {
    if (!state.userAddress || !state.provider) return;
  
    const ethBal = await state.provider.getBalance(state.userAddress);
    safeText("balanceEth", parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4) + " ETH");
  
    try {
      const inpiBal = await state.inpiContract.balanceOf(state.userAddress);
      const inpiTxt = parseFloat(ethers.utils.formatEther(inpiBal)).toFixed(0);
      safeText("balanceInpi", inpiTxt + " INPI");
      safeText("userInpi", inpiTxt);
    } catch { }
  
    try {
      const pitBal = await state.pitroneContract.balanceOf(state.userAddress);
      const pitTxt = ethers.utils.formatEther(pitBal).split(".")[0];
      safeText("balancePit", pitTxt + " PIT");
      safeText("userPitrone", pitTxt);
    } catch { }
  }
  
  async function updatePoolInfo() {
    if (!state.pitroneContract) return;
    try {
      const rate = await state.pitroneContract.getRate();
      safeText("exchangeRate", rate.toString());
  
      const aInpi = await state.pitroneContract.availableINPI();
      safeText("poolInpi", ethers.utils.formatEther(aInpi).split(".")[0]);
  
      const aPit = await state.pitroneContract.availablePitrone();
      safeText("poolPit", ethers.utils.formatEther(aPit).split(".")[0]);
    } catch { }
  }
  
  /* ==================== RESOURCES ==================== */
  
  async function loadResourceBalancesOnchain() {
    if (!state.userAddress || !state.resourceTokenContract) return;
  
    const ids = [...Array(10).keys()];
    const accounts = ids.map(() => state.userAddress);
    const balances = await state.resourceTokenContract.balanceOfBatch(accounts, ids);
  
    state.userResources = ids.map((id, idx) => ({
      resourceId: id,
      amount: balances[idx]
    })).filter(r => bnGtZero(r.amount));
  
    updateUserResourcesDisplay();
  }
  
  function updateUserResourcesDisplay() {
    const container = byId("userResources");
    if (!container) return;
  
    if (!state.userAddress) {
      container.innerHTML = `<p class="empty-state">Connect wallet to see your resource tokens.</p>`;
      return;
    }
  
    if (!state.userResources.length) {
      container.innerHTML = `<p class="empty-state">You have no resource tokens yet. Start farming!</p>`;
      return;
    }
  
    let html = "";
    for (const r of state.userResources) {
      const name = resourceNames[r.resourceId] || `Resource ${r.resourceId}`;
      html += `
        <div class="resource-item">
          <span class="resource-name">${name}</span>
          <span class="resource-amount">${r.amount.toString()}</span>
        </div>
      `;
    }
    container.innerHTML = html;
  }
  
  /* ==================== BLOCKS ==================== */
  
  async function loadUserBlocks() {
    if (!state.userAddress || !state.nftContract) return;
  
    const grid = byId("blocksGrid");
    if (!grid) return;
  
    try {
      const subgraphTokens = await loadMyTokensFromSubgraph(state.userAddress);
      const subgraphFarmsV6 = await loadMyFarmsV6FromSubgraph(state.userAddress);
      const subgraphProtections = await loadProtectionsFromSubgraph();
  
      state.cachedFarmsV6 = subgraphFarmsV6 || [];
      state.cachedProtections = subgraphProtections || [];
      state.cachedFarmV6Map = buildFarmV6Map(state.cachedFarmsV6);
      state.cachedProtectionMap = buildProtectionMap(state.cachedProtections);
      state.userBlocks = (subgraphTokens || []).map(t => String(t.id));
  
      if (!state.userBlocks.length) {
        grid.innerHTML = `<p class="empty-state">You don’t own any blocks yet.</p>`;
        safeText("activeFarms", "0");
        return;
      }
  
      let html = "";
      let activeFarmsCount = 0;
      const now = Math.floor(Date.now() / 1000);
  
      for (const token of subgraphTokens) {
        const tokenId = String(token.id);
        let row = 0;
        let col = 0;
        let revealed = !!token.revealed;
        let rarityName = "";
  
        try {
          const pos = await state.nftContract.getBlockPosition(tokenId);
          row = Number(pos.row);
          col = Number(pos.col);
        } catch { }
  
        let rarity = null;
        if (revealed) {
          try {
            rarity = Number(await state.nftContract.calculateRarity(tokenId));
            rarityName = rarityNames[rarity] || "";
          } catch { }
        }
  
        const farm = state.cachedFarmV6Map.get(tokenId);
        const farmingActive = !!(farm && farm.active);
        if (farmingActive) activeFarmsCount++;
  
        const protection = state.cachedProtectionMap.get(tokenId);
        const protectionActive = !!(protection && protection.active && protection.expiresAt > now);
  
        let classNames = revealed ? "revealed" : "hidden";
        if (farmingActive) classNames += " farming";
        if (protectionActive) classNames += " protected";
        if (state.selectedBlock && String(state.selectedBlock.tokenId) === tokenId) classNames += " selected";
  
        const badge = revealed
          ? `<div class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</div>`
          : `<div class="rarity-badge hidden-badge">🔒 Hidden</div>`;
  
        const farmDurationLine = farmingActive && farm?.startTime > 0
          ? `<div class="farm-duration">⏱️ Farming: ${formatDuration(now - farm.startTime)}</div>`
          : "";
  
        const revealButton = !revealed
          ? `<button class="reveal-block-btn" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">🔓 Reveal</button>`
          : "";
  
        html += `
          <div class="block-card ${classNames}" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">
            <div class="block-id">#${tokenId}</div>
            <div>R${row} C${col}</div>
            ${badge}
            ${farmDurationLine}
            ${revealButton}
          </div>
        `;
      }
  
      grid.innerHTML = html;
      safeText("activeFarms", String(activeFarmsCount));
  
      // Event listeners für Block-Karten
      document.querySelectorAll(".block-card").forEach(card => {
        card.addEventListener("click", async (e) => {
          if (e.target.classList.contains("reveal-block-btn")) return;
          await selectBlock(card.dataset.tokenid, card.dataset.row, card.dataset.col);
        });
      });
  
      document.querySelectorAll(".reveal-block-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const tokenId = btn.dataset.tokenid;
          const row = btn.dataset.row;
          const col = btn.dataset.col;
          await selectBlock(tokenId, row, col);
          await revealSelected();
        });
      });
  
      refreshBlockMarkings();
    } catch (e) {
      console.error("loadUserBlocks error:", e);
      grid.innerHTML = `<p class="error">Failed to load blocks.</p>`;
    }
  }
  
  async function selectBlock(tokenId, row, col) {
    const now = Math.floor(Date.now() / 1000);
  
    let revealed = false;
    let rarity = null;
  
    try {
      const tokenData = await state.nftContract.blockData(tokenId);
      revealed = !!tokenData.revealed;
    } catch { }
  
    if (revealed) {
      try {
        rarity = Number(await state.nftContract.calculateRarity(tokenId));
      } catch { }
    }
  
    const farm = state.cachedFarmV6Map.get(String(tokenId));
    const farmingActive = !!(farm && farm.active);
    const farmStartTime = farm ? farm.startTime : 0;
    const boostExpiry = farm ? farm.boostExpiry : 0;
  
    const protection = state.cachedProtectionMap.get(String(tokenId));
    const protectionLevel = protection ? protection.level : 0;
    const protectionActive = !!(protection && protection.active && protection.expiresAt > now);
  
    state.selectedBlock = {
      tokenId: String(tokenId),
      row: Number(row),
      col: Number(col),
      revealed,
      rarity,
      farmingActive,
      protectionLevel,
      protectionActive,
      farmStartTime,
      boostExpiry
    };
  
    const selectedBlockInfo = byId("selectedBlockInfo");
    const blockActions = byId("blockActions");
    const noBlockSelected = byId("noBlockSelected");
    const selectedBlockMeta = byId("selectedBlockMeta");
  
    if (selectedBlockInfo) selectedBlockInfo.style.display = "block";
    if (blockActions) blockActions.style.display = "block";
    if (noBlockSelected) noBlockSelected.style.display = "none";
  
    const farmDur = (farmingActive && farmStartTime > 0)
      ? ` · ⏱️ ${formatDuration(now - farmStartTime)}`
      : "";
  
    safeText("selectedBlockText", `Block #${tokenId} (R${row}, C${col})${farmDur}`);
    safeText("selectedActionToken", `Block #${tokenId}`);
    safeValue("protectTokenId", tokenId);
  
    safeDisabled("revealBtn", revealed);
    safeDisabled("farmingStartBtn", farmingActive);
    safeDisabled("farmingStopBtn", !farmingActive);
  
    const resDiv = byId("blockResources");
    if (resDiv) {
      if (revealed && rarity !== null) {
        const production = getProduction(rarity, Number(row));
        let h = "";
        for (const [res, amount] of Object.entries(production)) {
          h += `<div class="resource-item">${res}: ${amount}/day</div>`;
        }
        if (protectionActive) h += `<div class="resource-item">Protection: ${protectionLevel}%</div>`;
        if (boostExpiry > now) h += `<div class="resource-item">Boost: active</div>`;
        resDiv.innerHTML = h;
      } else {
        resDiv.innerHTML = "<p>Reveal block to see resources.</p>";
      }
    }
  
    if (selectedBlockMeta) {
      let meta = [`V6 farming: ${farmingActive ? "active" : "inactive"}`];
      if (protectionActive) meta.push(`Protection ${protectionLevel}%`);
      if (boostExpiry > now) meta.push(`Boost active`);
      selectedBlockMeta.style.display = "block";
      selectedBlockMeta.innerHTML = meta.join(" · ");
    }
  
    document.querySelectorAll(".block-card").forEach(c => c.classList.remove("selected"));
    const sel = document.querySelector(`.block-card[data-tokenid="${tokenId}"]`);
    if (sel) sel.classList.add("selected");
  }
  
  /* ==================== ATTACK DROPDOWN ==================== */
  
  function initAttackResourceSelect() {
    const select = byId("attackResourceSelect");
    if (!select) return;
  
    select.innerHTML = "";
    for (let i = 0; i < resourceNames.length; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = resourceNames[i];
      select.appendChild(opt);
    }
  }
  
  function scheduleAttackDropdownRefresh() {
    clearTimeout(state.attackDropdownTimer);
    state.attackDropdownTimer = setTimeout(() => {
      refreshAttackDropdown();
    }, 350);
  }
  
  async function refreshAttackDropdown() {
    const requestId = ++state.attackDropdownRequestId;
  
    const row = parseInt(byId("attackRow")?.value, 10);
    const col = parseInt(byId("attackCol")?.value, 10);
    const select = byId("attackResourceSelect");
    const msg = byId("attackMessage");
    const info = byId("attackRulesInfo");
    const previewDetails = byId("attackPreviewDetails");
  
    if (!select) return;
  
    if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row > MAX_ROW || col < 0 || col > 2 * row) {
      select.innerHTML = "";
      if (msg) msg.innerHTML = "";
      if (info) info.innerHTML = `<strong>Attack Check</strong><br>Enter valid coordinates.`;
      if (previewDetails) previewDetails.style.display = "none";
      return;
    }
  
    const targetTokenId = row * 2048 + col;
  
    if (!state.userAddress || !state.nftContract || !state.piratesV6Contract) {
      initAttackResourceSelect();
      return;
    }
  
    try {
      if (msg) msg.innerHTML = `<span class="success">⏳ Analyzing target...</span>`;
      if (previewDetails) previewDetails.style.display = "none";
  
      let targetOwner;
      try {
        targetOwner = await state.nftContract.ownerOf(targetTokenId);
      } catch {
        if (requestId !== state.attackDropdownRequestId) return;
        if (msg) msg.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
        if (info) info.innerHTML = `<strong>Attack Check</strong><br>Block not minted.`;
        return;
      }
  
      const attackerTokenId = await getValidAttackerTokenId();
      if (!attackerTokenId) {
        if (requestId !== state.attackDropdownRequestId) return;
        if (msg) msg.innerHTML = `<span class="error">❌ You need a block to attack from.</span>`;
        if (info) info.innerHTML = `<strong>Attack Check</strong><br>No attacker block.`;
        return;
      }
  
      const previewPromises = [];
      for (let resourceId = 0; resourceId < 10; resourceId++) {
        previewPromises.push(
          state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resourceId).catch(() => null)
        );
      }
  
      const previews = await Promise.all(previewPromises);
      if (requestId !== state.attackDropdownRequestId) return;
  
      select.innerHTML = "";
      const allowedResources = [];
  
      for (let resourceId = 0; resourceId < 10; resourceId++) {
        const preview = previews[resourceId];
        if (preview && preview.allowed) {
          allowedResources.push(resourceId);
          const opt = document.createElement("option");
          opt.value = resourceId;
          opt.textContent = resourceNames[resourceId];
          select.appendChild(opt);
        }
      }
  
      if (allowedResources.length === 0) {
        resourceNames.forEach((name, id) => {
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = name + " ⚠️";
          select.appendChild(opt);
        });
      }
  
      const previewToShow = allowedResources.length > 0 ? previews[allowedResources[0]] : previews[0];
  
      if (info && previewToShow) {
        let html = `<strong>Attack Check</strong><br>`;
        if (targetOwner.toLowerCase() === state.userAddress.toLowerCase()) {
          html += `<span class="error">⚠️ Cannot attack own block</span>`;
          if (previewDetails) previewDetails.style.display = "none";
        } else {
          html += previewToShow.allowed
            ? `<span class="success">✅ Attack allowed</span><br>`
            : `<span class="error">❌ Attack not allowed (Code ${previewToShow.code})</span><br>`;
  
          html += `Travel time: ${formatDuration(previewToShow.travelTime)}<br>`;
          html += `Steal amount: ${previewToShow.stealAmount.toString()}<br>`;
          html += `Remaining attacks: ${previewToShow.remainingAttacksToday}<br>`;
          html += `Protection: ${previewToShow.protectionLevel}%<br>`;
          html += `Steal %: ${previewToShow.effectiveStealPercent}%<br>`;
          html += `Pending: ${previewToShow.pendingAmount.toString()}`;
        }
        info.innerHTML = html;
  
        if (previewDetails && previewToShow.allowed && targetOwner.toLowerCase() !== state.userAddress.toLowerCase()) {
          previewDetails.style.display = "block";
          previewDetails.innerHTML = `
            <strong>Attack Preview</strong><br>
            From Block #${attackerTokenId} → Target #${targetTokenId}<br>
            Resource: ${resourceNames[previewToShow.resource ?? 0]}<br>
            Steal Amount: ${previewToShow.stealAmount.toString()}<br>
            Travel: ${formatDuration(previewToShow.travelTime)}
          `;
        } else if (previewDetails) {
          previewDetails.style.display = "none";
        }
      }
  
      if (msg) msg.innerHTML = `<span class="success">✅ Target analyzed</span>`;
    } catch (e) {
      console.warn("refreshAttackDropdown error:", e);
      if (requestId !== state.attackDropdownRequestId) return;
      if (msg) msg.innerHTML = `<span class="error">❌ Error analyzing target</span>`;
      if (info) info.innerHTML = `<strong>Attack Check</strong><br>Error: ${e.message}`;
      if (previewDetails) previewDetails.style.display = "none";
    }
  }
  
  /* ==================== ATTACKS ==================== */
  
  async function loadUserAttacks() {
    if (!state.userAddress) return;
  
    try {
      const subgraphAttacks = await loadMyAttacksV6FromSubgraph(state.userAddress);
      const validatedAttacks = [];
  
      for (const a of subgraphAttacks || []) {
        try {
          const targetId = parseInt(a.targetTokenId, 10);
          const attackIdx = parseInt(a.attackIndex, 10);
  
          const onChainAttack = await state.piratesV6Contract.getAttack(targetId, attackIdx);
          const normalized = normalizeAttackTuple(onChainAttack);
  
          if (!normalized.executed && !normalized.cancelled) {
            validatedAttacks.push({
              id: a.id,
              targetTokenId: targetId,
              attackerTokenId: normalized.attackerTokenId,
              attackIndex: attackIdx,
              startTime: normalized.startTime,
              endTime: normalized.endTime,
              executed: normalized.executed,
              cancelled: normalized.cancelled,
              resource: normalized.resource
            });
          }
        } catch (e) {
          console.warn("Skipping invalid attack:", a.id, e.message);
        }
      }
  
      state.userAttacks = validatedAttacks;
      displayUserAttacks();
      refreshBlockMarkings();
      startAttacksTicker();
    } catch (e) {
      console.error("Failed to load attacks:", e);
    }
  }
  
  function displayUserAttacks() {
    const container = byId("userAttacksList");
    if (!container) return;
  
    if (!state.userAddress) {
      container.innerHTML = `<p class="empty-state">Connect wallet to see your attacks.</p>`;
      return;
    }
  
    if (!state.userAttacks.length) {
      container.innerHTML = `<p class="empty-state">No active attacks.</p>`;
      return;
    }
  
    const now = Math.floor(Date.now() / 1000);
  
    container.innerHTML = state.userAttacks.map(attack => {
      const timeLeft = attack.endTime - now;
      return `
        <div class="attack-item" data-endtime="${attack.endTime}" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">
          <div>
            <div><strong>Target #${attack.targetTokenId}</strong> (${resourceNames[attack.resource]})</div>
            <div class="attack-status" data-endtime="${attack.endTime}">
              ${timeLeft <= 0 ? "Ready to execute" : ("⏳ " + formatTime(timeLeft) + " remaining")}
            </div>
          </div>
          <div class="attack-actions">
            ${timeLeft <= 0
          ? `<button class="execute-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">⚔️ Execute</button>`
          : `<button class="execute-btn" disabled>⏳ Waiting</button>`
        }
            <button class="cancel-attack-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}" title="Cancel attack">✖️</button>
          </div>
        </div>
      `;
    }).join("");
  
    document.querySelectorAll(".execute-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const targetTokenId = parseInt(btn.dataset.targetid, 10);
        const attackIndex = parseInt(btn.dataset.attackindex, 10);
        await executeAttack(targetTokenId, attackIndex);
      });
    });
  
    document.querySelectorAll(".cancel-attack-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetTokenId = parseInt(btn.dataset.targetid, 10);
        const attackIndex = parseInt(btn.dataset.attackindex, 10);
        await cancelAttack(targetTokenId, attackIndex);
      });
    });
  }
  
  function startAttacksTicker() {
    if (state.attacksTicker) return;
  
    state.attacksTicker = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
  
      document.querySelectorAll(".attack-status").forEach(el => {
        const endTime = parseInt(el.dataset.endtime || "0", 10);
        if (!endTime) return;
        const timeLeft = endTime - now;
        el.textContent = timeLeft <= 0 ? "Ready to execute" : "⏳ " + formatTime(timeLeft) + " remaining";
      });
  
      document.querySelectorAll(".attack-item").forEach(item => {
        const endTime = parseInt(item.dataset.endtime || "0", 10);
        const executeBtn = item.querySelector(".execute-btn");
        if (!executeBtn) return;
        const timeLeft = endTime - now;
  
        if (timeLeft <= 0) {
          executeBtn.disabled = false;
          executeBtn.textContent = "⚔️ Execute";
        } else {
          executeBtn.disabled = true;
          executeBtn.textContent = "⏳ Waiting";
        }
      });
  
      refreshBlockMarkings();
    }, 1000);
  }
  
  function refreshBlockMarkings() {
    document.querySelectorAll(".block-card").forEach(card => {
      card.classList.remove("attacking", "executable");
    });
  
    const now = Math.floor(Date.now() / 1000);
  
    state.userAttacks.forEach(attack => {
      const card = document.querySelector(`.block-card[data-tokenid="${attack.targetTokenId}"]`);
      if (!card) return;
      if (attack.endTime <= now) card.classList.add("executable");
      else card.classList.add("attacking");
    });
  }
  
  async function executeAttack(targetTokenId, attackIndex) {
    const msgDiv = byId("attackMessage");
    if (!msgDiv) return;
  
    try {
      const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
      const now = Math.floor(Date.now() / 1000);
  
      if (normalized.executed) {
        msgDiv.innerHTML = `<span class="error">❌ Attack already executed.</span>`;
        await loadUserAttacks();
        return;
      }
  
      if (normalized.cancelled) {
        msgDiv.innerHTML = `<span class="error">❌ Attack was cancelled.</span>`;
        await loadUserAttacks();
        return;
      }
  
      if (normalized.endTime > now) {
        msgDiv.innerHTML = `<span class="error">❌ Attack not ready yet. Wait ${formatDuration(normalized.endTime - now)}.</span>`;
        return;
      }
  
      msgDiv.innerHTML = `<span class="success">⏳ Preview execute...</span>`;
  
      const preview = await state.piratesV6Contract.previewExecuteAttack(targetTokenId, attackIndex);
      if (!preview.allowed) {
        msgDiv.innerHTML = `<span class="error">❌ Cannot execute: Code ${preview.code}, steal ${preview.stealAmount.toString()}</span>`;
        return;
      }
  
      const tx = await state.piratesV6Contract.executeAttack(targetTokenId, attackIndex, { gasLimit: 350000 });
      msgDiv.innerHTML = `<span class="success">⏳ Executing...</span>`;
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`;
      await loadUserAttacks();
      await loadResourceBalancesOnchain();
      await updateBalances();
      refreshBlockMarkings();
    } catch (e) {
      console.error("executeAttack error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function cancelAttack(targetTokenId, attackIndex) {
    const msgDiv = byId("attackMessage");
    if (!msgDiv) return;
  
    try {
      const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
      const normalized = normalizeAttackTuple(liveAttack);
  
      if (normalized.attacker.toLowerCase() !== state.userAddress.toLowerCase()) {
        msgDiv.innerHTML = `<span class="error">❌ Not your attack to cancel.</span>`;
        return;
      }
  
      if (normalized.executed) {
        msgDiv.innerHTML = `<span class="error">❌ Cannot cancel executed attack.</span>`;
        await loadUserAttacks();
        return;
      }
  
      if (normalized.cancelled) {
        msgDiv.innerHTML = `<span class="error">❌ Attack already cancelled.</span>`;
        await loadUserAttacks();
        return;
      }
  
      msgDiv.innerHTML = `<span class="success">⏳ Cancelling attack...</span>`;
      const tx = await state.piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, { gasLimit: 300000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Attack cancelled.</span>`;
      await loadUserAttacks();
      refreshBlockMarkings();
    } catch (e) {
      console.error("cancelAttack error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== FARMING ==================== */
  
  async function startFarmingSelected() {
    if (!state.selectedBlock) return;
    const msgDiv = byId("actionMessage");
  
    try {
      msgDiv.innerHTML = `<span class="success">⏳ Starting V6 farming...</span>`;
      const tx = await state.farmingV6Contract.startFarming(state.selectedBlock.tokenId, { gasLimit: 500000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ V6 farming started.</span>`;
      await loadUserBlocks();
      await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
    } catch (e) {
      console.error(e);
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function stopFarmingSelected() {
    if (!state.selectedBlock) return;
    const msgDiv = byId("actionMessage");
  
    try {
      msgDiv.innerHTML = `<span class="success">⏳ Stopping V6 farming...</span>`;
      const tx = await state.farmingV6Contract.stopFarming(state.selectedBlock.tokenId, { gasLimit: 500000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">⏹️ Farming stopped.</span>`;
      await loadUserBlocks();
      await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function claimSelected() {
    if (!state.selectedBlock) return;
    const msgDiv = byId("actionMessage");
  
    try {
      const preview = await state.farmingV6Contract.previewClaim(state.selectedBlock.tokenId);
      if (!preview.allowed) {
        msgDiv.innerHTML = `<span class="error">❌ Claim not ready. Code ${preview.code}. Wait ${formatDuration(preview.secondsRemaining)}.</span>`;
        return;
      }
  
      const pending = await state.farmingV6Contract.getAllPending(state.selectedBlock.tokenId);
      let total = ethers.BigNumber.from(0);
      for (let i = 0; i < pending.length; i++) {
        total = total.add(pending[i]);
      }
  
      if (total.isZero()) {
        msgDiv.innerHTML = `<span class="error">❌ Nothing to claim.</span>`;
        return;
      }
  
      msgDiv.innerHTML = `<span class="success">⏳ Claiming resources... ${total.toString()} total</span>`;
      const tx = await state.farmingV6Contract.claimResources(state.selectedBlock.tokenId, { gasLimit: 700000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">💰 Resources claimed!</span>`;
      await loadResourceBalancesOnchain();
      await loadUserBlocks();
      await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function buyBoost() {
    if (!state.selectedBlock) return alert("No block selected.");
  
    const days = parseInt(byId("boostDays")?.value, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      alert("Please enter valid days (1-30)");
      return;
    }
  
    const msgDiv = byId("actionMessage");
  
    try {
      msgDiv.innerHTML = `<span class="success">⏳ Buying boost for ${days} days...</span>`;
      const tx = await state.farmingV6Contract.buyBoost(state.selectedBlock.tokenId, days, { gasLimit: 300000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Boost activated for ${days} days!</span>`;
      await loadUserBlocks();
      await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== ATTACK START ==================== */
  
  async function attack() {
    const attackRowEl = byId("attackRow");
    const attackColEl = byId("attackCol");
    const msgDiv = byId("attackMessage");
  
    if (!attackRowEl || !attackColEl) {
      if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ Attack inputs not found.</span>`;
      return;
    }
  
    const targetRow = parseInt(attackRowEl.value, 10);
    const targetCol = parseInt(attackColEl.value, 10);
  
    if (!Number.isFinite(targetRow) || !Number.isFinite(targetCol)) {
      alert("Enter target coordinates");
      return;
    }
  
    const targetTokenId = targetRow * 2048 + targetCol;
  
    try {
      const owner = await state.nftContract.ownerOf(targetTokenId);
      if (owner.toLowerCase() === state.userAddress.toLowerCase()) {
        msgDiv.innerHTML = `<span class="error">❌ You cannot attack your own block.</span>`;
        return;
      }
    } catch {
      msgDiv.innerHTML = `<span class="error">❌ Target block does not exist.</span>`;
      return;
    }
  
    const attackerTokenId = await getValidAttackerTokenId();
    if (!attackerTokenId) {
      msgDiv.innerHTML = `<span class="error">❌ No valid attacker block found.</span>`;
      return;
    }
  
    const resource = parseInt(byId("attackResourceSelect")?.value, 10);
    if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
      msgDiv.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
      return;
    }
  
    try {
      msgDiv.innerHTML = `<span class="success">⏳ Preview attack...</span>`;
  
      const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resource);
      if (!preview.allowed) {
        msgDiv.innerHTML = `<span class="error">❌ Attack not allowed: Code ${preview.code}</span>`;
        return;
      }
  
      msgDiv.innerHTML = `
        <span class="success">
          ⏳ Starting attack...<br>
          Travel time: ${formatDuration(preview.travelTime)}<br>
          Steal amount: ${preview.stealAmount.toString()}<br>
          Remaining today: ${preview.remainingAttacksToday}
        </span>
      `;
  
      const tx = await state.piratesV6Contract.startAttack(attackerTokenId, targetTokenId, resource, { gasLimit: 450000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Attack started! Check back later.</span>`;
      await loadUserAttacks();
      refreshBlockMarkings();
    } catch (e) {
      console.error("startAttack error:", e);
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== PROTECT ==================== */
  
  async function protect() {
    const tokenId = parseInt(byId("protectTokenId")?.value, 10);
    const level = parseInt(byId("protectLevel")?.value, 10);
    const msgDiv = byId("protectMessage");
  
    if (isNaN(tokenId) || isNaN(level)) return alert("Invalid input");
  
    try {
      msgDiv.innerHTML = `<span class="success">⏳ Hiring mercenaries...</span>`;
  
      const owner = await state.nftContract.ownerOf(tokenId);
      if (owner.toLowerCase() !== state.userAddress.toLowerCase()) {
        msgDiv.innerHTML = `<span class="error">❌ Not your block.</span>`;
        return;
      }
  
      const cost = level * 10;
      const amount = ethers.utils.parseEther(cost.toString());
      const allowance = await state.inpiContract.allowance(state.userAddress, MERCENARY_V2_ADDRESS);
  
      if (allowance.lt(amount)) {
        const approveTx = await state.inpiContract.approve(MERCENARY_V2_ADDRESS, amount);
        await approveTx.wait();
      }
  
      const tx = await state.mercenaryV2Contract.hireMercenaries(tokenId, level, { gasLimit: 400000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Protection active for 3.14 days.</span>`;
      await loadUserBlocks();
      if (state.selectedBlock && String(state.selectedBlock.tokenId) === String(tokenId)) {
        await selectBlock(state.selectedBlock.tokenId, state.selectedBlock.row, state.selectedBlock.col);
      }
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== REVEAL ==================== */
  
  async function revealSelected() {
    if (!state.selectedBlock) return alert("No block selected.");
  
    const { tokenId, row, col } = state.selectedBlock;
    const msgDiv = byId("actionMessage");
    if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Loading proofs...</span>`;
  
    try {
      const response = await fetch(`${WORKER_URL}/api/get-proof?row=${row}&col=${col}`);
      if (!response.ok) throw new Error("Proofs not found");
  
      const proofs = await response.json();
  
      const formatProof = (arr) => arr.map(item => {
        const v = item.left ? item.left : item.right;
        return v.startsWith("0x") ? v : ("0x" + v);
      });
  
      const piProof = formatProof(proofs.pi.proof);
      const phiProof = formatProof(proofs.phi.proof);
  
      const tx = await state.nftContract.revealBlock(
        tokenId,
        piProof,
        phiProof,
        proofs.pi.digit,
        proofs.phi.digit,
        { gasLimit: 800000 }
      );
  
      if (msgDiv) msgDiv.innerHTML = `<span class="success">⏳ Revealing...</span>`;
      await tx.wait();
  
      if (msgDiv) msgDiv.innerHTML = `<span class="success">✅ Block revealed! 🎉</span>`;
      await loadUserBlocks();
      await selectBlock(tokenId, row, col);
    } catch (e) {
      if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ ${e.message}</span>`;
    }
  }
  
  /* ==================== MINT ==================== */
  
  async function findRandomFreeBlock() {
    const msgDiv = byId("mintMessage");
  
    if (!state.userAddress || !state.nftContract) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
      return;
    }
  
    if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Searching a free block...</div>`;
  
    const MAX_ATTEMPTS = 80;
  
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const row = Math.floor(Math.random() * (MAX_ROW + 1));
      const col = Math.floor(Math.random() * (2 * row + 1));
      const tokenId = row * 2048 + col;
  
      try {
        await state.nftContract.ownerOf(tokenId);
      } catch {
        byId("row").value = row;
        byId("col").value = col;
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">✅ Free block found: Row ${row}, Col ${col}. You can mint now.</div>`;
        return;
      }
    }
  
    if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Could not find a free block fast. Try again or pick manually.</div>`;
  }
  
  async function mintBlock() {
    const msgDiv = byId("mintMessage");
  
    if (!state.userAddress || !state.nftContract) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Please connect wallet first.</div>`;
      return;
    }
  
    const row = parseInt(byId("row")?.value, 10);
    const col = parseInt(byId("col")?.value, 10);
  
    if (Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > MAX_ROW || col < 0 || col > (2 * row)) {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Invalid coordinates.</div>`;
      return;
    }
  
    const tokenId = row * 2048 + col;
  
    try {
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Checking block availability...</div>`;
  
      try {
        await state.nftContract.ownerOf(tokenId);
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ This block is already minted.</div>`;
        return;
      } catch {
        // free
      }
  
      let tx;
  
      if (state.selectedPayment === "eth") {
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with ETH...</div>`;
        tx = await state.nftContract.mintWithETH(row, col, {
          value: ethers.utils.parseEther(PRICE_ETH)
        });
      } else if (state.selectedPayment === "inpi") {
        const amount = ethers.utils.parseEther(PRICE_INPI);
        const bal = await state.inpiContract.balanceOf(state.userAddress);
        if (bal.lt(amount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance.</div>`;
          return;
        }
  
        const allowance = await state.inpiContract.allowance(state.userAddress, NFT_ADDRESS);
        if (allowance.lt(amount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Approving INPI...</div>`;
          const approveTx = await state.inpiContract.approve(NFT_ADDRESS, amount);
          await approveTx.wait();
        }
  
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting with INPI...</div>`;
        tx = await state.nftContract.mintWithINPI(row, col);
      } else if (state.selectedPayment === "mixed") {
        const ethAmount = ethers.utils.parseEther(PRICE_ETH_MIXED);
        const inpiAmount = ethers.utils.parseEther(PRICE_INPI_MIXED);
  
        const bal = await state.inpiContract.balanceOf(state.userAddress);
        if (bal.lt(inpiAmount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Insufficient INPI balance for mixed payment.</div>`;
          return;
        }
  
        const allowance = await state.inpiContract.allowance(state.userAddress, NFT_ADDRESS);
        if (allowance.lt(inpiAmount)) {
          if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Approving INPI...</div>`;
          const approveTx = await state.inpiContract.approve(NFT_ADDRESS, inpiAmount);
          await approveTx.wait();
        }
  
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Minting (Mixed)...</div>`;
        tx = await state.nftContract.mintMixed(row, col, { value: ethAmount });
      } else {
        if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ Unknown payment method.</div>`;
        return;
      }
  
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">⏳ Transaction sent: ${tx.hash.slice(0, 10)}...</div>`;
      await tx.wait();
  
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box success">✅ Block minted! 🎉</div>`;
  
      await updateBalances();
      await loadResourceBalancesOnchain();
      await loadUserBlocks();
  
      setTimeout(() => {
        loadUserAttacks();
      }, 1200);
    } catch (e) {
      console.error("Mint error:", e);
      if (msgDiv) msgDiv.innerHTML = `<div class="message-box error">❌ ${e.reason || e.message || "Unknown error"}</div>`;
    }
  }
  
  /* ==================== EXCHANGE ==================== */
  
  async function exchangeINPI() {
    const msgDiv = byId("exchangeMessage");
    if (!state.userAddress) {
      msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
      return;
    }
  
    const inpiAmount = parseFloat(byId("inpiAmount")?.value);
    if (isNaN(inpiAmount) || inpiAmount <= 0) return alert("Invalid amount");
  
    try {
      const amountWei = ethers.utils.parseEther(inpiAmount.toString());
      const inpiBal = await state.inpiContract.balanceOf(state.userAddress);
      if (inpiBal.lt(amountWei)) throw new Error("Insufficient INPI balance");
  
      const allowance = await state.inpiContract.allowance(state.userAddress, PITRONE_ADDRESS);
      if (allowance.lt(amountWei)) {
        msgDiv.innerHTML = `<span class="success">⏳ Approving INPI...</span>`;
        const approveTx = await state.inpiContract.approve(PITRONE_ADDRESS, amountWei);
        await approveTx.wait();
      }
  
      msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
      const tx = await state.pitroneContract.exchangeINPI(amountWei, { gasLimit: 400000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
      await updateBalances();
      await updatePoolInfo();
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  async function exchangePit() {
    const msgDiv = byId("exchangeMessage");
    if (!state.userAddress) {
      msgDiv.innerHTML = `<span class="error">❌ Connect wallet first.</span>`;
      return;
    }
  
    const pitAmount = parseFloat(byId("pitAmount")?.value);
    if (isNaN(pitAmount) || pitAmount <= 0) return alert("Invalid amount");
  
    try {
      const amountWei = ethers.utils.parseEther(pitAmount.toString());
      msgDiv.innerHTML = `<span class="success">⏳ Exchanging...</span>`;
      const tx = await state.pitroneContract.exchangePitrone(amountWei, { gasLimit: 400000 });
      await tx.wait();
  
      msgDiv.innerHTML = `<span class="success">✅ Exchange successful!</span>`;
      await updateBalances();
      await updatePoolInfo();
    } catch (e) {
      msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
    }
  }
  
  /* ==================== WALLET ==================== */
  
  async function connectWallet(forceRequest = true) {
    if (state.isConnecting) return;
    state.isConnecting = true;
  
    try {
      const ok = await connectWalletCore(forceRequest);
      if (!ok) return;
  
      localStorage.setItem(STORAGE_WALLET_FLAG, "1");
      setWalletUIConnected(state.userAddress);
  
      initAttackResourceSelect();
  
      await updateBalances();
      await updatePoolInfo();
      await loadResourceBalancesOnchain();
      await loadUserBlocks();
      await loadUserAttacks();
  
      if (!state.attacksPoller) {
        state.attacksPoller = setInterval(async () => {
          if (!state.userAddress) return;
          await loadUserAttacks();
          refreshBlockMarkings();
        }, 45000);
      }
  
      debugLog("Wallet connected", state.userAddress);
    } catch (e) {
      console.error(e);
      alert("Connection error: " + (e.reason || e.message));
      clearContracts();
      setWalletUIDisconnected();
    } finally {
      state.isConnecting = false;
    }
  }
  
  function disconnectWallet() {
    localStorage.removeItem(STORAGE_WALLET_FLAG);
  
    if (state.attacksTicker) clearInterval(state.attacksTicker);
    if (state.attacksPoller) clearInterval(state.attacksPoller);
    state.attacksTicker = null;
    state.attacksPoller = null;
  
    clearContracts();
    setWalletUIDisconnected();
    debugLog("Wallet disconnected");
  }
  
  /* ==================== EVENT BINDING ==================== */
  
  function bindEvents() {
    byId("connectWallet")?.addEventListener("click", () => connectWallet(true));
    byId("disconnectWallet")?.addEventListener("click", disconnectWallet);
  
    byId("attackBtn")?.addEventListener("click", attack);
    byId("protectBtn")?.addEventListener("click", protect);
    byId("revealBtn")?.addEventListener("click", revealSelected);
    byId("farmingStartBtn")?.addEventListener("click", startFarmingSelected);
    byId("farmingStopBtn")?.addEventListener("click", stopFarmingSelected);
    byId("claimBtn")?.addEventListener("click", claimSelected);
    byId("buyBoostBtn")?.addEventListener("click", buyBoost);
    byId("confirmBoostBtn")?.addEventListener("click", buyBoost);
  
    byId("exchangeInpiBtn")?.addEventListener("click", exchangeINPI);
    byId("exchangePitBtn")?.addEventListener("click", exchangePit);
    byId("randomBlockBtn")?.addEventListener("click", findRandomFreeBlock);
    byId("mintBtn")?.addEventListener("click", mintBlock);
  
    byId("attackRow")?.addEventListener("input", scheduleAttackDropdownRefresh);
    byId("attackCol")?.addEventListener("input", scheduleAttackDropdownRefresh);
  
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.selectedPayment = e.target.value;
      });
    });
  }
  
  function bindEthereumEvents() {
    if (!window.ethereum || window.ethereum.__inpinityBound) return;
  
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (!accounts || !accounts.length) {
        disconnectWallet();
        return;
      }
      if (state.userAddress && accounts[0].toLowerCase() !== state.userAddress.toLowerCase()) {
        disconnectWallet();
        await connectWallet(false);
      }
    });
  
    window.ethereum.on("chainChanged", () => window.location.reload());
    window.ethereum.__inpinityBound = true;
  }
  
  /* ==================== INIT ==================== */
  
  (function initGamePage() {
    setWalletUIDisconnected();
    initAttackResourceSelect();
    bindEvents();
    bindEthereumEvents();
  
    const shouldReconnect = localStorage.getItem(STORAGE_WALLET_FLAG) === "1";
    if (shouldReconnect) connectWallet(false);
  })();