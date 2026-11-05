/* =========================================================
   INPINITY GAME – ENTRY
   - Slim entry file
   - All logic lives in modular JS files
   ========================================================= */

   import { initGamePage } from "./game-init.js";

   try {
     initGamePage();
   } catch (e) {
     console.error("Failed to initialize game page:", e);
   }