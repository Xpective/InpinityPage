/* =========================================================
   ATTACKS – V6 EXPLICIT ATTACKER FLOW
   ========================================================= */

import {
  state,
  setSelectedAttackAttackerTokenId
} from "./state.js";

import {
  resourceNames,
  MAX_ROW,
  PIRATE_BOOST_PRICE_PER_DAY,
  PIRATE_BOOST_MAX_DAYS,
  STORAGE_ATTACKER_TOKEN_KEY
} from "./config.js";

import {
  byId,
  formatTime,
  formatDuration,
  normalizeAttackTuple
} from "./utils.js";

import { loadMyAttacksV6FromSubgraph } from "./subgraph.js";
import { loadResourceBalancesOnchain } from "./resources.js";
import { updateBalances } from "./balances.js";

/* =========================================================
   HELPERS
   ========================================================= */

function setButtonVisualState(buttonId, enabled, enabledText = null, disabledText = null) {
  const btn = byId(buttonId);
  if (!btn) return;

  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.45";
  btn.style.pointerEvents = enabled ? "auto" : "none";

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent;
  }

  if (enabled && enabledText) {
    btn.textContent = enabledText;
  } else if (!enabled && disabledText) {
    btn.textContent = disabledText;
  } else if (enabled && btn.dataset.originalText) {
    btn.textContent = btn.dataset.originalText;
  }
}

function setButtonBusy(buttonId, busy, busyText = "Processing...") {
  const btn = byId(buttonId);
  if (!btn) return;

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent;
  }

  if (busy) {
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";
    btn.textContent = busyText;
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    btn.textContent = btn.dataset.originalText;
  }
}

function friendlyErrorMessage(e) {
  const msg = e?.reason || e?.data?.message || e?.message || "Unknown error";
  const lower = String(msg).toLowerCase();

  if (
    e?.code === 4001 ||
    lower.includes("user rejected") ||
    lower.includes("denied transaction signature") ||
    lower.includes("action_rejected")
  ) {
    return "Transaction cancelled in wallet.";
  }

  if (lower.includes("already known")) {
    return "This transaction is already known by the network. Please wait.";
  }

  if (lower.includes("nonce")) {
    return "Transaction nonce issue. Please check pending transactions in your wallet.";
  }

  return msg;
}

function getAttackMessageDiv() {
  return byId("attackMessage");
}

function getPirateBoostMessageDiv() {
  return byId("pirateBoostMessage");
}

function getAttackerSelect() {
  return byId("attackAttackerTokenId");
}

function getAttackResourceSelect() {
  return byId("attackResourceSelect");
}

function persistSelectedAttackerTokenId(tokenId) {
  try {
    if (tokenId === null || tokenId === undefined || tokenId === "") {
      localStorage.removeItem(STORAGE_ATTACKER_TOKEN_KEY);
    } else {
      localStorage.setItem(STORAGE_ATTACKER_TOKEN_KEY, String(tokenId));
    }
  } catch {}
}

function readPersistedAttackerTokenId() {
  try {
    return localStorage.getItem(STORAGE_ATTACKER_TOKEN_KEY);
  } catch {
    return null;
  }
}

function uniqueTokenIds(values = []) {
  return [...new Set(
    values
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => String(v))
  )];
}

async function getOwnedTokenIds() {
  if (!state.userAddress) return [];

  const collected = [];

  if (Array.isArray(state.userBlocks) && state.userBlocks.length) {
    collected.push(...state.userBlocks.map(String));
  }

  if (state.nftContract) {
    try {
      const balance = await state.nftContract.balanceOf(state.userAddress);
      const count = Number(balance?.toString?.() || balance || 0);

      for (let i = 0; i < count; i++) {
        try {
          const tokenId = await state.nftContract.tokenOfOwnerByIndex(state.userAddress, i);
          collected.push(String(tokenId?.toString ? tokenId.toString() : tokenId));
        } catch (innerErr) {
          console.warn("tokenOfOwnerByIndex failed at index", i, innerErr);
        }
      }
    } catch (err) {
      console.warn("balanceOf/token enumeration failed in attacks.js", err);
    }
  }

  return uniqueTokenIds(collected);
}

