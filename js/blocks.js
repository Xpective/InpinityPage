/* =========================================================
   BLOCKS – V6 + MERCENARY V4
   LIGHT GRID VERSION
   - Grid stays cheap and stable
   - Heavy per-block reads only happen on select
   ========================================================= */

   import {
    state,
    setSelectedBlockState,
    resetSelectedBlockUiState
  } from "./state.js";
  
  import {
    getMercenaryRankLabel,
    getMercenaryDiscountPercent,
    getMercenaryNextRankThreshold
  } from "./config.js";
  
  import {
    byId,
    safeText,
    safeValue,
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
     LIVE CLAIM TIMER
     ========================================================= */
  
  let selectedBlockClaimTicker = null;
  
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
  
    const option = Array.from(select.options).find(
      (o) => String(o.value) === String(optionValue)
    );
    if (!option) return;
  
    option.disabled = !enabled;
    option.textContent = enabled ? enabledLabel : disabledLabel;
  }
  
  function formatTimestampFromSeconds(secondsFromNow) {
    const sec = Number(secondsFromNow || 0);
    if (sec <= 0) return "Now";
  
    const dt = new Date(Date.now() + sec * 1000);
  
    try {
      return dt.toLocaleString();
    } catch {
      return dt.toISOString();
    }
  }
  
  function stopSelectedBlockClaimTicker() {
    if (selectedBlockClaimTicker) {
      clearInterval(selectedBlockClaimTicker);
      selectedBlockClaimTicker = null;
    }
  }
  
  function startSelectedBlockClaimTicker({
    tokenId,
    sourceLabel,
    initialSeconds
  }) {
    stopSelectedBlockClaimTicker();
  
    let remaining = Math.max(0, Number(initialSeconds || 0));
  
    const render = () => {
      const currentSelectedId = String(state.selectedBlock?.tokenId || "");
      if (currentSelectedId !== String(tokenId)) {
        stopSelectedBlockClaimTicker();
        return;
      }
  
      const ready = remaining <= 0;
  
      safeText(
        "claimStatus",
        ready ? `Ready (${sourceLabel})` : `${sourceLabel} in ${formatDuration(remaining)}`
      );
      safeText(
        "claimHint",
        ready ? "Claim is ready." : `Claim not ready yet: ${sourceLabel} in ${formatDuration(remaining)}`
      );
      safeText("claimAtText", ready ? "Now" : formatTimestampFromSeconds(remaining));
      safeText("timelineClaim", ready ? "Claim: Ready" : `Claim: in ${formatDuration(remaining)}`);
  
      setButtonVisualState("claimBtn", ready);
  
      if (remaining <= 0) {
        stopSelectedBlockClaimTicker();
        return;
      }
  
      remaining -= 1;
    };
  
    render();
    selectedBlockClaimTicker = setInterval(render, 1000);
  }
  
  function updateRevealCardVisibility(revealed) {
    const revealCard = byId("revealCard");
    if (!revealCard) return;
    revealCard.style.display = revealed ? "none" : "";
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
  
  function updateMoveProtectionTargetDropdown(selectedTokenId) {
    const select = byId("moveProtectionTargetTokenId");
    if (!select) return;
  
    const blocks = Array.isArray(state.userBlocks) ? state.userBlocks : [];
    const current = String(selectedTokenId || "");
    const previous = String(select.value || "");
  
    const targetBlocks = blocks.map(String).filter((id) => id !== current);
  
    select.innerHTML = [
      `<option value="">Choose target block…</option>`,
      ...targetBlocks.map((id) => `<option value="${id}">Block #${id}</option>`)
    ].join("");
  
    if (previous && targetBlocks.includes(previous)) {
      select.value = previous;
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
  
  function updateDefenderSidePanel(points = 0) {
    const p = Number(points || 0);
    const rankLabel = getMercenaryRankLabel(p);
    const discountPercent = getMercenaryDiscountPercent(p);
    const nextRankAt = getMercenaryNextRankThreshold(p);
  
    state.uiBlockStatus.defenderPoints = p;
    state.uiBlockStatus.defenderRank = rankLabel;
    state.uiBlockStatus.defenderDiscountPercent = discountPercent;
    state.uiBlockStatus.nextRankAt = nextRankAt;
  
    safeText("mercenaryPoints", String(p));
    safeText("mercenaryPointsSide", String(p));
  
    safeText("mercenaryRank", rankLabel);
    safeText("mercenaryRankSide", rankLabel);
  
    safeText("mercenaryDiscount", `${discountPercent}%`);
    safeText("mercenaryDiscountSide", `${discountPercent}%`);
  
    safeText("mercenaryNextRank", String(nextRankAt));
    safeText("mercenaryNextRankSide", String(nextRankAt));
  }
  
  function updateTimeline({
    revealed,
    farmingActive,
    activeOnV5,
    claimReady,
    claimCooldownSeconds,
    protectionActive,
    protectionLevel,
    protectionExpiresAt
  }) {
    safeText("timelineReveal", `Reveal: ${revealed ? "Done" : "Hidden"}`);
  
    if (farmingActive) {
      safeText("timelineFarm", "Farm: Active (V6)");
    } else if (activeOnV5) {
      safeText("timelineFarm", "Farm: Active (V5)");
    } else {
      safeText("timelineFarm", "Farm: Inactive");
    }
  
    if (claimReady) {
      safeText("timelineClaim", "Claim: Ready");
    } else if (claimCooldownSeconds > 0) {
      safeText("timelineClaim", `Claim: in ${formatDuration(claimCooldownSeconds)}`);
    } else {
      safeText("timelineClaim", "Claim: —");
    }
  
    if (protectionActive) {
      safeText(
        "timelineProtection",
        `Protection: ${protectionLevel}% until ${formatDuration(
          Math.max(0, protectionExpiresAt - Math.floor(Date.now() / 1000))
        )}`
      );
    } else {
      safeText("timelineProtection", "Protection: Inactive");
    }
  
    safeText("timelineAttack", "Attack: —");
  }
  
  function updateActionHints({
    revealed,
    farmingActive,
    activeOnV5,
    claimReady,
    claimText,
    boostActive,
    claimCooldownSeconds
  }) {
    safeText("revealStatus", revealed ? "Revealed" : "Hidden");
    safeText(
      "farmingStatus",
      farmingActive ? "Active (V6)" : (activeOnV5 ? "Active (V5)" : "Inactive")
    );
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
  
    safeText(
      "claimAtText",
      claimReady
        ? "Now"
        : claimCooldownSeconds > 0
          ? formatTimestampFromSeconds(claimCooldownSeconds)
          : "Waiting"
    );
  }
  
  async function getCurrentUnlockedSlots() {
    try {
      if (state.mercenaryProfile?.slotsUnlocked !== undefined) {
        return Math.max(1, Number(state.mercenaryProfile.slotsUnlocked || 1));
      }
  
      if (!state.userAddress || !state.mercenaryV4Contract) return 1;
  
      if (typeof state.mercenaryV4Contract.unlockedSlots === "function") {
        const v = await state.mercenaryV4Contract.unlockedSlots(state.userAddress);
        return Math.max(1, Number(v || 1));
      }
  
      if (typeof state.mercenaryV4Contract.getWalletSlots === "function") {
        const slots = await state.mercenaryV4Contract.getWalletSlots(state.userAddress);
        const unlocked = Number(slots?.unlockedSlots ?? slots?.[0] ?? 1);
        return Math.max(1, unlocked);
      }
    } catch {}
  
    return 1;
  }
  
  async function getDefenderPoints() {
    try {
      if (state.mercenaryProfile?.defenderPoints !== undefined) {
        return Number(state.mercenaryProfile.defenderPoints || 0);
      }
  
      if (!state.userAddress || !state.mercenaryV4Contract) return 0;
  
      if (typeof state.mercenaryV4Contract.getDefenderProfile === "function") {
        const profile = await state.mercenaryV4Contract.getDefenderProfile(state.userAddress);
        return Number(profile?.defenderPoints ?? profile?.points ?? profile?.[0] ?? 0);
      }
    } catch {}
  
    return Number(state.uiBlockStatus?.defenderPoints || 0);
  }
  
  function updateProtectionActionStates({
    protectionActive,
    protectionExpired,
    unlockedSlots,
    selectedTokenId
  }) {
    const moveTargetValue = String(byId("moveProtectionTargetTokenId")?.value || "");
    const hasMoveTarget = !!moveTargetValue && moveTargetValue !== String(selectedTokenId || "");
  
    setButtonVisualState("protectBtn", !protectionActive);
    setButtonVisualState("extendProtectionBtn", protectionActive && !protectionExpired);
    setButtonVisualState("cancelProtectionBtn", protectionActive && !protectionExpired);
    setButtonVisualState("cleanupProtectionBtn", protectionExpired);
    setButtonVisualState("moveProtectionBtn", protectionActive && !protectionExpired && hasMoveTarget);
    setButtonVisualState("emergencyMoveProtectionBtn", protectionActive && !protectionExpired && hasMoveTarget);
  
    setButtonVisualState("unlockSlot2Btn", unlockedSlots < 2);
    setButtonVisualState("unlockSlot3Btn", unlockedSlots < 3);
  }
  
  function buildResourceHtml({
    revealed,
    rarity,
    row,
    protectionActive,
    protectionLevel,
    protectionTier,
    protectionSlotIndex,
    protectionExpired,
    boostActive,
    activeOnV5,
    farmingActive
  }) {
    if (!revealed || rarity === null) {
      return "<p>Reveal block to see resources.</p>";
    }
  
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
  
    if (protectionExpired) {
      h += `<div class="resource-item">Protection: expired</div>`;
    }
  
    if (boostActive) {
      h += `<div class="resource-item">Boost: active</div>`;
    }
  
    if (activeOnV5 && !farmingActive) {
      h += `<div class="resource-item" style="color:#8a5cff;">⚠️ V5 active - migrate to V6</div>`;
    }
  
    return h;
  }
  
  /* =========================================================
     LOAD USER BLOCKS
     LIGHT GRID: no heavy onchain per-card calls
     ========================================================= */
  
  export async function loadUserBlocks({ onRevealSelected, onRefreshBlockMarkings } = {}) {
    stopSelectedBlockClaimTicker();
  
    const grid = byId("blocksGrid");
    if (!grid) return;
  
    if (!state.userAddress || !state.nftContract) {
      state.userBlocks = [];
      grid.innerHTML = `<p class="empty-state">Connect wallet to see your blocks.</p>`;
      safeText("activeFarms", "0");
      return;
    }
  
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
  
      let html = "";
      let activeFarmsCount = 0;
      const now = Math.floor(Date.now() / 1000);
  
      for (const token of subgraphTokens) {
        const tokenId = String(token.id);
        const revealed = !!token.revealed;
  
        const farm = state.cachedFarmV6Map.get(tokenId);
        const farmingActive = !!(farm && farm.active);
        if (farmingActive) activeFarmsCount++;
  
        const protection = state.cachedProtectionMapV4.get(tokenId);
        const protectionActive = !!(protection && protection.active && Number(protection.expiresAt) > now);
  
        let classNames = revealed ? "revealed" : "hidden";
        if (farmingActive) classNames += " farming";
        if (protectionActive) classNames += " protected";
        if (state.selectedBlock && String(state.selectedBlock.tokenId) === tokenId) classNames += " selected";
  
        const badge = revealed
          ? `<div class="rarity-badge">Revealed</div>`
          : `<div class="rarity-badge hidden-badge">🔒 Hidden</div>`;
  
        const protectionBadge = protectionActive
          ? `<div class="rarity-badge" style="background:#6f42c1; color:white; margin-top:4px;">🛡️ ${protection.level}% Protected</div>`
          : "";
  
        let farmDurationLine = "";
        if (farmingActive) {
          const farmingElapsed = Number(farm?.startTime) > 0
            ? formatDuration(now - Number(farm.startTime))
            : "—";
  
          farmDurationLine = `<div class="farm-duration">🌾 Farming: ${farmingElapsed}</div>`;
        }
  
        const revealButton = !revealed
          ? `<button class="reveal-block-btn" data-tokenid="${tokenId}">🔓 Reveal</button>`
          : "";
  
        html += `
          <div class="block-card ${classNames}" data-tokenid="${tokenId}">
            <div class="block-id">#${tokenId}</div>
            <div>${revealed ? "Revealed block" : "Hidden block"}</div>
            ${badge}
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
        migrateAllBtn.style.display = "none";
      }
  
      document.querySelectorAll(".block-card").forEach((card) => {
        card.addEventListener("click", async (e) => {
          if (e.target.classList.contains("reveal-block-btn")) return;
          await selectBlock(card.dataset.tokenid);
        });
      });
  
      document.querySelectorAll(".reveal-block-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const tokenId = btn.dataset.tokenid;
          await selectBlock(tokenId);
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
     Heavy reads only here
     ========================================================= */
  
  export async function selectBlock(tokenId, row = null, col = null) {
    const now = Math.floor(Date.now() / 1000);
    resetSelectedBlockUiState();
    stopSelectedBlockClaimTicker();
  
    let revealed = false;
    let rarity = null;
    let resolvedRow = Number(row ?? 0);
    let resolvedCol = Number(col ?? 0);
  
    try {
      const tokenData = await state.nftContract.blockData(tokenId);
      revealed = !!tokenData.revealed;
    } catch {}
  
    try {
      const pos = await state.nftContract.getBlockPosition(tokenId);
      resolvedRow = Number(pos?.row ?? 0);
      resolvedCol = Number(pos?.col ?? 0);
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
    const protectionExpired = !!(
      protection &&
      !protectionActive &&
      protectionExpiresAt > 0 &&
      protectionExpiresAt <= now
    );
  
    const activeOnV5 = await isTokenActiveOnV5(tokenId).catch(() => false);
  
    const selectedBlock = {
      tokenId: String(tokenId),
      row: resolvedRow,
      col: resolvedCol,
      revealed,
      rarity,
      farmingActive,
      protectionLevel,
      protectionTier,
      protectionSlotIndex,
      protectionExpiresAt,
      protectionActive,
      protectionExpired,
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
    state.uiBlockStatus.protectionExpired = protectionExpired;
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
  
    safeText("selectedBlockText", `Block #${tokenId} (R${resolvedRow}, C${resolvedCol})${farmDur}`);
    safeText("selectedActionToken", `Block #${tokenId}`);
    safeValue("protectTokenId", tokenId);
  
    let claimReady = false;
    let claimText = "—";
    let claimCooldownSeconds = 0;
  
    if (farmingActive) {
      try {
        let waitSec = 0;
        let preview = null;
  
        try {
          const waitRaw = await state.farmingV6Contract.secondsUntilClaimable(tokenId);
          waitSec = Number(waitRaw || 0);
        } catch {}
  
        try {
          preview = await state.farmingV6Contract.previewClaim(tokenId);
        } catch {}
  
        claimCooldownSeconds = Math.max(0, waitSec);
        claimReady = claimCooldownSeconds <= 0 && !!preview?.allowed;
  
        if (claimReady) {
          claimText = "Ready (V6)";
        } else if (claimCooldownSeconds > 0) {
          claimText = `V6 in ${formatDuration(claimCooldownSeconds)}`;
        } else {
          claimText = "Waiting for next claim window";
        }
      } catch {
        claimText = "—";
        claimReady = false;
        claimCooldownSeconds = 0;
      }
    } else if (activeOnV5) {
      try {
        const v5 = getFarmingV5Contract();
        const preview = await v5.previewClaim(tokenId);
  
        claimReady = !!preview?.allowed;
        claimCooldownSeconds = Math.max(0, Number(preview?.secondsRemaining || 0));
  
        if (claimReady) {
          claimText = "Ready (V5)";
        } else if (claimCooldownSeconds > 0) {
          claimText = `V5 in ${formatDuration(claimCooldownSeconds)}`;
        } else {
          claimText = "Waiting for next claim window";
        }
      } catch {
        claimText = "—";
        claimReady = false;
        claimCooldownSeconds = 0;
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
      boostActive,
      claimCooldownSeconds
    });
  
    updateTimeline({
      revealed,
      farmingActive,
      activeOnV5,
      claimReady,
      claimCooldownSeconds,
      protectionActive,
      protectionLevel,
      protectionExpiresAt
    });
  
    if ((farmingActive || activeOnV5) && !claimReady && claimCooldownSeconds > 0) {
      startSelectedBlockClaimTicker({
        tokenId,
        sourceLabel: farmingActive ? "V6" : "V5",
        initialSeconds: claimCooldownSeconds
      });
    } else if ((farmingActive || activeOnV5) && claimReady) {
      startSelectedBlockClaimTicker({
        tokenId,
        sourceLabel: farmingActive ? "V6" : "V5",
        initialSeconds: 0
      });
    } else {
      stopSelectedBlockClaimTicker();
    }
  
    updateRevealCardVisibility(revealed);
  
    setButtonVisualState("revealBtn", !revealed);
    setButtonVisualState("farmingStartBtn", !farmingActive && !activeOnV5);
    setButtonVisualState("farmingStopBtn", !!farmingActive);
    setButtonVisualState("claimBtn", !!(claimReady && (farmingActive || activeOnV5)));
    setButtonVisualState("buyBoostBtn", !!farmingActive);
  
    const protectionStatusEl = byId("protectionStatus");
    const protectionExpiryEl = byId("protectionExpiry");
    const protectionStatusText = byId("protectionStatusText");
  
    if (protectionStatusText) {
      if (protectionActive) {
        protectionStatusText.textContent = `${protectionLevel}% Active`;
      } else if (protectionExpired) {
        protectionStatusText.textContent = "Expired";
      } else {
        protectionStatusText.textContent = "Inactive";
      }
    }
  
    if ((protectionActive || protectionExpired) && protectionExpiryEl) {
      const delta = protectionExpiresAt - now;
      protectionExpiryEl.textContent = delta > 0 ? formatDuration(delta) : "Expired";
      if (protectionStatusEl) protectionStatusEl.style.display = "block";
    } else if (protectionStatusEl) {
      protectionStatusEl.style.display = "none";
    }
  
    updateMercenarySlotDropdown(unlockedSlots);
    updateBastionTitleLock(defenderPoints);
    updateDefenderSidePanel(defenderPoints);
    updateMoveProtectionTargetDropdown(tokenId);
    updateProtectionActionStates({
      protectionActive,
      protectionExpired,
      unlockedSlots,
      selectedTokenId: tokenId
    });
  
    const resDiv = byId("blockResources");
    if (resDiv) {
      resDiv.innerHTML = buildResourceHtml({
        revealed,
        rarity,
        row: resolvedRow,
        protectionActive,
        protectionLevel,
        protectionTier,
        protectionSlotIndex,
        protectionExpired,
        boostActive,
        activeOnV5,
        farmingActive
      });
    }
  
    document.querySelectorAll(".block-card").forEach((c) => c.classList.remove("selected"));
    const sel = document.querySelector(`.block-card[data-tokenid="${tokenId}"]`);
    if (sel) sel.classList.add("selected");
  }