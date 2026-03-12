import { ethers } from "ethers";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";

/* =========================================================
   INPINITY HOME SWAP – BASE ETH -> INPI (Uniswap v4)
   ========================================================= */

const CONFIG = {
  chainId: 8453,
  chainHex: "0x2105",
  chainName: "Base Mainnet",

  zeroAddress: "0x0000000000000000000000000000000000000000",
  inpiAddress: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D",

  // GeckoTerminal v4 PoolId
  poolId: "0x2da60979434c607e283ad7956bdcd21b83fa756fa156ef45f996e2b34d2e12a8",

  // Official Uniswap v4 Base contracts
  poolManagerAddress: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  quoterAddress: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  universalRouterAddress: "0x6ff5693b99212da76ad316178a184ab56d299b43",

  rpcUrl: "https://mainnet.base.org",

  ethDecimals: 18,
  inpiDecimals: 18,

  minEth: 0.0005,
  maxEth: 0.002,
  slippageBps: 500,

  poolKey: {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D",
    fee: 10000,
    tickSpacing: 200,
    hooks: "0x0000000000000000000000000000000000000000"
  }
};

const QUOTER_ABI = [
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)"
];

const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"
];

const els = {
  amount: document.getElementById("miniBuyAmount"),
  connectBtn: document.getElementById("connectWalletBtn"),
  walletStatus: document.getElementById("walletStatus"),
  quoteBtn: document.getElementById("quoteBuyBtn"),
  buyBtn: document.getElementById("miniBuyBtn"),
  status: document.getElementById("miniBuyStatus"),
  quoteOut: document.getElementById("quoteOut"),
  quoteMinOut: document.getElementById("quoteMinOut"),
  quoteGas: document.getElementById("quoteGas")
};

let latestQuote = null;
let connectedAccount = null;

function shortenAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function setStatus(message, isHtml = false) {
  if (!els.status) return;
  if (isHtml) {
    els.status.innerHTML = message;
  } else {
    els.status.textContent = message;
  }
}

function setWalletStatus(message) {
  if (els.walletStatus) els.walletStatus.textContent = message;
}

function setQuoteDisplay(out = "-", minOut = "-", gas = "-") {
  if (els.quoteOut) els.quoteOut.textContent = out;
  if (els.quoteMinOut) els.quoteMinOut.textContent = minOut;
  if (els.quoteGas) els.quoteGas.textContent = gas;
}

function formatUnitsSafe(value, decimals, maxFractionDigits = 6) {
  try {
    const num = Number(ethers.utils.formatUnits(value, decimals));
    if (!Number.isFinite(num)) return "-";
    return num.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
  } catch {
    return "-";
  }
}

function formatTxLink(hash) {
  return `https://basescan.org/tx/${hash}`;
}

function getAmountRaw() {
  return String(els.amount?.value || "").trim();
}

function validateAmount(raw) {
  const num = Number(raw);

  if (!raw || Number.isNaN(num)) {
    throw new Error("Please enter a valid ETH amount.");
  }

  if (num < CONFIG.minEth || num > CONFIG.maxEth) {
    throw new Error(`Allowed range: ${CONFIG.minEth} ETH to ${CONFIG.maxEth} ETH.`);
  }

  return num;
}

function parseEth(raw) {
  return ethers.utils.parseUnits(raw, CONFIG.ethDecimals);
}

function computeMinOut(amountOut) {
  return amountOut.mul(10000 - CONFIG.slippageBps).div(10000);
}

function isBaseChain(chainId) {
  return Number(chainId) === CONFIG.chainId;
}

async function switchToBase() {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: CONFIG.chainHex }]
  });
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please use MetaMask or another Base-compatible wallet.");
  }

  setWalletStatus("Connecting...");

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  let network = await provider.getNetwork();

  if (!isBaseChain(network.chainId)) {
    await switchToBase();
    network = await provider.getNetwork();
  }

  if (!isBaseChain(network.chainId)) {
    throw new Error("Please switch your wallet to Base Mainnet.");
  }

  connectedAccount = accounts?.[0] || null;
  setWalletStatus(connectedAccount ? `Connected: ${shortenAddress(connectedAccount)}` : "Not connected");

  return provider;
}

async function ensureWalletOnBase() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please use MetaMask or another Base-compatible wallet.");
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const accounts = await provider.listAccounts();

  if (!accounts.length) {
    return connectWallet();
  }

  let network = await provider.getNetwork();
  if (!isBaseChain(network.chainId)) {
    await switchToBase();
    network = await provider.getNetwork();
  }

  if (!isBaseChain(network.chainId)) {
    throw new Error("Wallet is still not connected to Base Mainnet.");
  }

  connectedAccount = accounts[0];
  setWalletStatus(`Connected: ${shortenAddress(connectedAccount)}`);
  return provider;
}

function getReadProvider() {
  return new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
}

function wireQuickButtons() {
  document.querySelectorAll(".buy-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (els.amount) els.amount.value = btn.dataset.amount;
      latestQuote = null;
      setQuoteDisplay("-", "-", "-");
      setStatus("");
    });
  });
}

