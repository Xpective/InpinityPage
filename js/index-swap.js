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

  // GeckoTerminal / v4 PoolId (not a normal contract address)
  poolId: "0x2da60979434c607e283ad7956bdcd21b83fa756fa156ef45f996e2b34d2e12a8",

  // Official Uniswap v4 Base deployments
  poolManagerAddress: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  quoterAddress: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  universalRouterAddress: "0x6ff5693b99212da76ad316178a184ab56d299b43",

  rpcUrl: "https://mainnet.base.org",

  ethDecimals: 18,
  inpiDecimals: 18,

  minEth: 0.0005,
  maxEth: 0.002,
  slippageBps: 500, // 5%

  // Your confirmed PoolKey from PositionManager getPoolAndPositionInfo(tokenId)
  poolKey: {
    currency0: "0x0000000000000000000000000000000000000000", // native Base ETH
    currency1: "0x232FB12582ac10d5fAd97e9ECa22670e8Ba67d0D", // INPI
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

function setStatus(message, isHtml = false) {
  if (!els.status) return;
  if (isHtml) {
    els.status.innerHTML = message;
  } else {
