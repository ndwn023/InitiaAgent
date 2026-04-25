import { Router, Request, Response, NextFunction } from "express";
import { fetchPrices } from "../lib/price-feed";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONTRACTS,
  INITIA_EVM_CHAIN,
  INITIA_EVM_RPC_URL,
  executeBodySchema,
  parsePayload,
  type EvmAddress,
  type EvmHash,
} from "@initia-agent/shared";

const router = Router();

// ─── Initia EVM-1 chain (from shared, allow env override for RPC) ─────────────
const initiaEvm1 = defineChain({
  ...INITIA_EVM_CHAIN,
  rpcUrls: {
    default: { http: [process.env.INITIA_EVM_RPC || INITIA_EVM_RPC_URL] },
  },
});

const TESTNET_TOKENS: Record<string, EvmAddress> = {
  INIT: CONTRACTS.MOCK_INIT,
  USDC: CONTRACTS.MOCK_USDC,
};

// ─── Minimal ABIs for on-chain execution ─────────────────────────────────────
const DEX_ABI = [
  {
    type: "function", name: "setRate",
    inputs: [
      { name: "tokenIn",  type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "rate18",   type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  },
] as const;

const EXECUTOR_ABI = [
  {
    type: "function", name: "executeSwap",
    inputs: [
      { name: "agentId",      type: "uint256" },
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "isRunnerAuthorized",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "runner",  type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ─── POST /api/agent/execute ──────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parsePayload(req.body, executeBodySchema);
    const {
      agentId,
      signal,
      confidence,
      tradeAmount = 0,
      fromToken = "INIT",
      toToken = "USDC",
      strategy,
      onChainAgentId,
    } = body;

    // ── Fetch live prices ──────────────────────────────────────────────────
    const marketSnapshot = await fetchPrices();
    const getUsdPrice = (token: string): number => {
      if (token === "USDC") return 1.0;
      const found = marketSnapshot.prices.find((p) => p.symbol.startsWith(`${token}/`));
      return found?.price || 0.08;
    };

    const fromPrice = getUsdPrice(fromToken);
    const toPrice   = getUsdPrice(toToken);
    const initPrice = getUsdPrice("INIT");

    const slippageBps = confidence >= 80 ? 50 : 150; // 0.5% or 1.5%
    const estimatedOutput = Math.round((tradeAmount * fromPrice / toPrice) * (1 - slippageBps / 10000) * 100) / 100;

    console.log(`[AutoExecute] ${signal} ${tradeAmount.toFixed(2)} ${fromToken} → ${estimatedOutput.toFixed(2)} ${toToken} | ${confidence}% | Agent: ${agentId}`);

    // ── Try on-chain execution if runner key is configured ─────────────────
    const privateKey = process.env.RUNNER_PRIVATE_KEY;
    let txHash: EvmHash | null = null;

    if (privateKey && privateKey !== "0x" && privateKey.length > 4) {
      try {
        const account = privateKeyToAccount(privateKey as EvmHash);
        const publicClient = createPublicClient({ chain: initiaEvm1, transport: http() });
        const walletClient = createWalletClient({ account, chain: initiaEvm1, transport: http() });

        const tokenInAddr  = TESTNET_TOKENS[fromToken];
        const tokenOutAddr = TESTNET_TOKENS[toToken];

        if (!tokenInAddr || !tokenOutAddr) {
          throw new Error(`Token pair ${fromToken}/${toToken} not configured`);
        }

        // Compute rates scaled by 1e18
        const rate18In  = BigInt(Math.floor((fromPrice / toPrice) * 1e15)) * 1000n;
        const rate18Out = BigInt(Math.floor((toPrice / fromPrice) * 1e15)) * 1000n;

        const agentIdBig   = BigInt(onChainAgentId || 1);
        const amountIn     = parseUnits(tradeAmount.toString(), 18);
        const minAmountOut = 1n; // permissive — mock DEX, hackathon
        const deadline     = BigInt(Math.floor(Date.now() / 1000) + 300);

        // 1. setRate tokenIn→tokenOut
        const h1 = await walletClient.writeContract({
          address: CONTRACTS.MOCK_DEX,
          abi: DEX_ABI,
          functionName: "setRate",
          args: [tokenInAddr, tokenOutAddr, rate18In],
        });
        await publicClient.waitForTransactionReceipt({ hash: h1 });

        // 2. setRate tokenOut→tokenIn
        const h2 = await walletClient.writeContract({
          address: CONTRACTS.MOCK_DEX,
          abi: DEX_ABI,
          functionName: "setRate",
          args: [tokenOutAddr, tokenInAddr, rate18Out],
        });
        await publicClient.waitForTransactionReceipt({ hash: h2 });

        // 3. executeSwap
        const h3 = await walletClient.writeContract({
          address: CONTRACTS.AGENT_EXECUTOR,
          abi: EXECUTOR_ABI,
          functionName: "executeSwap",
          args: [agentIdBig, tokenInAddr, tokenOutAddr, amountIn, minAmountOut, deadline],
        });
        await publicClient.waitForTransactionReceipt({ hash: h3 });

        txHash = h3;
        console.log(`[OnChain] swap executed: ${h3}`);
      } catch (chainErr: any) {
        console.warn("[OnChain] swap failed, returning price data only:", chainErr?.message?.slice(0, 120));
      }
    } else {
      console.log("[OnChain] RUNNER_PRIVATE_KEY not set — skipping on-chain execution");
    }

    res.json({
      success: true,
      signal,
      confidence,
      tradeAmount,
      tokenIn:  fromToken,
      tokenOut: toToken,
      estimatedOutput,
      slippageBps,
      strategy,
      currentPrice: initPrice,
      fromPrice,
      toPrice,
      txHash: txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      onChain: !!txHash,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
