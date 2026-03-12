/* =========================================================
   BLOCKS – V6 + MERCENARY V4
   ========================================================= */

   import {
    state,
    setSelectedBlockState,
    resetSelectedBlockUiState
  } from "./state.js";
  
  import { rarityNames } from "./config.js";
  import {
    byId,
    safeText,
    safeValue,
    safeDisabled,
    formatDuration,
    getProduction
  } from "./utils.js";
  
  import {
    loadMyTokensFromSubgraph,
    loadMyFarmsV6FromSubgraph,
    loadMercenaryTokenProtectionsV4,
    buildFarmV6Map,
    buildProtectionMapV4
  } from "./subgraph.js";
  
  import { isTokenActiveOnV5, getFarmingV5Contract } from "./migration.js";
  
  /* =========================================================
     HELPERS
     ========================================================= */
  
  function setButtonVisualState(buttonId, enabled) {
    const el = byId(buttonId);
    if (!el) return;
    el.disabled = !enabled;
    el.style.opacity = enabled ? "1" : "0.45";
    el.style.pointerEvents = enabled ? "auto" : "none";
  }
  
  function setSelectOptionState(selectId, optionValue, enabled, enabledLabel, disabledLabel) {
    const select = byId(selectId);
    if (!select) return;
  
    const option = Array.from(select.options).find((o) => String(o.value) === String(optionValue));
    if (!option) return;
  
    option.disabled = !enabled;
    option.textContent = enabled ? enabledLabel : disabledLabel;
  }
  
  function updateMercenarySlotDropdown(unlockedSlots = 1) {
    const slotSelect = byId("protectSlotIndex");
    if (!slotSelect) return;
  
    const slots = Number(unlockedSlots || 1);
  
    setSelectOptionState("protectSlotIndex", 0, true, "Slot 1", "Slot 1");
    setSelectOptionState("protectSlotIndex", 1, slots >= 2, "Slot 2", "Slot 2 (locked)");
    setSelectOptionState("protectSlotIndex", 2, slots >= 3, "Slot 3", "Slot 3 (locked)");
  
    if (Number(slotSelect.value) === 1 && slots < 2) slotSelect.value = "0";
    if (Number(slotSelect.value) === 2 && slots < 3) slotSelect.value = "0";
  
    safeText("protectSlotInfo", `Selected Slot: ${Number(slotSelect.value) + 1}`);
  
    const lockHint = byId("mercenarySlotLockHint");
    if (lockHint) {
      if (slots >= 3) {
        lockHint.textContent = "All 3 protection slots are unlocked.";
      } else if (slots === 2) {
        lockHint.textContent = "Slot 3 remains locked until unlocked permanently.";
      } else {
        lockHint.textContent = "Slot 2 and Slot 3 remain locked until unlocked permanently.";
      }
    }
  }
  
  function updateBastionTitleLock(points = 0) {
    const canSetTitle = Number(points || 0) >= 1000;
  
    const input = byId("bastionTitleInput");
    const button = byId("saveBastionTitleBtn");
    const hint = byId("bastionTitleHint");
    const unlockState = byId("bastionTitleUnlockState");
  
    if (input) {
      input.disabled = !canSetTitle;
      input.style.opacity = canSetTitle ? "1" : "0.55";
    }
  
    if (button) {
      button.disabled = !canSetTitle;
      button.style.opacity = canSetTitle ? "1" : "0.45";
      button.style.pointerEvents = canSetTitle ? "auto" : "none";
    }
  
    if (hint) {
      hint.textContent = canSetTitle
        ? "Unlocked. You can now save a Bastion / Clan Title."
        : `Locked until you reach 1000 Defender Points. Current: ${Number(points || 0)}.`;
    }
  
    if (unlockState) {
      unlockState.textContent = canSetTitle
        ? "Unlocked at 1000+ Defender Points"
        : "Locked until 1000 Defender Points";
    }
  
    state.uiBlockStatus.defenderPoints = Number(points || 0);
    state.uiBlockStatus.canSetBastionTitle = canSetTitle;
  }
  
  function updateActionHints({
    revealed,
    farmingActive,
    activeOnV5,
    claimReady,
    claimText,
    boostActive
  }) {
    safeText("revealStatus", revealed ? "Revealed" : "Hidden");
    safeText("farmingStatus", farmingActive ? "Active (V6)" : (activeOnV5 ? "Active (V5)" : "Inactive"));
    safeText("claimStatus", claimText || "—");
    safeText("boostStatus", boostActive ? "Active" : "Inactive");
  
    safeText(
      "revealHint",
      revealed
        ? "This block is already revealed."
        : "Hidden blocks can be revealed once."
    );
  
    safeText(
      "farmingHint",
      farmingActive
        ? "This block is currently farming on V6."
        : activeOnV5
          ? "This block is still active on V5 and can be migrated."
          : "Start farming on your selected block."
    );
  
    safeText(
      "claimHint",
      claimReady
        ? "Claim is ready."
        : claimText && claimText !== "—"
          ? `Claim not ready yet: ${claimText}`
          : "Claim becomes available when the cooldown is finished."
    );
  }
  
  async function getCurrentUnlockedSlots() {
    try {
      if (!state.userAddress || !state.mercenaryV4Contract) return 1;
  
      if (typeof state.mercenaryV4Contract.unlockedSlots === "function") {
        const v = await state.mercenaryV4Contract.unlockedSlots(state.userAddress);
        return Math.max(1, Number(v || 1));
      }
  
      if (typeof state.mercenaryV4Contract.getWalletSlots === "function") {
        const slots = await state.mercenaryV4Contract.getWalletSlots(state.userAddress);
        if (Array.isArray(slots)) {
          return Math.max(1, slots.length);
        }
      }
    } catch {}
  
    return 1;
  }
  
  async function getDefenderPoints() {
    try {
      if (!state.userAddress || !state.mercenaryV4Contract) return 0;
  
      if (typeof state.mercenaryV4Contract.getDefenderProfile === "function") {
        const profile = await state.mercenaryV4Contract.getDefenderProfile(state.userAddress);
        return Number(profile?.defenderPoints || 0);
      }
  
      if (typeof state.mercenaryV4Contract.defenderProfiles === "function") {
        const profile = await state.mercenaryV4Contract.defenderProfiles(state.userAddress);
        return Number(profile?.defenderPoints || 0);
      }
    } catch {}
  
    return Number(state.uiBlockStatus?.defenderPoints || 0);
  }
  
  /* =========================================================
     LOAD USER BLOCKS
     ========================================================= */
  
  export async function loadUserBlocks({ onRevealSelected, onRefreshBlockMarkings } = {}) {
    if (!state.userAddress || !state.nftContract) return;
  
    const grid = byId("blocksGrid");
    if (!grid) return;
  
    try {
      const subgraphTokens = await loadMyTokensFromSubgraph(state.userAddress);
      const subgraphFarmsV6 = await loadMyFarmsV6FromSubgraph(state.userAddress);
      const subgraphProtections = await loadMercenaryTokenProtectionsV4();
  
      state.cachedFarmsV6 = subgraphFarmsV6 || [];
      state.cachedProtectionsV4 = subgraphProtections || [];
      state.cachedFarmV6Map = buildFarmV6Map(state.cachedFarmsV6);
      state.cachedProtectionMapV4 = buildProtectionMapV4(state.cachedProtectionsV4);
      state.userBlocks = (subgraphTokens || []).map((t) => String(t.id));
  
      if (!state.userBlocks.length) {
        grid.innerHTML = `<p class="empty-state">You don’t own any blocks yet.</p>`;
        safeText("activeFarms", "0");
        return;
      }
  
      const v5States = await Promise.all(
        state.userBlocks.map((tokenId) => isTokenActiveOnV5(tokenId).catch(() => false))
      );
  
      const v5Map = new Map();
      state.userBlocks.forEach((tokenId, idx) => {
        v5Map.set(String(tokenId), !!v5States[idx]);
      });
  
      let html = "";
      let activeFarmsCount = 0;
      let activeV5Count = 0;
      const now = Math.floor(Date.now() / 1000);
  
      for (const token of subgraphTokens) {
        const tokenId = String(token.id);
        let row = 0;
        let col = 0;
        const revealed = !!token.revealed;
        let rarityName = "";
  
        try {
          const pos = await state.nftContract.getBlockPosition(tokenId);
          row = Number(pos.row);
          col = Number(pos.col);
        } catch {}
  
        let rarity = null;
        if (revealed) {
          try {
            rarity = Number(await state.nftContract.calculateRarity(tokenId));
            rarityName = rarityNames[rarity] || "";
          } catch {}
        }
  
        const farm = state.cachedFarmV6Map.get(tokenId);
        const farmingActive = !!(farm && farm.active);
        if (farmingActive) activeFarmsCount++;
  
        const activeOnV5 = v5Map.get(tokenId);
        if (activeOnV5) activeV5Count++;
  
        const protection = state.cachedProtectionMapV4.get(tokenId);
        const protectionActive = !!(protection && protection.active && Number(protection.expiresAt) > now);
  
        let classNames = revealed ? "revealed" : "hidden";
        if (farmingActive) classNames += " farming";
        if (activeOnV5 && !farmingActive) classNames += " legacy-farming";
        if (protectionActive) classNames += " protected";
        if (state.selectedBlock && String(state.selectedBlock.tokenId) === tokenId) classNames += " selected";
  
        const badge = revealed
          ? `<div class="rarity-badge ${String(rarityName || "").toLowerCase()}">${rarityName}</div>`
          : `<div class="rarity-badge hidden-badge">🔒 Hidden</div>`;
  
        const legacyBadge = activeOnV5 && !farmingActive
          ? `<div class="rarity-badge" style="background:#8a5cff; color:white; margin-top:4px;">V5 Active</div>`
          : "";
  
        const protectionBadge = protectionActive
          ? `<div class="rarity-badge" style="background:#6f42c1; color:white; margin-top:4px;">🛡️ ${protection.level}% Protected</div>`
          : "";
  
        const farmDurationLine = farmingActive && Number(farm?.startTime) > 0
          ? `<div class="farm-duration">⏱️ Farming: ${formatDuration(now - Number(farm.startTime))}</div>`
          : "";
  
        const revealButton = !revealed
          ? `<button class="reveal-block-btn" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">🔓 Reveal</button>`
          : "";
  
        html += `
          <div class="block-card ${classNames}" data-tokenid="${tokenId}" data-row="${row}" data-col="${col}">
            <div class="block-id">#${tokenId}</div>
            <div>R${row} C${col}</div>
            ${badge}
            ${legacyBadge}
            ${protectionBadge}
            ${farmDurationLine}
            ${revealButton}
          </div>
        `;
      }
  
      grid.innerHTML = html;
      safeText("activeFarms", String(activeFarmsCount));
  
      const migrateAllBtn = byId("migrateAllV5Btn");
      if (migrateAllBtn) {
        migrateAllBtn.style.display = activeV5Count > 0 ? "inline-block" : "none";
        if (activeV5Count > 0) {
          migrateAllBtn.textContent = `🔄 Migrate ${activeV5Count} V5 Farm${activeV5Count > 1 ? "s" : ""} to V6`;
        }
      }
  
      document.querySelectorAll(".block-card").forEach((card) => {
        card.addEventListener("click", async (e) => {
          if (e.target.classList.contains("reveal-block-btn")) return;
          await selectBlock(card.dataset.tokenid, card.dataset.row, card.dataset.col);
        });
      });
  
      document.querySelectorAll(".reveal-block-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const tokenId = btn.dataset.tokenid;
          const row = btn.dataset.row;
          const col = btn.dataset.col;
          await selectBlock(tokenId, row, col);
          if (typeof onRevealSelected === "function") {
            await onRevealSelected();
          }
        });
      });
  
      if (typeof onRefreshBlockMarkings === "function") {
        onRefreshBlockMarkings();
      }
    } catch (e) {
      console.error("loadUserBlocks error:", e);
      grid.innerHTML = `<p class="error">Failed to load blocks.</p>`;
    }
  }
  
  /* =========================================================
     SELECT BLOCK
     ========================================================= */
  
  export async function selectBlock(tokenId, row, col) {
    const now = Math.floor(Date.now() / 1000);
    resetSelectedBlockUiState();
  
    let revealed = false;
    let rarity = null;
  
    try {
      const tokenData = await state.nftContract.blockData(tokenId);
      revealed = !!tokenData.revealed;
    } catch {}
  
    if (revealed) {
      try {
        rarity = Number(await state.nftContract.calculateRarity(tokenId));
      } catch {}
    }
  
    const farm = state.cachedFarmV6Map.get(String(tokenId));
    const farmingActive = !!(farm && farm.active);
    const farmStartTime = farm ? Number(farm.startTime || 0) : 0;
    const boostExpiry = farm ? Number(farm.boostExpiry || 0) : 0;
    const boostActive = boostExpiry > now;
  
    const protection = state.cachedProtectionMapV4.get(String(tokenId));
    const protectionLevel = protection ? Number(protection.level || 0) : 0;
    const protectionTier = protection ? Number(protection.tier || 0) : 0;
    const protectionSlotIndex = protection ? Number(protection.slotIndex || 0) : 0;
    const protectionExpiresAt = protection ? Number(protection.expiresAt || 0) : 0;
    const protectionActive = !!(protection && protection.active && protectionExpiresAt > now);
  
    const activeOnV5 = await isTokenActiveOnV5(tokenId).catch(() => false);
  
    const selectedBlock = {
      tokenId: String(tokenId),
      row: Number(row),
      col: Number(col),
      revealed,
      rarity,
      farmingActive,
      protectionLevel,
      protectionTier,
      protectionSlotIndex,
      protectionExpiresAt,
      protectionActive,
      farmStartTime,
      boostExpiry,
      activeOnV5
    };
  
    setSelectedBlockState(selectedBlock);
  
    const unlockedSlots = await getCurrentUnlockedSlots();
    const defenderPoints = await getDefenderPoints();
  
    state.uiBlockStatus.isOwner = true;
    state.uiBlockStatus.isRevealed = revealed;
    state.uiBlockStatus.farmActive = farmingActive;
    state.uiBlockStatus.farmLegacyActive = activeOnV5;
    state.uiBlockStatus.protectionActive = protectionActive;
    state.uiBlockStatus.protectionSlotCount = unlockedSlots;
    state.uiBlockStatus.selectedProtectionSlot = protectionSlotIndex;
    state.uiBlockStatus.canUseSlot2 = unlockedSlots >= 2;
    state.uiBlockStatus.canUseSlot3 = unlockedSlots >= 3;
    state.uiBlockStatus.canBuyFarmBoost = farmingActive;
    state.uiBlockStatus.canAttackFromSelectedBlock = true;
  
    const blockActionsContainer = byId("blockActionsContainer");
    const noBlockSelected = byId("noBlockSelected");
    const selectedBlockInfo = byId("selectedBlockInfo");
    const migrateBtn = byId("migrateFarmBtn");
  
    if (blockActionsContainer) blockActionsContainer.style.display = "block";
    if (selectedBlockInfo) selectedBlockInfo.style.display = "block";
    if (noBlockSelected) noBlockSelected.style.display = "none";
  
    if (migrateBtn) {
      if (activeOnV5 && !farmingActive) {
        migrateBtn.style.display = "inline-block";
        migrateBtn.disabled = false;
        migrateBtn.style.opacity = "1";
        migrateBtn.style.pointerEvents = "auto";
      } else {
        migrateBtn.style.display = "none";
      }
    }
  
    const farmDur = (farmingActive && farmStartTime > 0)
      ? ` · ⏱️ ${formatDuration(now - farmStartTime)}`
      : "";
  
    safeText("selectedBlockText", `Block #${tokenId} (R${row}, C${col})${farmDur}`);
    safeText("selectedActionToken", `Block #${tokenId}`);
    safeValue("protectTokenId", tokenId);
  
    let claimReady = false;
    let claimText = "—";
    let claimCooldownSeconds = 0;
  
    if (farmingActive) {
      try {
        const preview = await state.farmingV6Contract.previewClaim(tokenId);
        claimReady = !!preview?.allowed;
        claimCooldownSeconds = Number(preview?.secondsRemaining || 0);
        claimText = claimReady ? "Ready (V6)" : `V6 in ${formatDuration(claimCooldownSeconds)}`;
      } catch {
        claimText = "—";
      }
    } else if (activeOnV5) {
      try {
        const v5 = getFarmingV5Contract();
        const preview = await v5.previewClaim(tokenId);
        claimReady = !!preview?.allowed;
        claimCooldownSeconds = Number(preview?.secondsRemaining || 0);
        claimText = claimReady ? "Ready (V5)" : `V5 in ${formatDuration(claimCooldownSeconds)}`;
      } catch {
        claimText = "—";
      }
    }
  
    state.uiBlockStatus.claimReady = claimReady;
    state.uiBlockStatus.claimCooldownSeconds = claimCooldownSeconds;
    state.uiBlockStatus.canStartFarm = !farmingActive && !activeOnV5;
    state.uiBlockStatus.canStopFarm = !!farmingActive;
    state.uiBlockStatus.canClaim = !!(claimReady && (farmingActive || activeOnV5));
  
    updateActionHints({
      revealed,
      farmingActive,
      activeOnV5,
      claimReady,
      claimText,
      boostActive
    });
  
    setButtonVisualState("revealBtn", !revealed);
    setButtonVisualState("farmingStartBtn", !farmingActive && !activeOnV5);
    setButtonVisualState("farmingStopBtn", !!farmingActive);
    setButtonVisualState("claimBtn", !!(claimReady && (farmingActive || activeOnV5)));
    setButtonVisualState("buyBoostBtn", !!farmingActive);
    setButtonVisualState("attackBtn", true);
    setButtonVisualState("buyPirateBoostBtn", true);
  
    const protectionStatusEl = byId("protectionStatus");
    const protectionExpiryEl = byId("protectionExpiry");
    const protectionStatusText = byId("protectionStatusText");
  
    if (protectionStatusText) {
      protectionStatusText.textContent = protectionActive
        ? `${protectionLevel}% Active`
        : "Inactive";
    }
  
    if (protectionActive && protectionExpiryEl) {
      protectionExpiryEl.textContent = formatDuration(protectionExpiresAt - now);
      if (protectionStatusEl) protectionStatusEl.style.display = "block";
    } else if (protectionStatusEl) {
      protectionStatusEl.style.display = "none";
    }
  
    updateMercenarySlotDropdown(unlockedSlots);
    updateBastionTitleLock(defenderPoints);
  
    const resDiv = byId("blockResources");
    if (resDiv) {
      if (revealed && rarity !== null) {
        const production = getProduction(rarity, Number(row));
        let h = "";
  
        for (const [res, amount] of Object.entries(production)) {
          h += `<div class="resource-item">${res}: ${amount}/day</div>`;
        }
  
        if (protectionActive) {
          h += `<div class="resource-item">Protection: ${protectionLevel}%</div>`;
          h += `<div class="resource-item">Protection Tier: ${protectionTier}</div>`;
          h += `<div class="resource-item">Protection Slot: ${protectionSlotIndex + 1}</div>`;
        }
  
        if (boostActive) {
          h += `<div class="resource-item">Boost: active</div>`;
        }
  
        if (activeOnV5 && !farmingActive) {
          h += `<div class="resource-item" style="color:#8a5cff;">⚠️ V5 active - migrate to V6</div>`;
        }
  
        resDiv.innerHTML = h;
      } else {
        resDiv.innerHTML = "<p>Reveal block to see resources.</p>";
      }
    }
  
    document.querySelectorAll(".block-card").forEach((c) => c.classList.remove("selected"));
    const sel = document.querySelector(`.block-card[data-tokenid="${tokenId}"]`);
    if (sel) sel.classList.add("selected");
  }