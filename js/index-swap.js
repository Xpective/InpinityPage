import { ethers } from "ethers";

/* =========================================================
   INPINITY HOME SWAP – BASE ETH -> INPI
   ethers v6 + live v4 quote + live v4 buy
   ========================================================= */

const CONFIG = {
  chainId: 8453,
  chainHex: "0x2105",
  chainName: "Base Mainnet",

  zeroAddress: "0x0000000000000000000000000000000000000000",
  inpiAddress: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D",

  poolId: "0x2da60979434c607e283ad7956bdcd21b83fa756fa156ef45f996e2b34d2e12a8",

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

/* =========================================================
   UNISWAP V4 CONSTANTS
   ========================================================= */

const COMMAND_V4_SWAP = "0x10";

const ACTION_SWAP_EXACT_IN_SINGLE = "06";
const ACTION_SETTLE_ALL = "0c";
const ACTION_TAKE_ALL = "0f";

/* =========================================================
   ABIS
   ========================================================= */

const QUOTER_ABI = [
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)"
];

const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
  "function execute(bytes commands, bytes[] inputs) payable"
];

/* =========================================================
   ELEMENTS
   ========================================================= */

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

let connectedAccount = null;
let latestQuote = null;

/* =========================================================
   HELPERS
   ========================================================= */

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
    const num = Number(ethers.formatUnits(value, decimals));
    if (!Number.isFinite(num)) return "-";
    return num.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
  } catch {
    return "-";
  }
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
  return ethers.parseUnits(raw, CONFIG.ethDecimals);
}

function computeMinOut(amountOut) {
  return (amountOut * BigInt(10000 - CONFIG.slippageBps)) / 10000n;
}

function isBaseChain(chainId) {
  return Number(chainId) === CONFIG.chainId;
}

function basescanTxUrl(hash) {
  return `https://basescan.org/tx/${hash}`;
}

/* =========================================================
   PROVIDERS / WALLET
   ========================================================= */

async function switchToBase() {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: CONFIG.chainHex }]
  });
}

function getReadProvider() {
  return new ethers.JsonRpcProvider(CONFIG.rpcUrl);
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please use MetaMask or another Base-compatible wallet.");
  }

  setWalletStatus("Connecting...");

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

  let provider = new ethers.BrowserProvider(window.ethereum);
  let network = await provider.getNetwork();

  if (!isBaseChain(network.chainId)) {
    await switchToBase();
    provider = new ethers.BrowserProvider(window.ethereum);
    network = await provider.getNetwork();
  }

  if (!isBaseChain(network.chainId)) {
    throw new Error("Please switch your wallet to Base Mainnet.");
  }

  connectedAccount = accounts?.[0] || null;
  setWalletStatus(
    connectedAccount ? `Connected: ${shortenAddress(connectedAccount)}` : "Not connected"
  );

  return provider;
}

async function ensureWalletOnBase() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please use MetaMask or another Base-compatible wallet.");
  }

  let provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_accounts", []);

  if (!accounts.length) {
    return connectWallet();
  }

  let network = await provider.getNetwork();

  if (!isBaseChain(network.chainId)) {
    await switchToBase();
    provider = new ethers.BrowserProvider(window.ethereum);
    network = await provider.getNetwork();
  }

  if (!isBaseChain(network.chainId)) {
    throw new Error("Wallet is still not connected to Base Mainnet.");
  }

  connectedAccount = accounts[0];
  setWalletStatus(`Connected: ${shortenAddress(connectedAccount)}`);
  return provider;
}

/* =========================================================
   UI ACTIONS
   ========================================================= */

function wireQuickButtons() {
  document.querySelectorAll(".buy-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (els.amount) {
        els.amount.value = btn.dataset.amount;
      }
      latestQuote = null;
      setQuoteDisplay("-", "-", "-");
      setStatus("");
    });
  });
}

