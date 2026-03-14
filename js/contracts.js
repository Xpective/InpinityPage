/* =========================================================
   CONTRACT MANAGEMENT – V6 + MERCENARY V4
   ========================================================= */

   import {
    NFT_ADDRESS,
    FARMING_V6_ADDRESS,
    PIRATES_V6_ADDRESS,
    MERCENARY_V4_ADDRESS,
    PARTNERSHIP_V2_ADDRESS,
    RESOURCE_TOKEN_ADDRESS,
    INPI_ADDRESS,
    PITRONE_ADDRESS
  } from "./config.js";
  
  import {
    NFT_ABI,
    FARMING_V6_ABI,
    PIRATES_V6_ABI,
    MERCENARY_V4_ABI,
    PARTNERSHIP_V2_ABI,
    RESOURCE_TOKEN_ABI,
    INPI_ABI,
    PITRONE_ABI
  } from "./abis.js";
  
  import {
    state,
    resetSelectedBlockUiState,
    resetUiBusyFlags,
    setSelectedBlockState,
    setSelectedAttackAttackerTokenId,
    setMercenaryProfile,
    setMercenarySlots
  } from "./state.js";
  
  import { debugLog } from "./utils.js";
  
  /* =========================================================
     NETWORK
     ========================================================= */
  
  export async function ensureBaseNetwork() {
    if (!window.ethereum) {
      throw new Error("MetaMask / Ethereum provider not found");
    }
  
    if (!state.provider) {
      throw new Error("No provider available");
    }
  
    const network = await state.provider.getNetwork();
    if (Number(network.chainId) === 8453) return;
  
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }]
      });
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x2105",
            chainName: "Base Mainnet",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18
            },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"]
          }]
        });
      } else {
        throw e;
      }
    }
  
    state.provider = new ethers.providers.Web3Provider(window.ethereum);
    state.signer = state.provider.getSigner();
  }
  
  /* =========================================================
     CONTRACT SETUP
     ========================================================= */
  
  export function setupContracts() {
    if (typeof ethers === "undefined") {
      throw new Error("ethers is not loaded");
    }
  
    if (!state.signer) {
      throw new Error("No signer available");
    }
  
    state.nftContract = new ethers.Contract(
      NFT_ADDRESS,
      NFT_ABI,
      state.signer
    );
  
    state.farmingV6Contract = new ethers.Contract(
      FARMING_V6_ADDRESS,
      FARMING_V6_ABI,
      state.signer
    );
  
    state.piratesV6Contract = new ethers.Contract(
      PIRATES_V6_ADDRESS,
      PIRATES_V6_ABI,
      state.signer
    );
  
    state.mercenaryV4Contract = new ethers.Contract(
      MERCENARY_V4_ADDRESS,
      MERCENARY_V4_ABI,
      state.signer
    );
  
    state.partnershipV2Contract = new ethers.Contract(
      PARTNERSHIP_V2_ADDRESS,
      PARTNERSHIP_V2_ABI,
      state.signer
    );
  
    state.inpiContract = new ethers.Contract(
      INPI_ADDRESS,
      INPI_ABI,
      state.signer
    );
  
    state.pitroneContract = new ethers.Contract(
      PITRONE_ADDRESS,
      PITRONE_ABI,
      state.signer
    );
  
    state.resourceTokenContract = new ethers.Contract(
      RESOURCE_TOKEN_ADDRESS,
      RESOURCE_TOKEN_ABI,
      state.signer
    );
  
    debugLog("Contracts initialized", {
      nft: NFT_ADDRESS,
      farmingV6: FARMING_V6_ADDRESS,
      piratesV6: PIRATES_V6_ADDRESS,
      mercenaryV4: MERCENARY_V4_ADDRESS,
      partnershipV2: PARTNERSHIP_V2_ADDRESS,
      inpi: INPI_ADDRESS,
      pitrone: PITRONE_ADDRESS,
      resourceToken: RESOURCE_TOKEN_ADDRESS
    });
  }
  
  /* =========================================================
     CLEANUP
     ========================================================= */
  
  export function clearContracts() {
    if (state.attacksTicker) clearInterval(state.attacksTicker);
    if (state.attacksPoller) clearInterval(state.attacksPoller);
    if (state.attackDropdownTimer) clearTimeout(state.attackDropdownTimer);
  
    state.attacksTicker = null;
    state.attacksPoller = null;
    state.attackDropdownTimer = null;
    state.attackDropdownRequestId = 0;
  
    state.provider = null;
    state.signer = null;
    state.userAddress = null;
    state.isConnecting = false;
  
    state.nftContract = null;
    state.farmingV6Contract = null;
    state.piratesV6Contract = null;
    state.mercenaryV4Contract = null;
    state.partnershipV2Contract = null;
    state.inpiContract = null;
    state.pitroneContract = null;
    state.resourceTokenContract = null;
  
    setSelectedBlockState(null);
    setSelectedAttackAttackerTokenId(null);
  
    state.userBlocks = [];
    state.userAttacks = [];
    state.userResources = [];
  
    state.cachedFarmsV6 = [];
    state.cachedProtectionsV4 = [];
    state.cachedMercenarySlotsV4 = [];
    state.cachedDefenderProfilesV4 = [];
  
    state.cachedFarmV6Map = new Map();
    state.cachedProtectionMapV4 = new Map();
    state.cachedMercenarySlotMapV4 = new Map();
    state.cachedDefenderProfileMapV4 = new Map();
  
    state.mercenaryPanelLoaded = false;
    state.selectedMercenarySlotIndex = 0;
    state.selectedMercenaryDurationDays = 7;
    state.selectedMercenaryPayInINPI = false;
  
    setMercenaryProfile(null);
    setMercenarySlots([]);
  
    resetSelectedBlockUiState();
    resetUiBusyFlags();
  
    debugLog("Contracts cleared");
  }
  
  /* =========================================================
     WALLET CONNECT
     ========================================================= */
  
  export async function connectWalletCore(forceRequest = true) {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask");
    }
  
    if (typeof ethers === "undefined") {
      throw new Error("ethers is not loaded");
    }
  
    state.provider = new ethers.providers.Web3Provider(window.ethereum);
  
    let accounts = [];
    if (forceRequest) {
      accounts = await state.provider.send("eth_requestAccounts", []);
    } else {
      accounts = await state.provider.listAccounts();
      if (!accounts.length) return false;
    }
  
    state.signer = state.provider.getSigner();
  
    await ensureBaseNetwork();
  
    state.userAddress = accounts?.[0] || await state.signer.getAddress();
    setupContracts();
  
    debugLog("Wallet connected", {
      userAddress: state.userAddress,
      requested: !!forceRequest
    });
  
    return true;
  }