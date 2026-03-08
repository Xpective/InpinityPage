/* =========================================================
   CONTRACT MANAGEMENT – V6 ONLY
   ========================================================= */

   import {
    NFT_ADDRESS,
    FARMING_V6_ADDRESS,
    PIRATES_V6_ADDRESS,
    MERCENARY_V2_ADDRESS,
    PARTNERSHIP_V2_ADDRESS,
    RESOURCE_TOKEN_ADDRESS,
    INPI_ADDRESS,
    PITRONE_ADDRESS
  } from "./config.js";
  
  import {
    NFT_ABI,
    FARMING_V6_ABI,
    PIRATES_V6_ABI,
    MERCENARY_V2_ABI,
    PARTNERSHIP_V2_ABI,
    RESOURCE_TOKEN_ABI,
    INPI_ABI,
    PITRONE_ABI
  } from "./abis.js";
  
  import { state } from "./state.js";
  import { debugLog } from "./utils.js";
  
  export async function ensureBaseNetwork() {
    const network = await state.provider.getNetwork();
    if (Number(network.chainId) === 8453) return;
  
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }]
      });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x2105",
            chainName: "Base Mainnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"]
          }]
        });
      } else {
        throw e;
      }
    }
  
    // Re-initialize provider after network switch
    state.provider = new ethers.providers.Web3Provider(window.ethereum);
    state.signer = state.provider.getSigner();
    state.userAddress = await state.signer.getAddress();
  }
  
  export function setupContracts() {
    if (!state.signer) {
      throw new Error("No signer available");
    }
  
    state.nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, state.signer);
    state.farmingV6Contract = new ethers.Contract(FARMING_V6_ADDRESS, FARMING_V6_ABI, state.signer);
    state.piratesV6Contract = new ethers.Contract(PIRATES_V6_ADDRESS, PIRATES_V6_ABI, state.signer);
    state.mercenaryV2Contract = new ethers.Contract(MERCENARY_V2_ADDRESS, MERCENARY_V2_ABI, state.signer);
    state.partnershipV2Contract = new ethers.Contract(PARTNERSHIP_V2_ADDRESS, PARTNERSHIP_V2_ABI, state.signer);
    state.inpiContract = new ethers.Contract(INPI_ADDRESS, INPI_ABI, state.signer);
    state.pitroneContract = new ethers.Contract(PITRONE_ADDRESS, PITRONE_ABI, state.signer);
    state.resourceTokenContract = new ethers.Contract(RESOURCE_TOKEN_ADDRESS, RESOURCE_TOKEN_ABI, state.signer);
  
    debugLog("Contracts initialized");
  }
  
  export function clearContracts() {
    state.provider = null;
    state.signer = null;
    state.userAddress = null;
  
    state.nftContract = null;
    state.farmingV6Contract = null;
    state.piratesV6Contract = null;
    state.mercenaryV2Contract = null;
    state.partnershipV2Contract = null;
    state.inpiContract = null;
    state.pitroneContract = null;
    state.resourceTokenContract = null;
  
    state.selectedBlock = null;
    state.userBlocks = [];
    state.userAttacks = [];
    state.userResources = [];
    state.cachedFarmsV6 = [];
    state.cachedProtections = [];
    state.cachedFarmV6Map = new Map();
    state.cachedProtectionMap = new Map();
  
    debugLog("Contracts cleared");
  }
  
  export async function connectWalletCore(forceRequest = true) {
    if (!window.ethereum) throw new Error("Please install MetaMask");
  
    state.provider = new ethers.providers.Web3Provider(window.ethereum);
  
    let accounts = [];
    if (forceRequest) {
      accounts = await state.provider.send("eth_requestAccounts", []);
    } else {
      accounts = await state.provider.listAccounts();
      if (!accounts.length) return false;
    }
  
    state.signer = state.provider.getSigner();
    state.userAddress = accounts[0] || await state.signer.getAddress();
  
    await ensureBaseNetwork();
    setupContracts();
  
    return true;
  }