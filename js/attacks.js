/* =========================================================
   ATTACKS
   ========================================================= */

   import { state } from "./state.js";
   import { resourceNames, MAX_ROW } from "./config.js";
   import {
     byId,
     formatTime,
     formatDuration,
     normalizeAttackTuple
   } from "./utils.js";
   import { loadMyAttacksV6FromSubgraph } from "./subgraph.js";
   import { loadResourceBalancesOnchain } from "./resources.js";
   import { updateBalances } from "./balances.js";
   
   export async function getValidAttackerTokenId() {
     if (!state.userAddress || !state.nftContract) return null;
   
     if (state.selectedBlock && state.selectedBlock.tokenId) {
       try {
         const owner = await state.nftContract.ownerOf(state.selectedBlock.tokenId);
         if (owner.toLowerCase() === state.userAddress.toLowerCase()) {
           return parseInt(state.selectedBlock.tokenId, 10);
         }
       } catch {}
     }
   
     const balance = await state.nftContract.balanceOf(state.userAddress);
     if (balance.gt(0)) {
       const firstToken = await state.nftContract.tokenOfOwnerByIndex(state.userAddress, 0);
       return firstToken.toNumber();
     }
   
     return null;
   }
   
   export function initAttackResourceSelect() {
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
     const select = byId("attackResourceSelect");
     const msg = byId("attackMessage");
     const info = byId("attackRulesInfo");
     const previewDetails = byId("attackPreviewDetails");
   
     if (!select) return;
   
     if (
       !Number.isFinite(row) ||
       !Number.isFinite(col) ||
       row < 0 ||
       row > MAX_ROW ||
       col < 0 ||
       col > 2 * row
     ) {
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
         resourceNames.forEach((name, id) => {
           const opt = document.createElement("option");
           opt.value = id;
           opt.textContent = `${name} ⚠️`;
           select.appendChild(opt);
         });
       }
   
       const previewToShow =
         allowedResources.length > 0 ? previews[allowedResources[0]] : previews[0];
   
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
   
         if (
           previewDetails &&
           previewToShow.allowed &&
           targetOwner.toLowerCase() !== state.userAddress.toLowerCase()
         ) {
           previewDetails.style.display = "block";
           previewDetails.innerHTML = `
             <strong>Attack Preview</strong><br>
             From Block #${attackerTokenId} → Target #${targetTokenId}<br>
             Resource: ${resourceNames[parseInt(select.value || "0", 10)]}<br>
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
               <div class="attack-status" data-endtime="${attack.endTime}">
                 ${timeLeft <= 0 ? "Ready to execute" : "⏳ " + formatTime(timeLeft) + " remaining"}
               </div>
             </div>
             <div class="attack-actions">
               ${
                 timeLeft <= 0
                   ? `<button class="execute-btn" data-targetid="${attack.targetTokenId}" data-attackindex="${attack.attackIndex}">⚔️ Execute</button>`
                   : `<button class="execute-btn" disabled>⏳ Waiting</button>`
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
   
   export async function executeAttack(targetTokenId, attackIndex) {
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
   
   export async function cancelAttack(targetTokenId, attackIndex) {
     const msgDiv = byId("attackMessage");
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
     } catch (e) {
       console.error("cancelAttack error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }
   
   export async function attack() {
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
   
       const tx = await state.piratesV6Contract.startAttack(attackerTokenId, targetTokenId, resource, {
         gasLimit: 450000
       });
       await tx.wait();
   
       msgDiv.innerHTML = `<span class="success">✅ Attack started! Check back later.</span>`;
       await loadUserAttacks();
       refreshBlockMarkings();
     } catch (e) {
       console.error("startAttack error:", e);
       msgDiv.innerHTML = `<span class="error">❌ ${e.reason || e.message}</span>`;
     }
   }