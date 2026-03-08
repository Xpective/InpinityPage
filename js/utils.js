/* =========================================================
   UTILITY FUNCTIONS – V6 ONLY
   ========================================================= */

   import { state } from "./state.js";

   // DOM Helpers
   export function byId(id) {
     return document.getElementById(id);
   }
   
   export function safeText(id, txt) {
     const el = byId(id);
     if (el) el.innerText = txt;
   }
   
   export function safeHTML(id, html) {
     const el = byId(id);
     if (el) el.innerHTML = html;
   }
   
   export function safeValue(id, val) {
     const el = byId(id);
     if (el) el.value = val;
   }
   
   export function safeDisabled(id, disabled) {
     const el = byId(id);
     if (el) el.disabled = disabled;
   }
   
   // Formatting
   export function shortenAddress(addr) {
     return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
   }
   
   export function formatTime(seconds) {
     seconds = Math.max(0, Number(seconds || 0));
     if (seconds < 60) return seconds + "s";
     if (seconds < 3600) return Math.floor(seconds / 60) + "m";
     return Math.floor(seconds / 3600) + "h";
   }
   
   export function formatDuration(seconds) {
     seconds = Math.max(0, Math.floor(Number(seconds || 0)));
     const d = Math.floor(seconds / 86400);
     const h = Math.floor((seconds % 86400) / 3600);
     const m = Math.floor((seconds % 3600) / 60);
     if (d > 0) return `${d}d ${h}h`;
     if (h > 0) return `${h}h ${m}m`;
     return `${m}m`;
   }
   
   // BigNumber Helpers
   export function bn(value) {
     return ethers.BigNumber.isBigNumber(value) ? value : ethers.BigNumber.from(value || 0);
   }
   
   export function bnIsZero(value) {
     try { return bn(value).isZero(); } catch { return true; }
   }
   
   export function bnGtZero(value) {
     try { return bn(value).gt(0); } catch { return false; }
   }
   
   // Attack Tuple Normalization
   export function normalizeAttackTuple(a) {
     return {
       attacker: a.attacker ?? a[0],
       attackerTokenId: Number(a.attackerTokenId ?? a[1] ?? 0),
       targetTokenId: Number(a.targetTokenId ?? a[2] ?? 0),
       startTime: Number(a.startTime ?? a[3] ?? 0),
       endTime: Number(a.endTime ?? a[4] ?? 0),
       resource: Number(a.resource ?? a[5] ?? 0),
       executed: Boolean(a.executed ?? a[6]),
       cancelled: Boolean(a.cancelled ?? a[7]),
     };
   }
   
   // Production Calculator
   export function getProduction(rarity, row) {
     const p = {};
     if (rarity === 0) { p.OIL = 10; p.LEMONS = 5; p.IRON = 3; }
     else if (rarity === 1) { p.OIL = 20; p.LEMONS = 10; p.IRON = 6; p.GOLD = 1; }
     else if (rarity === 2) { p.OIL = 30; p.LEMONS = 15; p.IRON = 9; p.GOLD = 2; p.PLATINUM = 1; }
     else if (rarity === 3) { p.OIL = 40; p.LEMONS = 20; p.IRON = 12; p.GOLD = 3; p.PLATINUM = 2; p.CRYSTAL = 1; }
     else if (rarity === 4) {
       p.OIL = 60; p.LEMONS = 30; p.IRON = 18; p.GOLD = 5; p.PLATINUM = 3; p.CRYSTAL = 2; p.MYSTERIUM = 1;
       if (row === 0) p.AETHER = 1;
     }
     return p;
   }
   
   // Debug
   export function debugLog(message, data = null) {
     const logDiv = byId("debugLog");
     let line = `[${new Date().toLocaleTimeString()}] ${message}`;
     if (data !== null) {
       try {
         line += " " + JSON.stringify(data).slice(0, 300);
       } catch {
         line += " " + String(data);
       }
     }
     if (logDiv) logDiv.innerHTML = line + "\n" + logDiv.innerHTML;
     console.log(message, data);
   }