async function isOwnedToken(tokenId) {
  if (!tokenId || !state.userAddress || !state.nftContract) return false;

  try {
    const owner = await state.nftContract.ownerOf(tokenId);
    return owner.toLowerCase() === state.userAddress.toLowerCase();
  } catch {
    return false;
  }
}

function setIncomingAttackInfo(text = "", visible = false) {
  const box = byId("incomingAttackInfo");
  const line = byId("incomingAttackText");

  if (line) line.textContent = text || "No attack update data.";
  if (box) box.style.display = visible ? "block" : "none";
}

function setSelectedAttackAlert(text = "", visible = false) {
  const box = byId("selectedAttackAlert");
  const line = byId("selectedAttackAlertText");

  if (line) line.textContent = text || "No active attack data.";
  if (box) box.style.display = visible ? "block" : "none";
}

/* =========================================================
   ATTACK SOURCE
   ========================================================= */

export async function getValidAttackerTokenId({ allowFallback = false } = {}) {
  const select = getAttackerSelect();

  if (select && select.value) {
    const selectedId = String(select.value);
    if (await isOwnedToken(selectedId)) {
      setSelectedAttackAttackerTokenId(selectedId);
      persistSelectedAttackerTokenId(selectedId);
      return parseInt(selectedId, 10);
    }
  }

  if (state.selectedAttackAttackerTokenId) {
    const selectedId = String(state.selectedAttackAttackerTokenId);
    if (await isOwnedToken(selectedId)) {
      return parseInt(selectedId, 10);
    }
  }

  if (!allowFallback) return null;

  if (state.selectedBlock?.tokenId) {
    const selectedId = String(state.selectedBlock.tokenId);
    if (await isOwnedToken(selectedId)) {
      return parseInt(selectedId, 10);
    }
  }

  const owned = await getOwnedTokenIds();
  if (owned.length > 0) {
    return parseInt(owned[0], 10);
  }

  return null;
}

export async function updateAttackerSelectorUi() {
  const select = getAttackerSelect();
  if (!select) return null;

  if (!state.userAddress) {
    select.innerHTML = `<option value="">Connect wallet first…</option>`;
    setSelectedAttackAttackerTokenId(null);
    setIncomingAttackInfo("", false);
    setSelectedAttackAlert("", false);
    return null;
  }

  const owned = await getOwnedTokenIds();

  if (!owned.length) {
    select.innerHTML = `<option value="">No owned attacker block found…</option>`;
    setSelectedAttackAttackerTokenId(null);
    persistSelectedAttackerTokenId(null);
    setSelectedAttackAlert("No owned attacker block found for this wallet.", true);
    return null;
  }

  const persisted = readPersistedAttackerTokenId();
  let preferred =
    state.selectedAttackAttackerTokenId ||
    persisted ||
    state.selectedBlock?.tokenId ||
    owned[0];

  preferred = String(preferred);

  if (!owned.includes(preferred)) {
    preferred = owned[0];
  }

  select.innerHTML = `
    <option value="">Choose your attacker block…</option>
    ${owned.map((tokenId) => `<option value="${tokenId}">Block #${tokenId}</option>`).join("")}
  `;

  select.value = preferred;
  setSelectedAttackAttackerTokenId(preferred);
  persistSelectedAttackerTokenId(preferred);

  setSelectedAttackAlert(`Selected attacker block: #${preferred}`, true);

  return parseInt(preferred, 10);
}

export async function handleAttackerSelectionChange() {
  const select = getAttackerSelect();
  if (!select) return;

  const value = select.value || null;
  setSelectedAttackAttackerTokenId(value);
  persistSelectedAttackerTokenId(value);

  if (value) {
    setSelectedAttackAlert(`Selected attacker block: #${value}`, true);
  } else {
    setSelectedAttackAlert("No attacker block selected.", true);
  }

  await refreshAttackDropdown();
}

/* =========================================================
   RESOURCE SELECT / BOOST LABELS
   ========================================================= */

export function initAttackResourceSelect() {
  const select = getAttackResourceSelect();
  if (!select) return;

  select.innerHTML = "";
  for (let i = 0; i < resourceNames.length; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = resourceNames[i];
    select.appendChild(opt);
  }
}