async function fetchQuote() {
  const raw = getAmountRaw();
  validateAmount(raw);

  setStatus("Fetching quote...");
  setQuoteDisplay("-", "-", "-");

  const provider = getReadProvider();
  const quoter = new ethers.Contract(CONFIG.quoterAddress, QUOTER_ABI, provider);

  const amountIn = parseEth(raw);

  const params = {
    poolKey: CONFIG.poolKey,
    zeroForOne: true,
    exactAmount: amountIn.toString(),
    hookData: "0x00"
  };

  const result = await quoter.callStatic.quoteExactInputSingle(params);
  const amountOut = result.amountOut ?? result[0];
  const gasEstimate = result.gasEstimate ?? result[1];
  const minOut = computeMinOut(amountOut);

  latestQuote = {
    rawInput: raw,
    amountIn,
    amountOut,
    minOut,
    gasEstimate
  };

  setQuoteDisplay(
    `${formatUnitsSafe(amountOut, CONFIG.inpiDecimals)} INPI`,
    `${formatUnitsSafe(minOut, CONFIG.inpiDecimals)} INPI`,
    gasEstimate.toString()
  );

  setStatus("Quote ready.");
  return latestQuote;
}

async function executeBuy() {
  const raw = getAmountRaw();
  validateAmount(raw);

  if (!latestQuote || latestQuote.rawInput !== raw) {
    await fetchQuote();
  }

  const provider = await ensureWalletOnBase();
  const signer = provider.getSigner();

  const universalRouter = new ethers.Contract(
    CONFIG.universalRouterAddress,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const amountIn = parseEth(raw);
  const minOut = latestQuote.minOut;

  const currentConfig = {
    poolKey: CONFIG.poolKey,
    zeroForOne: true,
    amountIn: amountIn.toString(),
    amountOutMinimum: minOut.toString(),
    hookData: "0x00"
  };

  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();

  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [currentConfig]);
  v4Planner.addAction(Actions.SETTLE_ALL, [currentConfig.poolKey.currency0, currentConfig.amountIn]);
  v4Planner.addAction(Actions.TAKE_ALL, [currentConfig.poolKey.currency1, currentConfig.amountOutMinimum]);

  const encodedActions = v4Planner.finalize();
  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  setStatus("Please confirm the swap in your wallet...");

  const tx = await universalRouter.execute(
    routePlanner.commands,
    [encodedActions],
    deadline,
    {
      value: amountIn
    }
  );

  setStatus("Transaction sent. Waiting for confirmation...");

  const receipt = await tx.wait();

  setStatus(
    `Swap completed. <a href="${formatTxLink(receipt.transactionHash)}" target="_blank" rel="noopener">View on BaseScan</a>`,
    true
  );
}

function bindWalletEvents() {
  if (!window.ethereum) return;

  window.ethereum.on?.("accountsChanged", (accounts) => {
    connectedAccount = accounts?.[0] || null;
    setWalletStatus(connectedAccount ? `Connected: ${shortenAddress(connectedAccount)}` : "Not connected");
    latestQuote = null;
  });

  window.ethereum.on?.("chainChanged", () => {
    latestQuote = null;
    setQuoteDisplay("-", "-", "-");
    setStatus("");
    window.location.reload();
  });
}

function wireEvents() {
  wireQuickButtons();
  bindWalletEvents();

  els.connectBtn?.addEventListener("click", async () => {
    try {
      await connectWallet();
      setStatus("Wallet connected.");
    } catch (err) {
      console.error("CONNECT ERROR:", err);
      setWalletStatus("Not connected");
      setStatus(err?.reason || err?.data?.message || err?.message || "Wallet connection failed.");
    }
  });

  els.quoteBtn?.addEventListener("click", async () => {
    try {
      await fetchQuote();
    } catch (err) {
      console.error("QUOTE ERROR:", err);
      latestQuote = null;
      setQuoteDisplay("-", "-", "-");
      setStatus(err?.reason || err?.data?.message || err?.message || "Quote failed.");
    }
  });

  els.buyBtn?.addEventListener("click", async () => {
    try {
      await executeBuy();
    } catch (err) {
      console.error("SWAP ERROR:", err);
      const reason =
        err?.reason ||
        err?.data?.message ||
        err?.error?.message ||
        err?.message ||
        "Swap failed.";
      setStatus(reason);
    }
  });

  els.amount?.addEventListener("input", () => {
    latestQuote = null;
    setQuoteDisplay("-", "-", "-");
    setStatus("");
  });
}

async function init() {
  setWalletStatus("Not connected");

  if (window.ethereum) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      const network = await provider.getNetwork();

      if (accounts.length && isBaseChain(network.chainId)) {
        connectedAccount = accounts[0];
        setWalletStatus(`Connected: ${shortenAddress(connectedAccount)}`);
      }
    } catch (err) {
      console.error("INIT WALLET CHECK ERROR:", err);
    }
  }

  wireEvents();
}

init();
