import { ethers } from "ethers";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";

/* =========================================================
   INPINITY HOME SWAP – BASE ETH -> INPI (Uniswap v4)
   ========================================================= */

const CONFIG = {
  chainId: 8453,
  chainName: "Base Mainnet",

  inpiAddress: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D",
  zeroAddress: "0x0000000000000000000000000000000000000000",

  // Official Base v4 contracts discussed earlier
  quoterAddress: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  universalRouterAddress: "0x6ff5693b99212da76ad316178a184ab56d299b43",

  // Limits
  minEth: 0.0005,
  maxEth: 0.002,
  ethDecimals: 18,
  inpiDecimals: 18,
  slippageBps: 500, // 5%

  // PoolKey
  poolKey: {
    currency0: "0x0000000000000000000000000000000000000000", // native ETH
    currency1: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D", // INPI
    fee: 10000,
    tickSpacing: 200,
    hooks: "0x0000000000000000000000000000000000000000"
  },

  rpcUrl: "https://mainnet.base.org"
};

const QUOTER_ABI = [
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)"
];

const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"
];

const els = {
  amount: document.getElementById("miniBuyAmount"),
  quoteBtn: document.getElementById("quoteBuyBtn"),
  buyBtn: document.getElementById("miniBuyBtn"),
  status: document.getElementById("miniBuyStatus"),
  quoteOut: document.getElementById("quoteOut"),
  quoteMinOut: document.getElementById("quoteMinOut"),
  quoteGas: document.getElementById("quoteGas")
};

let latestQuote = null;

/* =========================================================
   HELPERS
   ========================================================= */

function setStatus(message) {
  if (els.status) els.status.textContent = message;
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

function parseAmountInput(raw) {
  const num = Number(raw);
  if (!raw || Number.isNaN(num)) {
    throw new Error("Please enter a valid ETH amount.");
  }
  if (num < CONFIG.minEth || num > CONFIG.maxEth) {
    throw new Error(`Allowed range: ${CONFIG.minEth} ETH to ${CONFIG.maxEth} ETH.`);
  }
  return num;
}

function toWei(rawEth) {
  return ethers.utils.parseUnits(rawEth, CONFIG.ethDecimals);
}

function computeMinOut(amountOut) {
  return amountOut.mul(10000 - CONFIG.slippageBps).div(10000);
}

function isBaseChain(chainId) {
  return Number(chainId) === CONFIG.chainId;
}

async function ensureWalletOnBase() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please use MetaMask or another Base-compatible wallet.");
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });

  let provider = new ethers.providers.Web3Provider(window.ethereum);
  let network = await provider.getNetwork();

  if (!isBaseChain(network.chainId)) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }]
      });
    } catch {
      throw new Error("Please switch your wallet to Base Mainnet.");
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    network = await provider.getNetwork();

    if (!isBaseChain(network.chainId)) {
      throw new Error("Wallet is still not connected to Base Mainnet.");
    }
  }

  return provider;
}

function getReadProvider() {
  return new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
}

function wireQuickButtons() {
  document.querySelectorAll(".buy-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (els.amount) els.amount.value = btn.dataset.amount;
    });
  });
}

/* =========================================================
   QUOTE
   ========================================================= */

async function fetchQuote() {
  const raw = getAmountRaw();
  parseAmountInput(raw);

  setStatus("Fetching quote...");
  setQuoteDisplay("-", "-", "-");

  const provider = getReadProvider();
  const quoter = new ethers.Contract(CONFIG.quoterAddress, QUOTER_ABI, provider);

  const amountIn = toWei(raw);

  const params = {
    poolKey: CONFIG.poolKey,
    zeroForOne: true, // ETH (currency0) -> INPI (currency1)
    exactAmount: amountIn.toString(),
    hookData: "0x"
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

/* =========================================================
   SWAP
   ========================================================= */

async function executeBuy() {
  const raw = getAmountRaw();
  parseAmountInput(raw);

  if (!latestQuote || latestQuote.rawInput !== raw) {
    await fetchQuote();
  }

  const provider = await ensureWalletOnBase();
  const signer = provider.getSigner();

  const router = new ethers.Contract(
    CONFIG.universalRouterAddress,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const amountIn = toWei(raw);
  const minOut = latestQuote.minOut;

  const swapParams = {
    poolKey: CONFIG.poolKey,
    zeroForOne: true,
    amountIn: amountIn.toString(),
    amountOutMinimum: minOut.toString(),
    hookData: "0x"
  };

  const v4Planner = new V4Planner();
  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapParams]);
  v4Planner.addAction(Actions.SETTLE_ALL, [CONFIG.zeroAddress, amountIn.toString()]);
  v4Planner.addAction(Actions.TAKE_ALL, [CONFIG.inpiAddress, minOut.toString()]);

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  setStatus("Please confirm the swap in your wallet...");

  const tx = await router.execute(
    routePlanner.commands,
    routePlanner.inputs,
    deadline,
    {
      value: amountIn
    }
  );

  setStatus("Transaction sent. Waiting for confirmation...");

  const receipt = await tx.wait();

  if (els.status) {
    els.status.innerHTML = `Swap completed. <a href="${formatTxLink(receipt.transactionHash)}" target="_blank" rel="noopener">View on BaseScan</a>`;
  }
}

/* =========================================================
   EVENTS
   ========================================================= */

function wireEvents() {
  wireQuickButtons();

  els.quoteBtn?.addEventListener("click", async () => {
    try {
      await fetchQuote();
    } catch (err) {
      console.error(err);
      latestQuote = null;
      setQuoteDisplay("-", "-", "-");
      setStatus(err?.message || "Quote failed.");
    }
  });

  els.buyBtn?.addEventListener("click", async () => {
    try {
      await executeBuy();
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Swap failed.");
    }
  });

  els.amount?.addEventListener("input", () => {
    latestQuote = null;
    setQuoteDisplay("-", "-", "-");
    setStatus("");
  });
}

wireEvents();