export function updateBoostCostLabels() {
  const pirateDaysInput = byId("pirateBoostDays");
  const pirateCostInfo = byId("pirateBoostCostInfo");

  if (!pirateCostInfo || !pirateDaysInput) return;

  let days = parseInt(pirateDaysInput.value, 10);
  if (!Number.isFinite(days)) days = 7;

  days = Math.max(1, Math.min(PIRATE_BOOST_MAX_DAYS, days));
  pirateDaysInput.value = String(days);

  pirateCostInfo.textContent = `Total: ${days * PIRATE_BOOST_PRICE_PER_DAY} PIT`;
}

export async function buyPirateBoost() {
  const msgDiv = getPirateBoostMessageDiv();
  const daysInput = byId("pirateBoostDays");

  if (!msgDiv) return;

  let days = parseInt(daysInput?.value, 10);
  if (!Number.isFinite(days)) days = 7;
  days = Math.max(1, Math.min(PIRATE_BOOST_MAX_DAYS, days));

  try {
    const attackerTokenId = await getValidAttackerTokenId({ allowFallback: false });
    if (!attackerTokenId) {
      msgDiv.innerHTML = `<span class="error">❌ Select a valid attacker block first.</span>`;
      setButtonVisualState("buyPirateBoostBtn", false, null, "Buy Pirate Boost");
      return;
    }

    setButtonBusy("buyPirateBoostBtn", true, "Buying...");

    const totalCostHuman = days * PIRATE_BOOST_PRICE_PER_DAY;
    const totalCostWei = ethers.utils.parseEther(String(totalCostHuman));

    const allowance = await state.pitroneContract.allowance(
      state.userAddress,
      state.piratesV6Contract.address
    );

    if (allowance.lt(totalCostWei)) {
      msgDiv.innerHTML = `
        <span class="success">
          ⏳ Approving PITRONE...<br>
          Block: #${attackerTokenId}<br>
          Cost: ${totalCostHuman} PIT
        </span>
      `;

      const approveTx = await state.pitroneContract.approve(
        state.piratesV6Contract.address,
        totalCostWei
      );
      await approveTx.wait();
    }

    msgDiv.innerHTML = `
      <span class="success">
        ⏳ Buying Pirate Boost...<br>
        Block: #${attackerTokenId}<br>
        Days: ${days}<br>
        Cost: ${totalCostHuman} PIT<br>
        Effect: +25 percentage points steal bonus
      </span>
    `;

    const tx = await state.piratesV6Contract.buyPirateBoost(attackerTokenId, days, {
      gasLimit: 350000
    });

    await tx.wait();

    msgDiv.innerHTML = `
      <span class="success">
        ✅ Pirate Boost activated!<br>
        Block: #${attackerTokenId}<br>
        Days: ${days}<br>
        Paid: ${totalCostHuman} PIT
      </span>
    `;

    await updateBalances();
    await loadResourceBalancesOnchain();
    await loadUserAttacks();
    await refreshAttackDropdown();
    refreshBlockMarkings();
  } catch (e) {
    console.error("buyPirateBoost error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
  } finally {
    setButtonBusy("buyPirateBoostBtn", false);
  }
}

/* =========================================================
   ATTACK PREVIEW / DROPDOWN
   ========================================================= */

export function scheduleAttackDropdownRefresh() {
  clearTimeout(state.attackDropdownTimer);
  state.attackDropdownTimer = setTimeout(() => {
    refreshAttackDropdown();
  }, 350);
}

export async function refreshAttackDropdown() {
  const requestId = ++state.attackDropdownRequestId;

  const row = parseInt(byId("attackRow")?.value, 10);
  const col = parseInt(byId("attackCol")?.value, 10);
  const select = getAttackResourceSelect();
  const msg = getAttackMessageDiv();
  const info = byId("attackRulesInfo");
  const previewDetails = byId("attackPreviewDetails");

  if (!select) return;

  const previousResourceValue = String(select.value || "");
  const attackerTokenId = await updateAttackerSelectorUi();

  if (
    !Number.isFinite(row) ||
    !Number.isFinite(col) ||
    row < 0 ||
    row > MAX_ROW ||
    col < 0 ||
    col > 2 * row
  ) {
    select.innerHTML = "";
    initAttackResourceSelect();

    if (msg) msg.innerHTML = "";
    if (info) info.innerHTML = `<strong>Attack Check</strong><br>Enter valid coordinates.`;
    if (previewDetails) previewDetails.style.display = "none";

    setButtonVisualState("attackBtn", false, null, "⚔️ Start Attack (V6)");
    setButtonVisualState("buyPirateBoostBtn", !!attackerTokenId, null, "Buy Pirate Boost");
    return;
  }

  const targetTokenId = row * 2048 + col;

  if (!state.userAddress || !state.nftContract || !state.piratesV6Contract) {
    initAttackResourceSelect();
    setButtonVisualState("attackBtn", false, null, "⚔️ Start Attack (V6)");
    setButtonVisualState("buyPirateBoostBtn", false, null, "Buy Pirate Boost");
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
      setButtonVisualState("attackBtn", false, null, "⚔️ Start Attack (V6)");
      setButtonVisualState("buyPirateBoostBtn", !!attackerTokenId, null, "Buy Pirate Boost");
      return;
    }

    if (!attackerTokenId) {
      if (requestId !== state.attackDropdownRequestId) return;
      if (msg) msg.innerHTML = `<span class="error">❌ Select an attacker block first.</span>`;
      if (info) info.innerHTML = `<strong>Attack Check</strong><br>No attacker block selected.`;
      setButtonVisualState("attackBtn", false, null, "⚔️ Start Attack (V6)");
      setButtonVisualState("buyPirateBoostBtn", false, null, "Buy Pirate Boost");
      return;
    }

    const isOwnTarget = targetOwner.toLowerCase() === state.userAddress.toLowerCase();

    const previewPromises = [];
    for (let resourceId = 0; resourceId < 10; resourceId++) {
      previewPromises.push(
        state.piratesV6Contract
          .previewAttack(attackerTokenId, targetTokenId, resourceId)
          .catch(() => null)
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
      for (let id = 0; id < resourceNames.length; id++) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `${resourceNames[id]} ⚠️`;
        select.appendChild(opt);
      }
    } else {
      const allowedResourceStrings = allowedResources.map(String);
      if (allowedResourceStrings.includes(previousResourceValue)) {
        select.value = previousResourceValue;
      } else {
        select.value = String(allowedResources[0]);
      }
    }

    const selectedResourceId = Number(select.value || (allowedResources[0] ?? 0));
    const previewToShow =
      previews[selectedResourceId] ||
      previews[allowedResources[0]] ||
      previews[0];

    let canAttack = false;

    if (info && previewToShow) {
      let html = `<strong>Attack Check</strong><br>`;

      if (isOwnTarget) {
        html += `<span class="error">⚠️ Cannot attack own block</span>`;
        canAttack = false;
        if (previewDetails) previewDetails.style.display = "none";
      } else {
        canAttack = !!previewToShow.allowed;

        html += previewToShow.allowed
          ? `<span class="success">✅ Attack allowed</span><br>`
          : `<span class="error">❌ Attack not allowed (Code ${previewToShow.code})</span><br>`;

        html += `From attacker: #${attackerTokenId}<br>`;
        html += `Travel time: ${formatDuration(Number(previewToShow.travelTime || 0))}<br>`;
        html += `Steal amount: ${(previewToShow.stealAmount || 0).toString()}<br>`;
        html += `Remaining attacks: ${Number(previewToShow.remainingAttacksToday || 0)}<br>`;
        html += `Protection: ${Number(previewToShow.protectionLevel || 0)}%<br>`;
        html += `Steal %: ${Number(previewToShow.effectiveStealPercent || 0)}%<br>`;
        html += `Pending: ${(previewToShow.pendingAmount || 0).toString()}`;
      }

      info.innerHTML = html;

      if (previewDetails && previewToShow.allowed && !isOwnTarget) {
        previewDetails.style.display = "block";
        previewDetails.innerHTML = `
          <strong>Attack Preview</strong><br>
          From Block #${attackerTokenId} → Target #${targetTokenId}<br>
          Resource: ${resourceNames[selectedResourceId]}<br>
          Steal Amount: ${(previewToShow.stealAmount || 0).toString()}<br>
          Travel: ${formatDuration(Number(previewToShow.travelTime || 0))}
        `;
      } else if (previewDetails) {
        previewDetails.style.display = "none";
      }
    }

    setButtonVisualState("attackBtn", canAttack, "⚔️ Start Attack (V6)", "⚔️ Start Attack (V6)");
    setButtonVisualState("buyPirateBoostBtn", !!attackerTokenId, "Buy Pirate Boost", "Buy Pirate Boost");

    if (msg) {
      msg.innerHTML = canAttack
        ? `<span class="success">✅ Target analyzed</span>`
        : `<span class="error">❌ Attack not ready or not allowed</span>`;
    }
  } catch (e) {
    console.warn("refreshAttackDropdown error:", e);
    if (requestId !== state.attackDropdownRequestId) return;

    if (msg) msg.innerHTML = `<span class="error">❌ Error analyzing target</span>`;
    if (info) info.innerHTML = `<strong>Attack Check</strong><br>Error: ${friendlyErrorMessage(e)}`;
    if (previewDetails) previewDetails.style.display = "none";

    setButtonVisualState("attackBtn", false, null, "⚔️ Start Attack (V6)");
  }
}

