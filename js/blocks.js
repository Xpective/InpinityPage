/* =========================================================
   BLOCKS
   ========================================================= */

   import { state } from "./state.js";
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
     loadProtectionsFromSubgraph,
     buildFarmV6Map,
     buildProtectionMap
   } from "./subgraph.js";
   import { isTokenActiveOnV5 } from "./migration.js";
   
   export async function loadUserBlocks({ onRevealSelected, onRefreshBlockMarkings } = {}) {
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
   
         const protection = state.cachedProtectionMap.get(tokenId);
         const protectionActive = !!(protection && protection.active && protection.expiresAt > now);
   
         let classNames = revealed ? "revealed" : "hidden";
         if (farmingActive) classNames += " farming";
         if (activeOnV5 && !farmingActive) classNames += " legacy-farming";
         if (protectionActive) classNames += " protected";
         if (state.selectedBlock && String(state.selectedBlock.tokenId) === tokenId) classNames += " selected";
   
         const badge = revealed
           ? `<div class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</div>`
           : `<div class="rarity-badge hidden-badge">🔒 Hidden</div>`;
   
         const legacyBadge = activeOnV5 && !farmingActive
           ? `<div class="rarity-badge" style="background:#8a5cff; color:white; margin-top:4px;">V5 Active</div>`
           : "";
   
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
             ${legacyBadge}
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
   
   export async function selectBlock(tokenId, row, col) {
     const now = Math.floor(Date.now() / 1000);
   
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
     const farmStartTime = farm ? farm.startTime : 0;
     const boostExpiry = farm ? farm.boostExpiry : 0;
   
     const protection = state.cachedProtectionMap.get(String(tokenId));
     const protectionLevel = protection ? protection.level : 0;
     const protectionActive = !!(protection && protection.active && protection.expiresAt > now);
   
     const activeOnV5 = await isTokenActiveOnV5(tokenId).catch(() => false);
   
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
       boostExpiry,
       activeOnV5
     };
   
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
   
     safeText("revealStatus", revealed ? "Revealed" : "Hidden");
     safeText("farmingStatus", farmingActive ? "Active (V6)" : (activeOnV5 ? "Active (V5)" : "Inactive"));
     safeText("boostStatus", boostExpiry > now ? "Active" : "Inactive");
   
     safeDisabled("revealBtn", revealed);
     safeDisabled("farmingStartBtn", farmingActive || activeOnV5);
     safeDisabled("farmingStopBtn", !farmingActive);
     safeDisabled("claimBtn", !farmingActive);
     safeDisabled("buyBoostBtn", !farmingActive);
   
     if (farmingActive) {
       try {
         const preview = await state.farmingV6Contract.previewClaim(tokenId);
         if (preview.allowed) {
           safeText("claimStatus", "Ready");
         } else {
           safeText("claimStatus", `in ${formatDuration(preview.secondsRemaining)}`);
         }
       } catch {
         safeText("claimStatus", "—");
       }
     } else {
       safeText("claimStatus", "—");
     }
   
     const protectionStatusEl = byId("protectionStatus");
     const protectionExpiryEl = byId("protectionExpiry");
   
     if (protectionActive && protectionExpiryEl) {
       protectionExpiryEl.textContent = formatDuration(protection.expiresAt - now);
       if (protectionStatusEl) protectionStatusEl.style.display = "block";
     } else if (protectionStatusEl) {
       protectionStatusEl.style.display = "none";
     }
   
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