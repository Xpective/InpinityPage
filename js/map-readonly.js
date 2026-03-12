/* =========================================================
   MAP READONLY
   ========================================================= */

   import { NFT_ADDRESS } from "./config.js";
   import { mapState } from "./map-state.js";
   
   export async function initMapReadOnly() {
     if (mapState.readOnlyProvider && mapState.nftReadOnlyContract) return;
   
     mapState.readOnlyProvider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
   
     mapState.nftReadOnlyContract = new ethers.Contract(
       NFT_ADDRESS,
       [
         "function ownerOf(uint256 tokenId) view returns (address)",
         "function calculateRarity(uint256 tokenId) view returns (uint8)",
         "function blockData(uint256) view returns (uint8 piDigit, uint8 phiDigit, uint256 row, uint256 col, bool revealed, uint256 farmingEndTime)"
       ],
       mapState.readOnlyProvider
     );
   }