/* =========================================================
   INPINITY TUTORIAL
   - Onboarding modal (5 steps, localStorage gate)
   - Live status bar
   - "Getting Started" checklist
   ========================================================= */

   const ONBOARDING_KEY = "inpinity_onboarding_done_v1";

   const ONBOARDING_STEPS = [
     {
       icon: "🦊",
       title: "Step 1 — Connect your wallet",
       text: "Click <strong>Connect Wallet</strong> at the top. We use Base Mainnet. Your address will appear in the top right once connected."
     },
     {
       icon: "🧱",
       title: "Step 2 — Mint a block (if you don't own one yet)",
       text: "In the <strong>Mint a New Block</strong> section, choose coordinates and pay with ETH or INPI. Every block is an NFT."
     },
     {
       icon: "🔓",
       title: "Step 3 — Reveal your block",
       text: "Click your block in the grid above → <strong>Reveal</strong> button. This exposes rarity and resource production rate."
     },
     {
       icon: "🌾",
       title: "Step 4 — Start farming",
       text: "After reveal: <strong>Start Farming</strong>. Your block now produces resources 24/7. Every 24h you can harvest with <strong>Claim</strong>."
     },
     {
       icon: "🛡️⚔️",
       title: "Step 5 — Defend & attack",
       text: "Other players can steal your resources. Defense: <strong>Mercenary</strong> (protection 20/30/50%). Attack: open <strong>Pyramid Map</strong> → click target → Attack."
     }
   ];
   
   /* ==================== ONBOARDING MODAL ==================== */
   
   let currentStep = 0;
   
   export function initOnboarding() {
     const modal = document.getElementById("onboardingModal");
     if (!modal) return;
   
     const alreadyDone = localStorage.getItem(ONBOARDING_KEY) === "1";
     if (alreadyDone) {
       modal.style.display = "none";
       return;
     }
   
     modal.style.display = "flex";
     renderStep(modal);
     bindModalEvents(modal);
   }
   
   function renderStep(modal) {
     const step = ONBOARDING_STEPS[currentStep];
     const total = ONBOARDING_STEPS.length;
   
     const iconEl = modal.querySelector("[data-onboard-icon]");
     const titleEl = modal.querySelector("[data-onboard-title]");
     const textEl = modal.querySelector("[data-onboard-text]");
     const counterEl = modal.querySelector("[data-onboard-counter]");
     const progressEl = modal.querySelector("[data-onboard-progress]");
     const prevBtn = modal.querySelector("[data-onboard-prev]");
     const nextBtn = modal.querySelector("[data-onboard-next]");
   
     if (iconEl) iconEl.textContent = step.icon;
     if (titleEl) titleEl.textContent = step.title;
     if (textEl) textEl.innerHTML = step.text;
     if (counterEl) counterEl.textContent = `${currentStep + 1} / ${total}`;
     if (progressEl) progressEl.style.width = `${((currentStep + 1) / total) * 100}%`;
   
     if (prevBtn) prevBtn.style.visibility = currentStep === 0 ? "hidden" : "visible";
     if (nextBtn) {
       nextBtn.textContent = currentStep === total - 1 ? "Let's go 🚀" : "Next →";
     }
   }
   
   function bindModalEvents(modal) {
     modal.querySelector("[data-onboard-prev]")?.addEventListener("click", () => {
       if (currentStep > 0) {
         currentStep--;
         renderStep(modal);
       }
     });
   
     modal.querySelector("[data-onboard-next]")?.addEventListener("click", () => {
       if (currentStep < ONBOARDING_STEPS.length - 1) {
         currentStep++;
         renderStep(modal);
       } else {
         dismissOnboarding(modal);
       }
     });
   
     modal.querySelector("[data-onboard-skip]")?.addEventListener("click", () => {
       dismissOnboarding(modal);
     });
   
     modal.querySelector("[data-onboard-dismiss]")?.addEventListener("click", () => {
       dismissOnboarding(modal);
     });
   }
   
   function dismissOnboarding(modal) {
     modal.style.display = "none";
     localStorage.setItem(ONBOARDING_KEY, "1");
   }
   
   /* ==================== LIVE STATUS BAR ==================== */
   
   export function initStatusBar() {
     updateStatusBar();
     setInterval(updateStatusBar, 3000);
   }
   
   function readText(id) {
     return document.getElementById(id)?.textContent?.trim() || "";
   }
   
   function countFromBlocksGrid() {
     const grid = document.getElementById("blocksGrid");
     if (!grid) return 0;
     return grid.querySelectorAll(".block-card").length;
   }
   
   function updateStatusBar() {
     const farmsEl = document.getElementById("statusFarms");
     const resourcesEl = document.getElementById("statusResources");
     const protectionEl = document.getElementById("statusProtection");
     const attacksEl = document.getElementById("statusAttacks");
   
     const activeFarms = readText("activeFarms") || "0";
     if (farmsEl) farmsEl.textContent = activeFarms;
   
     const resourceItems = document.querySelectorAll("#userResources .resource-item");
     if (resourcesEl) resourcesEl.textContent = resourceItems.length;
   
     const protectionActive = readText("protectionStatusText");
     if (protectionEl) {
       protectionEl.textContent = protectionActive && protectionActive !== "Inactive" ? "Active" : "—";
       protectionEl.style.color = protectionActive && protectionActive !== "Inactive" ? "#5CFF95" : "";
     }
   
     const attacks = document.querySelectorAll("#userAttacksList .attack-item");
     if (attacksEl) {
       const now = Math.floor(Date.now() / 1000);
       let readyCount = 0;
       attacks.forEach((item) => {
         const endTime = parseInt(item.querySelector(".attack-status")?.dataset?.endtime || "0", 10);
         if (endTime > 0 && endTime <= now) readyCount++;
       });
       attacksEl.textContent = attacks.length ? `${attacks.length} (${readyCount} ready)` : "0";
       attacksEl.style.color = readyCount > 0 ? "#FF6B6B" : "";
     }
   }
   
   /* ==================== "GETTING STARTED" CHECKLIST ==================== */
   
   export function initChecklist() {
     updateChecklist();
     setInterval(updateChecklist, 5000);
   }
   
   function updateChecklist() {
     const walletDone = readText("walletStatus").includes("Connected") || readText("walletStatus").includes("🟢");
     const blockCount = countFromBlocksGrid();
     const hasBlock = blockCount > 0;
     const hasRevealed = !!document.querySelector(".block-card.revealed");
     const hasFarmActive = (parseInt(readText("activeFarms") || "0", 10)) > 0;
     const hasProtection = readText("protectionStatusText") && readText("protectionStatusText") !== "Inactive";
   
     setChecklistItem("checkWallet", walletDone);
     setChecklistItem("checkBlock", hasBlock);
     setChecklistItem("checkReveal", hasRevealed);
     setChecklistItem("checkFarm", hasFarmActive);
     setChecklistItem("checkProtection", hasProtection);
   
     const progress = [walletDone, hasBlock, hasRevealed, hasFarmActive, hasProtection].filter(Boolean).length;
     const progressEl = document.getElementById("checklistProgress");
     if (progressEl) progressEl.textContent = `${progress}/5`;
   }
   
   function setChecklistItem(id, done) {
     const el = document.getElementById(id);
     if (!el) return;
     const icon = el.querySelector(".checklist-icon");
     if (icon) icon.textContent = done ? "✅" : "⬜";
     el.style.opacity = done ? "0.65" : "1";
     el.style.textDecoration = done ? "line-through" : "none";
   }
   
   /* ==================== AUTO-INIT ==================== */
   
   export function initTutorial() {
     initOnboarding();
     initStatusBar();
     initChecklist();
   }