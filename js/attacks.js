/* =========================================================
   ATTACKS – V6 LIGHT MODE / MAP REDIRECT FLOW
   Game page keeps attack overview + pirate boost,
   but heavy attack execution is delegated to map.html
   ========================================================= */

import {
  state,
  setSelectedAttackAttackerTokenId
} from "./state.js";

import {
  resourceNames,
  PIRATE_BOOST_PRICE_PER_DAY,
  PIRATE_BOOST_MAX_DAYS,
  STORAGE_ATTACKER_TOKEN_KEY
} from "./config.js";

import {
  byId,
  formatTime,
  normalizeAttackTuple
} from "./utils.js";

import { loadMyAttacksV6FromSubgraph } from "./subgraph.js";
import { loadResourceBalancesOnchain } from "./resources.js";
import { updateBalances } from "./balances.js";

/* =========================================================
   HELPERS
   ========================================================= */

function setHtml(el, html) {
  if (el) el.innerHTML = html;
}

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
  const msg = e?.reason || e?.errorName || e?.data?.message || e?.message || "Unknown error";
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

  const customErrorMap = [
    ["attacknotallowed", "Attack is not allowed for this target or resource right now."],
    ["attacklimitreached", "Your daily attack limit has been reached."],
    ["attacknotready", "This attack is not ready yet."],
    ["targetalreadyunderactiveattack", "The target already has an active attack running."],
    ["targetalreadyattackedtoday", "This target was already attacked today."],
    ["invalidresource", "The selected resource is invalid."],
    ["invalidattackindex", "The attack index is invalid."],
    ["notenoughallowance", "Token allowance is too low. Approve the required token first."],
    ["notenoughbalance", "Insufficient token balance for this action."],
    ["paymenttransferfailed", "Token transfer failed during payment."],
    ["nottokenowner", "You are not the owner of the selected attacker block."],
    ["selfattack", "You cannot attack your own block."],
    ["tokendoesnotexist", "One of the selected blocks does not exist."],
    ["invaliddaysamount", "The selected boost duration is invalid."],
    ["enforcedpause", "This contract is currently paused."]
  ];

  for (const [needle, human] of customErrorMap) {
    if (lower.includes(needle)) return human;
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

function persistSelectedAttackerTokenId(tokenId) {
  try {
    if (tokenId === null || tokenId === undefined || tokenId === "") {
      localStorage.removeItem(STORAGE_ATTACKER_TOKEN_KEY);
    } else {
      localStorage.setItem(STORAGE_ATTACKER_TOKEN_KEY, String(tokenId));
    }
  } catch {
    // ignore storage failures
  }
}

function readPersistedAttackerTokenId() {
  try {
    return localStorage.getItem(STORAGE_ATTACKER_TOKEN_KEY);
  } catch {
    return null;
  }
}

function uniqueTokenIds(values = []) {
  return [
    ...new Set(
      values
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v))
    )
  ];
}

function toSafeNumber(value, fallback = 0) {
  const normalized = value?.toString ? value.toString() : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}


function getAttackStorageKey(targetTokenId) {
  return `attack_${targetTokenId}`;
}

function loadPendingLocalAttackObjects() {
  if (typeof localStorage === "undefined") return [];

  const attacks = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("attack_")) continue;

    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      if (!raw || typeof raw !== "object") continue;
      attacks.push(raw);
    } catch {
      // ignore malformed local placeholders
    }
  }

  return attacks;
}

function normalizePendingLocalAttack(raw) {
  const targetTokenId = toSafeNumber(raw?.targetTokenId, NaN);
  const attackerTokenId = toSafeNumber(raw?.attackerTokenId, 0);
  const attackIndex = raw?.attackIndex === null || raw?.attackIndex === undefined || raw?.attackIndex === ""
    ? null
    : toSafeNumber(raw?.attackIndex, NaN);
  const startTime = toSafeNumber(raw?.startTime, 0);
  const endTime = toSafeNumber(raw?.endTime, 0);
  const resource = toSafeNumber(raw?.resource, 0);

  if (!Number.isFinite(targetTokenId) || !attackerTokenId || !endTime) return null;

  return {
    id: raw?.id || `local:${targetTokenId}:${Number.isFinite(attackIndex) ? attackIndex : startTime}`,
    targetTokenId,
    attackerTokenId,
    attackIndex: Number.isFinite(attackIndex) ? attackIndex : null,
    startTime,
    endTime,
    executed: false,
    cancelled: false,
    resource,
    localPending: true,
    receiptHash: raw?.receiptHash || null
  };
}

async function getOwnedTokenIds() {
  if (!state.userAddress) return [];

  if (Array.isArray(state.userBlocks) && state.userBlocks.length) {
    return uniqueTokenIds(state.userBlocks.map(String)).sort((a, b) => Number(a) - Number(b));
  }

  const collected = [];

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

  return uniqueTokenIds(collected).sort((a, b) => Number(a) - Number(b));
}

