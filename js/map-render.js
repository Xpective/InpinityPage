/* =========================================================
   MAP RENDER / CANVAS / INPUT
   ========================================================= */

   import { state } from "./state.js";
   import { rarityNames } from "./config.js";
   import {
     byId,
     shortenAddress,
     formatTime
   } from "./utils.js";
   import {
     mapState,
     BASE_BLOCK_SIZE,
     MOVE_THRESHOLD,
     rarityColors
   } from "./map-state.js";
   import { getAllMapTokens, getUserAttacks } from "./map-data.js";
   import { updateSidebar } from "./map-selection.js";
   
   const canvas = byId("pyramidCanvas");
   const ctx = canvas?.getContext("2d");
   const container = byId("canvasContainer");
   const tooltip = byId("tooltip");
   
   export function getCanvasElements() {
     return { canvas, ctx, container, tooltip };
   }
   
   export function drawPyramid() {
     if (!canvas || !ctx) return;
   
     const tokens = getAllMapTokens();
     const userAttacks = getUserAttacks();
   
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.save();
     ctx.translate(mapState.offsetX, mapState.offsetY);
     ctx.scale(mapState.scale, mapState.scale);
   
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
   
           if (
             state.userAddress &&
             token.owner &&
             token.owner.toLowerCase() === state.userAddress.toLowerCase()
           ) {
             fillColor = "#9b59b6";
           }
   
           const attack = userAttacks.find((a) => String(a.targetTokenId) === tokenId);
           if (attack) {
             if (attack.endTime <= now) {
               strokeColor = "#e74c3c";
               lineWidth = 4;
             } else {
               strokeColor = "#000000";
               lineWidth = 4;
             }
           } else if (token.protectionActive) {
             strokeColor = "#9b59b6";
             lineWidth = 3;
           } else if (token.farmActive) {
             strokeColor = "#3498db";
             lineWidth = 3;
           } else if (token.farmV5Active) {
             strokeColor = "#ff8c00";
             lineWidth = 3;
           }
         }
   
         ctx.fillStyle = fillColor;
         ctx.fillRect(x, y, BASE_BLOCK_SIZE, BASE_BLOCK_SIZE);
   
         if (strokeColor) {
           ctx.strokeStyle = strokeColor;
           ctx.lineWidth = lineWidth;
           ctx.strokeRect(x, y, BASE_BLOCK_SIZE, BASE_BLOCK_SIZE);
         }
   
         if (mapState.selectedTokenId === tokenId) {
           ctx.save();
           ctx.strokeStyle = "#ffffff";
           ctx.lineWidth = 3;
           ctx.strokeRect(x + 1, y + 1, BASE_BLOCK_SIZE - 2, BASE_BLOCK_SIZE - 2);
           ctx.restore();
         }
   
         if (token?.partnerActive) {
           ctx.save();
           ctx.translate(x + BASE_BLOCK_SIZE - 8, y + 8);
           ctx.font = 'bold 16px "Inter", sans-serif';
           ctx.fillStyle = "#FFD700";
           ctx.shadowColor = "#000";
           ctx.shadowBlur = 4;
           ctx.fillText("★", -8, 4);
           ctx.restore();
         }
   
         if (token?.farmV5Active) {
           ctx.save();
           ctx.fillStyle = "#ff8c00";
           ctx.beginPath();
           ctx.arc(x + 6, y + 6, 4, 0, Math.PI * 2);
           ctx.fill();
           ctx.restore();
         }
       }
     }
   
     ctx.restore();
   }
   
   export function centerPyramid() {
     if (!canvas) return;
   
     const totalWidth = 199 * BASE_BLOCK_SIZE;
     const totalHeight = 100 * BASE_BLOCK_SIZE;
     const scaleX = (canvas.width / totalWidth) * 0.95;
     const scaleY = (canvas.height / totalHeight) * 0.95;
   
     mapState.scale = Math.min(scaleX, scaleY, 1.5);
     mapState.offsetX = (canvas.width - totalWidth * mapState.scale) / 2;
     mapState.offsetY = (canvas.height - totalHeight * mapState.scale) / 2;
   
     drawPyramid();
   }
   
   export function resizeCanvas() {
     if (!canvas || !container) return;
     canvas.width = container.clientWidth;
     canvas.height = container.clientHeight;
     centerPyramid();
   }
   
   function findTokenIdAtClientPoint(clientX, clientY) {
     if (!canvas) return null;
   
     const rect = canvas.getBoundingClientRect();
     const mouseX = (clientX - rect.left - mapState.offsetX) / mapState.scale;
     const mouseY = (clientY - rect.top - mapState.offsetY) / mapState.scale;
   
     for (let row = 0; row < 100; row++) {
       const y = row * BASE_BLOCK_SIZE;
       if (mouseY < y || mouseY > y + BASE_BLOCK_SIZE) continue;
   
       const col = Math.round((mouseX / BASE_BLOCK_SIZE) + row);
       if (col >= 0 && col <= 2 * row) {
         return String(row * 2048 + col);
       }
     }
   
     return null;
   }
   
   function handleWheel(e) {
     if (!canvas) return;
   
     e.preventDefault();
     const zoomFactor = 1.1;
     const delta = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
   
     const rect = canvas.getBoundingClientRect();
     const mouseX = e.clientX - rect.left;
     const mouseY = e.clientY - rect.top;
   
     const worldX = (mouseX - mapState.offsetX) / mapState.scale;
     const worldY = (mouseY - mapState.offsetY) / mapState.scale;
   
     mapState.scale = Math.max(0.2, Math.min(5, mapState.scale * delta));
     mapState.offsetX = mouseX - worldX * mapState.scale;
     mapState.offsetY = mouseY - worldY * mapState.scale;
   
     drawPyramid();
   }
   
   async function handleClick(e) {
     const tokenId = findTokenIdAtClientPoint(e.clientX, e.clientY);
     if (!tokenId) return;
     await updateSidebar(tokenId);
     drawPyramid();
   }
   
   function handleMouseMove(e) {
     if (!canvas || !tooltip || mapState.isDragging) return;
   
     const tokens = getAllMapTokens();
     const userAttacks = getUserAttacks();
     const tokenId = findTokenIdAtClientPoint(e.clientX, e.clientY);
   
     if (!tokenId) {
       tooltip.style.opacity = 0;
       return;
     }
   
     const token = tokens[tokenId];
     let html = `<span>Block #${tokenId}</span><br>`;
   
     if (token?.owner) {
       html += `Owner: ${shortenAddress(token.owner)}<br>`;
       html += `Status: ${token.revealed ? "Revealed" : "Minted"}`;
   
       if (token.farmActive) html += " · Farming V6";
       else if (token.farmV5Active) html += " · Farming V5";
   
       if (token.protectionActive) html += " · Protected";
       if (token.partnerActive) html += " ⭐";
       if (token.rarity !== null) html += ` · ${rarityNames[token.rarity]}`;
   
       const attack = userAttacks.find((a) => String(a.targetTokenId) === tokenId);
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
       mapState.touchStartX = e.touches[0].clientX;
       mapState.touchStartY = e.touches[0].clientY;
       mapState.touchMoved = false;
       mapState.isDragging = false;
       e.preventDefault();
     } else if (e.touches.length === 2) {
       e.preventDefault();
       mapState.pinchStartDist = Math.hypot(
         e.touches[0].clientX - e.touches[1].clientX,
         e.touches[0].clientY - e.touches[1].clientY
       );
     }
   }
   
   function handleTouchMove(e) {
     e.preventDefault();
   
     if (e.touches.length === 1) {
       const dx = e.touches[0].clientX - mapState.touchStartX;
       const dy = e.touches[0].clientY - mapState.touchStartY;
       const distance = Math.hypot(dx, dy);
   
       if (distance > MOVE_THRESHOLD) {
         mapState.touchMoved = true;
         mapState.isDragging = true;
         mapState.offsetX += dx;
         mapState.offsetY += dy;
         mapState.touchStartX = e.touches[0].clientX;
         mapState.touchStartY = e.touches[0].clientY;
         drawPyramid();
       }
     } else if (e.touches.length === 2) {
       const dist = Math.hypot(
         e.touches[0].clientX - e.touches[1].clientX,
         e.touches[0].clientY - e.touches[1].clientY
       );
   
       if (mapState.pinchStartDist > 0) {
         const zoomFactor = dist / mapState.pinchStartDist;
         mapState.pinchStartDist = dist;
   
         const rect = canvas.getBoundingClientRect();
         const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
         const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
   
         const worldX = (mx - mapState.offsetX) / mapState.scale;
         const worldY = (my - mapState.offsetY) / mapState.scale;
   
         mapState.scale = Math.max(0.2, Math.min(5, mapState.scale * zoomFactor));
         mapState.offsetX = mx - worldX * mapState.scale;
         mapState.offsetY = my - worldY * mapState.scale;
   
         drawPyramid();
       }
     }
   }
   
   function handleTouchEnd(e) {
     if (e.touches.length === 0) {
       if (!mapState.touchMoved && !mapState.isDragging) {
         handleClick({ clientX: mapState.touchStartX, clientY: mapState.touchStartY });
       }
       mapState.isDragging = false;
       mapState.pinchStartDist = 0;
       mapState.touchMoved = false;
     }
   }
   
   function handleMouseDown(e) {
     if (!canvas) return;
     mapState.isDragging = true;
     mapState.lastMouseX = e.clientX;
     mapState.lastMouseY = e.clientY;
     canvas.style.cursor = "grabbing";
   }
   
   function handleGlobalMouseMove(e) {
     if (mapState.isDragging) {
       const dx = e.clientX - mapState.lastMouseX;
       const dy = e.clientY - mapState.lastMouseY;
   
       mapState.offsetX += dx;
       mapState.offsetY += dy;
       mapState.lastMouseX = e.clientX;
       mapState.lastMouseY = e.clientY;
       drawPyramid();
     } else {
       handleMouseMove(e);
     }
   }
   
   function handleGlobalMouseUp() {
     mapState.isDragging = false;
     if (canvas) canvas.style.cursor = "grab";
   }
   
   export function bindMapRenderEvents() {
     window.addEventListener("resize", resizeCanvas);
     window.addEventListener("mousemove", handleGlobalMouseMove);
     window.addEventListener("mouseup", handleGlobalMouseUp);
   
     if (!canvas) return;
   
     canvas.addEventListener("wheel", handleWheel, { passive: false });
     canvas.addEventListener("click", handleClick);
     canvas.addEventListener("mousedown", handleMouseDown);
   
     canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
     canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
     canvas.addEventListener("touchend", handleTouchEnd);
     canvas.addEventListener("touchcancel", handleTouchEnd);
   }