/* =========================================================
   USER ATTACKS LIST
   ========================================================= */

export async function loadUserAttacks() {
  if (!state.userAddress || !state.piratesV6Contract) return;

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

    if (state.selectedBlock?.tokenId) {
      const selectedTokenId = Number(state.selectedBlock.tokenId);
      const matchingAttack = validatedAttacks.find(
        (a) => Number(a.targetTokenId) === selectedTokenId
      );

      if (matchingAttack) {
        setSelectedAttackAlert(
          `Attack on selected target #${matchingAttack.targetTokenId} from attacker #${matchingAttack.attackerTokenId}.`,
          true
        );
      } else {
        setSelectedAttackAlert("", false);
      }
    } else {
      setSelectedAttackAlert("", false);
    }

    setIncomingAttackInfo("", false);
  } catch (e) {
    console.error("Failed to load attacks:", e);
  }
}

export function displayUserAttacks() {
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

  container.innerHTML = state.userAttacks
    .map((attack) => {
      const timeLeft = attack.endTime - now;
      return `
        <div class="attack-item" data-endtime="${attack.endTime}" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">
          <div>
            <div><strong>Target #${attack.targetTokenId}</strong> (${resourceNames[attack.resource]})</div>
            <div>From attacker #${attack.attackerTokenId}</div>
            <div class="attack-status" data-endtime="${attack.endTime}">
              ${timeLeft <= 0 ? "Ready to execute" : "⏳ " + formatTime(timeLeft) + " remaining"}
            </div>
          </div>
          <div class="attack-actions">
            ${
              timeLeft <= 0
                ? `<button class="execute-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">⚔️ Execute</button>`
                : `<button class="execute-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}" disabled>⏳ Waiting</button>`
            }
            <button class="cancel-attack-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}" title="Cancel attack">✖️</button>
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll(".execute-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      await executeAttack(targetTokenId, attackIndex);
    });
  });

  document.querySelectorAll(".cancel-attack-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      await cancelAttack(targetTokenId, attackIndex);
    });
  });
}

export function startAttacksTicker() {
  if (state.attacksTicker) return;

  state.attacksTicker = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);

    document.querySelectorAll(".attack-status").forEach((el) => {
      const endTime = parseInt(el.dataset.endtime || "0", 10);
      if (!endTime) return;
      const timeLeft = endTime - now;
      el.textContent = timeLeft <= 0 ? "Ready to execute" : "⏳ " + formatTime(timeLeft) + " remaining";
    });

    document.querySelectorAll(".attack-item").forEach((item) => {
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

export function stopAttacksTicker() {
  if (state.attacksTicker) {
    clearInterval(state.attacksTicker);
    state.attacksTicker = null;
  }
}

export function refreshBlockMarkings() {
  document.querySelectorAll(".block-card").forEach((card) => {
    card.classList.remove("attacking", "executable");
  });

  const now = Math.floor(Date.now() / 1000);

  for (const attack of state.userAttacks || []) {
    const card = document.querySelector(`.block-card[data-tokenid="${attack.targetTokenId}"]`);
    if (!card) continue;
    if (attack.endTime <= now) card.classList.add("executable");
    else card.classList.add("attacking");
  }
}

/* =========================================================
   EXECUTE / CANCEL
   ========================================================= */

export async function executeAttack(targetTokenId, attackIndex) {
  const msgDiv = getAttackMessageDiv();
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

    const tx = await state.piratesV6Contract.executeAttack(targetTokenId, attackIndex, {
      gasLimit: 350000
    });
    msgDiv.innerHTML = `<span class="success">⏳ Executing...</span>`;
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack executed! Stolen: ${preview.stealAmount.toString()}</span>`;
    await loadUserAttacks();
    await loadResourceBalancesOnchain();
    await updateBalances();
    refreshBlockMarkings();
    await refreshAttackDropdown();
  } catch (e) {
    console.error("executeAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
  }
}

export async function cancelAttack(targetTokenId, attackIndex) {
  const msgDiv = getAttackMessageDiv();
  if (!msgDiv) return;

  try {
    const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
    const normalized = normalizeAttackTuple(liveAttack);

    const attackerAddress = normalized.attacker || normalized.attackerAddress || "";
    if (!attackerAddress || attackerAddress.toLowerCase() !== state.userAddress.toLowerCase()) {
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
    const tx = await state.piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, {
      gasLimit: 300000
    });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack cancelled.</span>`;
    await loadUserAttacks();
    refreshBlockMarkings();
    await refreshAttackDropdown();
  } catch (e) {
    console.error("cancelAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
  }
}

/* =========================================================
   START ATTACK
   ========================================================= */

export async function attack() {
  const attackRowEl = byId("attackRow");
  const attackColEl = byId("attackCol");
  const msgDiv = getAttackMessageDiv();

  if (!attackRowEl || !attackColEl) {
    if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ Attack inputs not found.</span>`;
    return;
  }

  const targetRow = parseInt(attackRowEl.value, 10);
  const targetCol = parseInt(attackColEl.value, 10);

  if (!Number.isFinite(targetRow) || !Number.isFinite(targetCol)) {
    if (msgDiv) msgDiv.innerHTML = `<span class="error">❌ Enter valid target coordinates.</span>`;
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

  const attackerTokenId = await getValidAttackerTokenId({ allowFallback: false });
  if (!attackerTokenId) {
    msgDiv.innerHTML = `<span class="error">❌ Select a valid attacker block first.</span>`;
    return;
  }

  const resource = parseInt(byId("attackResourceSelect")?.value, 10);
  if (!Number.isFinite(resource) || resource < 0 || resource > 9) {
    msgDiv.innerHTML = `<span class="error">❌ Invalid resource selected.</span>`;
    return;
  }

  try {
    setButtonBusy("attackBtn", true, "Starting...");
    msgDiv.innerHTML = `<span class="success">⏳ Preview attack...</span>`;

    const preview = await state.piratesV6Contract.previewAttack(attackerTokenId, targetTokenId, resource);
    if (!preview.allowed) {
      msgDiv.innerHTML = `<span class="error">❌ Attack not allowed: Code ${preview.code}</span>`;
      return;
    }

    msgDiv.innerHTML = `
      <span class="success">
        ⏳ Starting attack...<br>
        From: Block #${attackerTokenId}<br>
        Target: #${targetTokenId}<br>
        Travel time: ${formatDuration(Number(preview.travelTime || 0))}<br>
        Steal amount: ${(preview.stealAmount || 0).toString()}<br>
        Remaining today: ${Number(preview.remainingAttacksToday || 0)}
      </span>
    `;

    const tx = await state.piratesV6Contract.startAttack(attackerTokenId, targetTokenId, resource, {
      gasLimit: 450000
    });
    await tx.wait();

    msgDiv.innerHTML = `<span class="success">✅ Attack started! Check back later.</span>`;
    await loadUserAttacks();
    refreshBlockMarkings();
    await refreshAttackDropdown();
  } catch (e) {
    console.error("startAttack error:", e);
    msgDiv.innerHTML = `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`;
  } finally {
    setButtonBusy("attackBtn", false);
  }
}