async function isOwnedToken(tokenId) {
  if (!tokenId || !state.userAddress) return false;

  if (Array.isArray(state.userBlocks) && state.userBlocks.length) {
    return state.userBlocks.map(String).includes(String(tokenId));
  }

  if (!state.nftContract) return false;

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

function getMapAttackUrl(extraParams = {}) {
  const params = new URLSearchParams();

  const attackerId = String(extraParams.attacker ?? state.selectedAttackAttackerTokenId ?? "");

  if (attackerId) params.set("attacker", attackerId);

  if (extraParams.targetTokenId !== undefined && extraParams.targetTokenId !== null) {
    params.set("targetTokenId", String(extraParams.targetTokenId));
  }

  if (extraParams.attackIndex !== undefined && extraParams.attackIndex !== null) {
    params.set("attackIndex", String(extraParams.attackIndex));
  }

  const qs = params.toString();
  return qs ? `map.html?${qs}#attack` : "map.html#attack";
}

function renderMapRedirectInfo() {
  const msg = getAttackMessageDiv();
  const attackBtn = byId("attackBtn");

  setHtml(
    msg,
    `
      <span class="success">
        <a href="${getMapAttackUrl()}" style="color:#d4af37; text-decoration:underline;">Open Map Attack View</a>
      </span>
    `
  );

  if (attackBtn) {
    attackBtn.textContent = "🗺️ Open Pyramid Map";
    attackBtn.disabled = false;
    attackBtn.style.opacity = "1";
    attackBtn.style.pointerEvents = "auto";
  }
}

function clearAttackUiDisconnected() {
  const select = getAttackerSelect();
  const msg = getAttackMessageDiv();

  if (select) {
    select.innerHTML = `<option value="">Connect wallet first…</option>`;
  }

  setHtml(msg, "");

  setSelectedAttackAttackerTokenId(null);
  persistSelectedAttackerTokenId(null);
  setIncomingAttackInfo("", false);
  setSelectedAttackAlert("", false);

  setButtonVisualState("attackBtn", true, "🗺️ Open Pyramid Map", "🗺️ Open Pyramid Map");
  setButtonVisualState("buyPirateBoostBtn", false, "Buy Pirate Boost", "Buy Pirate Boost");
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
    clearAttackUiDisconnected();
    return null;
  }

  const owned = await getOwnedTokenIds();

  if (!owned.length) {
    select.innerHTML = `<option value="">No owned attacker block found…</option>`;
    setSelectedAttackAttackerTokenId(null);
    persistSelectedAttackerTokenId(null);
    setSelectedAttackAlert("No owned attacker block found for this wallet.", true);
    renderMapRedirectInfo();
    setButtonVisualState("buyPirateBoostBtn", false, "Buy Pirate Boost", "Buy Pirate Boost");
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
  renderMapRedirectInfo();
  setButtonVisualState("buyPirateBoostBtn", true, "Buy Pirate Boost", "Buy Pirate Boost");

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

  renderMapRedirectInfo();
  setButtonVisualState("buyPirateBoostBtn", !!value, "Buy Pirate Boost", "Buy Pirate Boost");
}

/* =========================================================
   RESOURCE SELECT / BOOST LABELS
   kept as no-op for compatibility with existing imports
   ========================================================= */

export function initAttackResourceSelect() {
  /* no-op in light mode */
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

  if (!state.userAddress) {
    setHtml(msgDiv, `<span class="error">❌ Wallet not connected.</span>`);
    return;
  }

  if (!state.pitroneContract || !state.piratesV6Contract) {
    setHtml(msgDiv, `<span class="error">❌ Pirate boost contracts not initialized.</span>`);
    return;
  }

  let days = parseInt(daysInput?.value, 10);
  if (!Number.isFinite(days)) days = 7;
  days = Math.max(1, Math.min(PIRATE_BOOST_MAX_DAYS, days));

  try {
    const attackerTokenId = await getValidAttackerTokenId({ allowFallback: false });
    if (!attackerTokenId) {
      setHtml(msgDiv, `<span class="error">❌ Select a valid attacker block first.</span>`);
      setButtonVisualState("buyPirateBoostBtn", false, "Buy Pirate Boost", "Buy Pirate Boost");
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
      setHtml(
        msgDiv,
        `
          <span class="success">
            ⏳ Approving PITRONE...<br>
            Block: #${attackerTokenId}<br>
            Cost: ${totalCostHuman} PIT
          </span>
        `
      );

      const approveTx = await state.pitroneContract.approve(
        state.piratesV6Contract.address,
        totalCostWei
      );
      await approveTx.wait();
    }

    setHtml(
      msgDiv,
      `
        <span class="success">
          ⏳ Buying Pirate Boost...<br>
          Block: #${attackerTokenId}<br>
          Days: ${days}<br>
          Cost: ${totalCostHuman} PIT<br>
          Effect: +25 percentage points steal bonus
        </span>
      `
    );

    const tx = await state.piratesV6Contract.buyPirateBoost(attackerTokenId, days, {
      gasLimit: 350000
    });

    await tx.wait();

    setHtml(
      msgDiv,
      `
        <span class="success">
          ✅ Pirate Boost activated!<br>
          Block: #${attackerTokenId}<br>
          Days: ${days}<br>
          Paid: ${totalCostHuman} PIT
        </span>
      `
    );

    await updateBalances();
    await loadResourceBalancesOnchain();
    await loadUserAttacks();
    await refreshAttackDropdown();
    refreshBlockMarkings();
  } catch (e) {
    console.error("buyPirateBoost error:", e);
    setHtml(msgDiv, `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`);
  } finally {
    setButtonBusy("buyPirateBoostBtn", false);
  }
}

/* =========================================================
   ATTACK PREVIEW / LIGHT REDIRECT MODE
   ========================================================= */

export function scheduleAttackDropdownRefresh() {
  clearTimeout(state.attackDropdownTimer);
  state.attackDropdownTimer = setTimeout(() => {
    refreshAttackDropdown();
  }, 250);
}

export async function refreshAttackDropdown() {
  if (!state.userAddress) {
    clearAttackUiDisconnected();
    return;
  }

  const attackerTokenId = await updateAttackerSelectorUi();

  renderMapRedirectInfo();
  setButtonVisualState("attackBtn", true, "🗺️ Open Pyramid Map", "🗺️ Open Pyramid Map");
  setButtonVisualState("buyPirateBoostBtn", !!attackerTokenId, "Buy Pirate Boost", "Buy Pirate Boost");
}

/* =========================================================
   USER ATTACKS LIST
   ========================================================= */

export async function loadUserAttacks() {
  if (!state.userAddress || !state.piratesV6Contract) {
    state.userAttacks = [];
    displayUserAttacks();
    stopAttacksTicker();
    return;
  }

  try {
    const subgraphAttacks = await loadMyAttacksV6FromSubgraph(state.userAddress);
    const now = Math.floor(Date.now() / 1000);
    const seen = new Set();

    const remoteAttacks = (subgraphAttacks || [])
      .map((a) => ({
        id: a?.id,
        targetTokenId: toSafeNumber(a?.targetTokenId, NaN),
        attackerTokenId: toSafeNumber(
          a?.attackerTokenId ??
          a?.attackerBlockId ??
          a?.attackerToken?.tokenId ??
          a?.attackerToken?.id ??
          a?.attacker?.tokenId ??
          a?.attacker?.id,
          0
        ),
        attackIndex: toSafeNumber(a?.attackIndex, NaN),
        startTime: toSafeNumber(a?.startTime, 0),
        endTime: toSafeNumber(a?.endTime, 0),
        executed: toSafeBool(a?.executed),
        cancelled: toSafeBool(a?.cancelled),
        resource: toSafeNumber(a?.resource ?? a?.resourceId, 0),
        localPending: false
      }))
      .filter((a) => {
        if (!Number.isFinite(a.targetTokenId) || !Number.isFinite(a.attackIndex)) {
          return false;
        }

        if (a.executed || a.cancelled) {
          return false;
        }

        const key = `${a.targetTokenId}:${a.attackIndex}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

    const remoteKeys = new Set(remoteAttacks.map((a) => `${a.targetTokenId}:${a.attackIndex}`));
    const pendingLocalAttacks = loadPendingLocalAttackObjects()
      .map(normalizePendingLocalAttack)
      .filter(Boolean)
      .filter((a) => {
        const key = a.attackIndex !== null ? `${a.targetTokenId}:${a.attackIndex}` : `${a.targetTokenId}:local`;
        if (a.attackIndex !== null && remoteKeys.has(`${a.targetTokenId}:${a.attackIndex}`)) {
          localStorage.removeItem(getAttackStorageKey(a.targetTokenId));
          return false;
        }
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const parsedAttacks = [...pendingLocalAttacks, ...remoteAttacks]
      .sort((a, b) => {
        const aReady = a.endTime > 0 && a.endTime <= now;
        const bReady = b.endTime > 0 && b.endTime <= now;
        if (aReady !== bReady) return aReady ? -1 : 1;
        if (!!a.localPending !== !!b.localPending) return a.localPending ? -1 : 1;
        return a.endTime - b.endTime;
      });

    state.userAttacks = parsedAttacks;
    displayUserAttacks();
    refreshBlockMarkings();
    startAttacksTicker();

    const readyAttacks = parsedAttacks
      .filter((a) => Number.isFinite(Number(a.attackIndex)) && a.endTime > 0 && a.endTime <= now)
      .slice(0, 8);

    for (const attack of readyAttacks) {
      try {
        const onChainAttack = await state.piratesV6Contract.getAttack(
          attack.targetTokenId,
          attack.attackIndex
        );

        const normalized = normalizeAttackTuple(onChainAttack);

        if (normalized.executed || normalized.cancelled) {
          state.userAttacks = state.userAttacks.filter(
            (x) =>
              !(
                Number(x.targetTokenId) === Number(attack.targetTokenId) &&
                Number(x.attackIndex) === Number(attack.attackIndex)
              )
          );
        } else if (!attack.attackerTokenId && Number(normalized.attackerTokenId || 0) > 0) {
          attack.attackerTokenId = Number(normalized.attackerTokenId || 0);
        }
      } catch (e) {
        console.warn(
          "Ready-attack validation skipped:",
          attack?.id || `${attack.targetTokenId}:${attack.attackIndex}`,
          e
        );
      }
    }

    displayUserAttacks();
    refreshBlockMarkings();

    if (state.selectedBlock?.tokenId) {
      const selectedTokenId = Number(state.selectedBlock.tokenId);
      const matchingAttack = state.userAttacks.find(
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
    state.userAttacks = [];
    displayUserAttacks();
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
      const resourceLabel = resourceNames[attack.resource] || `Resource ${attack.resource}`;

      return `
        <div class="attack-item" data-endtime="${attack.endTime}" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">
          <div>
            <div><strong>Target #${attack.targetTokenId}</strong> (${resourceLabel})</div>
            <div>From attacker #${attack.attackerTokenId || "—"}</div>
            <div class="attack-status" data-endtime="${attack.endTime}">
              ${timeLeft <= 0 ? "Ready to execute" : "⏳ " + formatTime(timeLeft) + " remaining"}
            </div>
          </div>
          <div class="attack-actions">
            <button class="execute-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">
              🗺️ Open in Map
            </button>
            <button class="cancel-attack-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}" title="Cancel attack">✖️</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".execute-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      openAttackInMap(targetTokenId, attackIndex);
    });
  });

  container.querySelectorAll(".cancel-attack-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetTokenId = parseInt(btn.dataset.targetid, 10);
      const attackIndex = parseInt(btn.dataset.attackindex, 10);
      await cancelAttack(targetTokenId, attackIndex);
    });
  });
}