async function fetchQuote() {
  const raw = getAmountRaw();
  validateAmount(raw);

  setStatus("Fetching live quote...");
  setQuoteDisplay("-", "-", "-");

  const provider = getReadProvider();
  const quoter = new ethers.Contract(CONFIG.quoterAddress, QUOTER_ABI, provider);

  const amountIn = parseEth(raw);

  const params = {
    poolKey: CONFIG.poolKey,
    zeroForOne: true,
    exactAmount: amountIn,
    hookData: "0x"
  };

  let result;
  try {
    result = await quoter.quoteExactInputSingle.staticCall(params);
  } catch (err) {
    console.error("QUOTE STATICCALL ERROR:", err);
    throw new Error("Live quote failed. The pool may be too small or the quoter call returned an error.");
  }

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

  setStatus("Live quote ready.");
  return latestQuote;
}

function encodeV4SwapInput({ amountIn, minOut }) {
  const coder = ethers.AbiCoder.defaultAbiCoder();

  const actions = `0x${ACTION_SWAP_EXACT_IN_SINGLE}${ACTION_SETTLE_ALL}${ACTION_TAKE_ALL}`;

  const swapParams = coder.encode(
    [
      "tuple(tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)"
    ],
    [
      {
        poolKey: CONFIG.poolKey,
        zeroForOne: true,
        amountIn,
        amountOutMinimum: minOut,
        hookData: "0x"
      }
    ]
  );

  const settleAllParams = coder.encode(
    ["address", "uint256"],
    [CONFIG.zeroAddress, amountIn]
  );

  const takeAllParams = coder.encode(
    ["address", "uint256"],
    [CONFIG.inpiAddress, minOut]
  );

  const params = [swapParams, settleAllParams, takeAllParams];

  return coder.encode(["bytes", "bytes[]"], [actions, params]);
}

async function executeBuy() {
  const raw = getAmountRaw();
  validateAmount(raw);

  const provider = await ensureWalletOnBase();
  const signer = await provider.getSigner();

  if (!latestQuote || latestQuote.rawInput !== raw) {
    await fetchQuote();
  }

  const amountIn = latestQuote.amountIn;
  const minOut = latestQuote.minOut;

  const universalRouter = new ethers.Contract(
    CONFIG.universalRouterAddress,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const commands = COMMAND_V4_SWAP;
  const input0 = encodeV4SwapInput({ amountIn, minOut });
  const inputs = [input0];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  setStatus("Please confirm the swap in your wallet...");

  let tx;
  try {
    tx = await universalRouter.execute(commands, inputs, deadline, {
      value: amountIn
    });
  } catch (err) {
    console.error("UNIVERSAL ROUTER EXECUTE ERROR:", err);
    throw new Error(err?.shortMessage || err?.reason || err?.message || "Swap transaction failed before submission.");
  }

  setStatus("Transaction sent. Waiting for confirmation...");

  const receipt = await tx.wait();

  setStatus(
    `Swap completed. <a href="${basescanTxUrl(receipt.hash)}" target="_blank" rel="noopener">View on BaseScan</a>`,
    true
  );
}

/* =========================================================
   EVENTS
   ========================================================= */

function bindWalletEvents() {
  if (!window.ethereum) return;

  window.ethereum.on?.("accountsChanged", (accounts) => {
    connectedAccount = accounts?.[0] || null;
    setWalletStatus(
      connectedAccount ? `Connected: ${shortenAddress(connectedAccount)}` : "Not connected"
    );
    latestQuote = null;
    setQuoteDisplay("-", "-", "-");
    setStatus("");
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
      setStatus(err?.message || "Wallet connection failed.");
    }
  });

  els.quoteBtn?.addEventListener("click", async () => {
    try {
      await fetchQuote();
    } catch (err) {
      console.error("QUOTE ERROR:", err);
      latestQuote = null;
      setQuoteDisplay("-", "-", "-");
      setStatus(err?.message || "Quote failed.");
    }
  });

  els.buyBtn?.addEventListener("click", async () => {
    try {
      await executeBuy();
    } catch (err) {
      console.error("SWAP ERROR:", err);
      setStatus(err?.message || "Swap failed.");
    }
  });

  els.amount?.addEventListener("input", () => {
    latestQuote = null;
    setQuoteDisplay("-", "-", "-");
    setStatus("");
  });
}

/* =========================================================
   INIT
   ========================================================= */

async function init() {
  setWalletStatus("Not connected");
  setQuoteDisplay("-", "-", "-");

  if (window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
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