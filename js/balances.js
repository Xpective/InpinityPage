/* =========================================================
   BALANCES
   ========================================================= */

   import { state } from "./state.js";
   import { safeText } from "./utils.js";
   
   export async function updateBalances() {
     if (!state.userAddress || !state.provider) return;
   
     const ethBal = await state.provider.getBalance(state.userAddress);
     safeText("balanceEth", `${parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4)} ETH`);
   
     try {
       const inpiBal = await state.inpiContract.balanceOf(state.userAddress);
       const inpiTxt = parseFloat(ethers.utils.formatEther(inpiBal)).toFixed(0);
       safeText("balanceInpi", `${inpiTxt} INPI`);
       safeText("userInpi", inpiTxt);
     } catch (e) {
       console.warn("INPI balance failed:", e.message);
     }
   
     try {
       const pitBal = await state.pitroneContract.balanceOf(state.userAddress);
       const pitTxt = ethers.utils.formatEther(pitBal).split(".")[0];
       safeText("balancePit", `${pitTxt} PIT`);
       safeText("userPitrone", pitTxt);
     } catch (e) {
       console.warn("Pitrone balance failed:", e.message);
     }
   }
   
   export async function updatePoolInfo() {
     if (!state.pitroneContract) return;
   
     try {
       const rate = await state.pitroneContract.getRate();
       safeText("exchangeRate", rate.toString());
   
       const aInpi = await state.pitroneContract.availableINPI();
       safeText("poolInpi", ethers.utils.formatEther(aInpi).split(".")[0]);
   
       const aPit = await state.pitroneContract.availablePitrone();
       safeText("poolPit", ethers.utils.formatEther(aPit).split(".")[0]);
     } catch (e) {
       console.warn("Pool info failed:", e.message);
     }
   }