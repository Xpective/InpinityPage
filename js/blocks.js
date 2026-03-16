/* =========================================================
   BLOCKS – V6 + MERCENARY V4
   RESTORED GRID VERSION
   - Rarity back in grid
   - Claim info back in grid
   - No useless "Revealed block / Revealed" duplication
   - Better handling for purchased blocks with already-active farms
   - FIX: prevents jumping back to older selected block via async race
   ========================================================= */

import {
  state,
  setSelectedBlockState,
  resetSelectedBlockUiState
} from "./state.js";

import {
  rarityNames,
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

/* Wichtig:
   schützt vor async race conditions beim schnellen Klicken
   auf verschiedene Blöcke. Nur der neueste selectBlock-Aufruf
   darf am Ende die UI setzen. */
let latestSelectRequestId = 0;

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
  protectionExpiresAt,
  claimedFarmResetPossible
}) {
  safeText("timelineReveal", `Reveal: ${revealed ? "Done" : "Hidden"}`);

  if (farmingActive) {
    safeText("timelineFarm", "Farm: Active (V6)");
  } else if (activeOnV5) {
    safeText("timelineFarm", "Farm: Active (V5)");
  } else if (claimedFarmResetPossible) {
    safeText("timelineFarm", "Farm: Previously active / reset possible");
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
  claimCooldownSeconds,
  claimedFarmResetPossible
}) {
  safeText("revealStatus", revealed ? "Revealed" : "Hidden");
  safeText(
    "farmingStatus",
    farmingActive
      ? "Active (V6)"
      : activeOnV5
        ? "Active (V5)"
        : claimedFarmResetPossible
          ? "Needs reset"
          : "Inactive"
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
        : claimedFarmResetPossible
          ? "This block may still have an old active farm state from a previous owner. Try Stop Farming once, then Start Farming again."
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
  farmingActive,
  claimedFarmResetPossible
}) {
  if (!revealed || rarity === null) {
    return "<p>Reveal block to