function openAttackInMap(targetTokenId = null, attackIndex = null) {
  window.location.href = getMapAttackUrl({
    targetTokenId,
    attackIndex
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
  openAttackInMap(targetTokenId, attackIndex);
}

export async function cancelAttack(targetTokenId, attackIndex) {
  const msgDiv = getAttackMessageDiv();
  if (!msgDiv) return;

  if (!state.userAddress) {
    setHtml(msgDiv, `<span class="error">❌ Wallet not connected.</span>`);
    return;
  }

  if (!state.piratesV6Contract) {
    setHtml(msgDiv, `<span class="error">❌ PiratesV6 contract not initialized.</span>`);
    return;
  }

  try {
    const liveAttack = await state.piratesV6Contract.getAttack(targetTokenId, attackIndex);
    const normalized = normalizeAttackTuple(liveAttack);

    const attackerAddress = normalized.attacker || normalized.attackerAddress || "";
    if (!attackerAddress || attackerAddress.toLowerCase() !== state.userAddress.toLowerCase()) {
      setHtml(msgDiv, `<span class="error">❌ Not your attack to cancel.</span>`);
      return;
    }

    if (normalized.executed) {
      setHtml(msgDiv, `<span class="error">❌ Cannot cancel executed attack.</span>`);
      await loadUserAttacks();
      return;
    }

    if (normalized.cancelled) {
      setHtml(msgDiv, `<span class="error">❌ Attack already cancelled.</span>`);
      await loadUserAttacks();
      return;
    }

    setHtml(msgDiv, `<span class="success">⏳ Cancelling attack...</span>`);
    const tx = await state.piratesV6Contract.cancelOwnPendingAttack(targetTokenId, attackIndex, {
      gasLimit: 300000
    });
    await tx.wait();

    setHtml(msgDiv, `<span class="success">✅ Attack cancelled.</span>`);
    localStorage.removeItem(getAttackStorageKey(targetTokenId));
    await loadUserAttacks();
    refreshBlockMarkings();
    await refreshAttackDropdown();
  } catch (e) {
    console.error("cancelAttack error:", e);
    setHtml(msgDiv, `<span class="error">❌ ${friendlyErrorMessage(e)}</span>`);
  }
}

/* =========================================================
   START ATTACK
   ========================================================= */

export async function attack() {
  window.location.href = getMapAttackUrl();
}
