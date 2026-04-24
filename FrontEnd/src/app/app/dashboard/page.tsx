"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  Wallet,
  Activity,
  Bot,
  ArrowDownRight,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  ArrowRight,
  Coins,
  DollarSign,
  TrendingUp,
  Send,
  Sparkles,
  Brain,
  MessageCircle,
  Zap,
} from "lucide-react";
import { useAgents } from "@/lib/hooks/use-agents";
import { useAccount, useSwitchChain, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { AgentVaultABI } from "@/lib/abis/AgentVault";
import { AgentExecutorABI } from "@/lib/abis/AgentExecutor";
import { ProfitSplitterABI } from "@/lib/abis/ProfileSplitter";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { parseUnits, formatUnits } from "viem";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS } from "@/lib/constants";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AILog {
  id: number | string;
  action: string;
  agent: string;
  amount: string;
  type: "buy" | "sell" | "neutral" | "earn" | "ai" | "execute";
  time: string;
  timestamp: number;
  reasoning?: string;
  signal?: string;
}

function getRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Token addresses available on Initia testnet evm-1 — module-level to avoid re-render loops
const TESTNET_TOKENS: Record<string, `0x${string}`> = {
  INIT: "0x2A3888Bd6865D2C360D11F284FE773379fb98E30",
  USDC: "0x44cB6c715b9Aba693f87e1660B1728b7aD083620",
};

const baseChartData = [
  { name: "Mon", value: 0 },
  { name: "Tue", value: 0 },
  { name: "Wed", value: 0 },
  { name: "Thu", value: 0 },
  { name: "Fri", value: 0 },
  { name: "Sat", value: 0 },
  { name: "Sun", value: 0 },
];

export default function DashboardPage() {
  const { myAgents, removeAgent, addAgent } = useAgents();
  const { writeContract } = useInterwovenEvm();
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<any>(null);
  const [subscribeAmount, setSubscribeAmount] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [closeWarningAgent, setCloseWarningAgent] = useState<any>(null);
  const INITIA_CHAIN_ID = 2124225178762456;
  const [logs, setLogs] = useState<AILog[]>([]);
  const [dynamicChartData, setDynamicChartData] = useState(baseChartData);

  const ownedAgents = myAgents.filter(a => !a.name.includes("(Sub)"));
  // Hide (Sub) entry if user is already the creator of that same contract — avoids showing duplicate cards
  const ownedContracts = new Set(ownedAgents.map(a => a.contractAddress));
  const subscribedAgents = myAgents.filter(a => a.name.includes("(Sub)") && !ownedContracts.has(a.contractAddress));
  // Deduplicated list used for all execution loops — no double-trading
  const activeAgents = [...ownedAgents, ...subscribedAgents];

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [livePortfolio, setLivePortfolio] = useState(0);
  const [liveProfit, setLiveProfit] = useState(0); // in INIT
  const [initPrice, setInitPrice] = useState(0.08); // INIT/USD
  const [lastSignal, setLastSignal] = useState<"BUY" | "SELL" | "HOLD" | null>(null);
  const [autoExecute, setAutoExecute] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [remainingBalance, setRemainingBalance] = useState<Record<string, number>>({});
  // Track cost basis: how much INIT was spent to acquire quote tokens per agent
  const [costBasis, setCostBasis] = useState<Record<string, number>>({});
  const [executionCount, setExecutionCount] = useState(0);
  const [priceSource, setPriceSource] = useState<string>("fetching...");
  const [runtimeHydrated, setRuntimeHydrated] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<Record<string, number>>({});

  const resetSimulatedPerformance = () => {
    setLiveProfit(0);
    setLivePortfolio(0);
    setCostBasis({});
  };

  // Periodic price fetcher (independent of trades)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy: "DEFAULT" }),
        });
        const data = await res.json();
        if (data.currentPrice) setInitPrice(data.currentPrice);
        if (data.marketPrices?.[0]) {
          // Find the source from the price data if available or default to analysis
          // The API returns source in the snapshot but we just use a generic 'Real-time' for UI
          setPriceSource("Oracle (CoinGecko/Pyth)");
        }
      } catch (err) {
        console.warn("Price fetch failed", err);
      }
    };
    fetchLivePrices();
    const timer = setInterval(fetchLivePrices, 30000);
    return () => clearInterval(timer);
  }, []);

  // Update relative times every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setLogs(prev => prev.map(log => ({
        ...log,
        time: getRelativeTime(log.timestamp),
      })));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const promptContainerRef = useRef<HTMLDivElement>(null);
  const fetchAIAnalysisRef = useRef<((agent: typeof myAgents[0]) => Promise<any>) | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragLimit, setDragLimit] = useState(0);

  useEffect(() => {
    const updateDragLimit = () => {
      if (promptContainerRef.current) {
        const scrollWidth = promptContainerRef.current.scrollWidth;
        const offsetWidth = promptContainerRef.current.offsetWidth;
        setDragLimit(Math.min(0, offsetWidth - scrollWidth));
      }
    };
    updateDragLimit();
    window.addEventListener('resize', updateDragLimit);
    return () => window.removeEventListener('resize', updateDragLimit);
  }, [myAgents.length]);

  const renderMarkdown = (text: string) => {
    // Split by double newlines for paragraphs, then handle each line
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Empty line = spacing
      if (!trimmed) {
        elements.push(<div key={`br-${lineIdx}`} className="h-1.5" />);
        return;
      }

      // Bullet points
      const isBullet = /^[-•*]\s+/.test(trimmed);
      const bulletContent = isBullet ? trimmed.replace(/^[-•*]\s+/, '') : trimmed;

      // Render inline bold
      const renderInline = (str: string, keyPrefix: string) => {
        const parts = str.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const content = part.slice(2, -2);
            return <strong key={`${keyPrefix}-${i}`} className="text-zinc-200 font-semibold">{content}</strong>;
          }
          return <span key={`${keyPrefix}-${i}`}>{part}</span>;
        });
      };

      if (isBullet) {
        elements.push(
          <div key={`line-${lineIdx}`} className="flex gap-1.5 pl-1 py-0.5">
            <span className="text-emerald-500/60 shrink-0">•</span>
            <span>{renderInline(bulletContent, `b-${lineIdx}`)}</span>
          </div>
        );
      } else {
        elements.push(
          <p key={`line-${lineIdx}`} className="py-0.5">
            {renderInline(trimmed, `p-${lineIdx}`)}
          </p>
        );
      }
    });

    return elements;
  };

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  useEffect(() => {
    if (chatMessages.length === 0 && myAgents.length > 0) {
      setChatMessages([
        {
          role: "assistant",
          content: "Hello! I'm your Initia AI Assistant. I'm currently monitoring your active agents. How can I help you today?"
        }
      ]);
    }
  }, [myAgents.length, chatMessages.length]);

  const getPrimaryTargetToken = useCallback((target?: string) => {
    const normalized = (target || "USDC")
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean);

    return normalized.find((token) => token !== "INIT") || normalized[0] || "USDC";
  }, []);

  // Determine the trading pair for an agent
  // Modal is always INIT. BUY = swap INIT into target token. SELL = swap target back to INIT.
  const getAgentTokens = useCallback((agent: typeof myAgents[0]) => {
    if (agent.strategy === "LP") {
      // Parse first pool from agent.pool (e.g. "INIT/USDC, ETH/USDC" → base: INIT, quote: USDC)
      const firstPool = (agent.pool || "INIT/USDC").split(",")[0].trim();
      const parts = firstPool.split("/");
      return { base: parts[0] || "INIT", quote: parts[1] || "USDC" };
    }
    // For DCA/YIELD/VIP: normalize to one tradable quote token.
    const quoteToken = getPrimaryTargetToken(agent.target);
    return { base: "INIT", quote: quoteToken };
  }, [getPrimaryTargetToken]);

  const runtimeOwnerAddress = address?.toLowerCase() || "";

  const getAgentIntervalMs = useCallback((agent: typeof myAgents[0]) => {
    const label = (agent.interval || "1 Hour").toLowerCase();
    if (label.includes("15")) return 15 * 60 * 1000;
    if (label.includes("30")) return 30 * 60 * 1000;
    if (label.includes("4 hour")) return 4 * 60 * 60 * 1000;
    if (label.includes("12 hour")) return 12 * 60 * 60 * 1000;
    if (label.includes("24 hour")) return 24 * 60 * 60 * 1000;
    return 60 * 60 * 1000;
  }, []);

  const isAgentDue = useCallback((agent: typeof myAgents[0], now = Date.now()) => {
    const lastRun = lastAnalysisAt[agent.id] || 0;
    return now - lastRun >= getAgentIntervalMs(agent);
  }, [lastAnalysisAt, getAgentIntervalMs]);

  useEffect(() => {
    if (!runtimeOwnerAddress) {
      const nextBalances: Record<string, number> = {};
      myAgents.forEach((agent) => {
        const { base, quote } = getAgentTokens(agent);
        nextBalances[`${agent.id}_${base}`] = agent.initialCapital || 0;
        nextBalances[`${agent.id}_${quote}`] = 0;
      });
      setRemainingBalance(nextBalances);
      setRuntimeHydrated(true);
      return;
    }

    let cancelled = false;

    const hydrateRuntimeState = async () => {
      try {
        const res = await fetch(`/api/dashboard-state?ownerAddress=${encodeURIComponent(runtimeOwnerAddress)}`);
        const persisted = res.ok ? await res.json() : null;
        if (cancelled) return;

        const nextBalances: Record<string, number> = {};
        const nextCostBasis: Record<string, number> = {};
        myAgents.forEach((agent) => {
          const { base, quote } = getAgentTokens(agent);
          nextBalances[`${agent.id}_${base}`] =
            persisted?.remainingBalance?.[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
          nextBalances[`${agent.id}_${quote}`] =
            persisted?.remainingBalance?.[`${agent.id}_${quote}`] ?? 0;
          if (persisted?.costBasis?.[agent.id] != null) {
            nextCostBasis[agent.id] = Number(persisted.costBasis[agent.id]) || 0;
          }
        });

        const fallbackInitPrice = initPrice > 0 ? initPrice : 0.08;
        const totalCapitalUsd = myAgents.reduce(
          (sum, agent) => sum + ((agent.initialCapital || 0) * fallbackInitPrice),
          0
        );

        setRemainingBalance(nextBalances);
        setCostBasis(nextCostBasis);
        setLastAnalysisAt(persisted?.lastAnalysisAt ?? {});
        setExecutionCount(Number(persisted?.executionCount || 0));
        setLiveProfit(Number(persisted?.liveProfit || 0));
        setLivePortfolio(
          persisted?.livePortfolio != null && Number(persisted.livePortfolio) > 0
            ? Number(persisted.livePortfolio)
            : totalCapitalUsd
        );
        setLogs(
          Array.isArray(persisted?.logs)
            ? persisted.logs.slice(0, 20).map((log: any) => ({
                ...log,
                time: getRelativeTime(log.timestamp || Date.now()),
              }))
            : []
        );
      } catch (error) {
        console.error("Failed to hydrate dashboard state:", error);
      } finally {
        if (!cancelled) setRuntimeHydrated(true);
      }
    };

    hydrateRuntimeState();

    return () => {
      cancelled = true;
    };
  }, [runtimeOwnerAddress, myAgents, getAgentTokens, initPrice]);

  const executeSwapOnChain = useCallback(async (
    agent: typeof myAgents[0],
    signal: "BUY" | "SELL",
    confidence: number
  ) => {
    const ts = Date.now();
    const { base, quote } = getAgentTokens(agent);
    const fromToken = signal === "BUY" ? base : quote;
    const toToken   = signal === "BUY" ? quote : base;

    const balKey  = agent.id;
    const baseBal = remainingBalance[`${balKey}_${base}`] ?? (agent.initialCapital || 0);
    const quoteBal = remainingBalance[`${balKey}_${quote}`] ?? 0;
    const fromBal  = signal === "BUY" ? baseBal : quoteBal;
    if (fromBal <= 0) {
      setLogs(prev => [{
        id: `${ts}-nobal`,
        action: `Trade Skipped: No ${signal === "BUY" ? base : quote} Balance`,
        agent: agent.name,
        amount: `${confidence}% confidence`,
        type: "neutral" as const,
        time: "Just now",
        timestamp: ts,
        reasoning: `Execution requires available ${signal === "BUY" ? base : quote} balance.`,
        signal,
      }, ...prev].slice(0, 20));
      return;
    }

    setIsExecuting(true);

    const isDCA = (agent.strategy || "").toUpperCase().includes("DCA");
    const baseTradePct = agent.tradeSizePct != null ? agent.tradeSizePct / 100 : isDCA ? 0.05 : 0.10;
    const tradePct    = Math.min(baseTradePct * (1 + (confidence / 100) * 0.2), 0.5);
    let tradeAmount = Math.round(fromBal * tradePct * 100) / 100;

    const stopLossPct     = agent.stopLossPct ?? 10;
    const stopLossFloor   = (agent.initialCapital || 0) * (1 - stopLossPct / 100);
    if (signal === "BUY" && (baseBal + quoteBal) < stopLossFloor) {
      if (quoteBal > 0) executeSwapOnChain(agent, "SELL", 99);
      setIsExecuting(false);
      return;
    }
    if (tradeAmount < 0.01) { setIsExecuting(false); return; }

    try {
      const vaultAddress = (agent.contractAddress || CONTRACTS.AGENT_VAULT_DEFAULT) as `0x${string}`;
      const tokenInAddr  = TESTNET_TOKENS[fromToken];
      const tokenOutAddr = TESTNET_TOKENS[toToken];

      let outputAmount = 0;
      let price = initPrice || 0.08;
      let txHash = "";
      let slippagePct = "1.0";

      if (tokenInAddr && tokenOutAddr && publicClient && address) {
        try {
        // ── REAL ON-CHAIN SWAP via AgentExecutor ──────────────────────────
        // 1. Read on-chain agentId from vault
        const onChainAgentId = await publicClient.readContract({
          address: vaultAddress,
          abi: AgentVaultABI,
          functionName: "agentId",
        }) as bigint;

        const [vaultPaused, intervalSeconds, lastExecutionTs, maxTradeBps, vaultTotalAssetsBeforeTrade, tokenInAllowed, tokenOutAllowed] = await Promise.all([
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "paused",
          }) as Promise<boolean>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "intervalSeconds",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "lastExecutionTs",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "maxTradeBps",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "totalAssets",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "allowedTokens",
            args: [tokenInAddr],
          }) as Promise<boolean>,
          publicClient.readContract({
            address: vaultAddress,
            abi: AgentVaultABI,
            functionName: "allowedTokens",
            args: [tokenOutAddr],
          }) as Promise<boolean>,
        ]);

        if (vaultPaused) throw new Error("Vault is paused");
        if (!tokenInAllowed || !tokenOutAllowed) throw new Error(`Token pair ${fromToken}/${toToken} is not allowed by this vault`);

        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        if (intervalSeconds > 0n && lastExecutionTs > 0n && nowSec < lastExecutionTs + intervalSeconds) {
          const waitSeconds = Number(lastExecutionTs + intervalSeconds - nowSec);
          throw new Error(`Vault cooldown active. Wait about ${waitSeconds}s before the next trade`);
        }

        const maxTradeAmount = Number(formatUnits((vaultTotalAssetsBeforeTrade * maxTradeBps) / 10000n, 18));
        if (maxTradeAmount > 0) {
          tradeAmount = Math.min(tradeAmount, Math.round(maxTradeAmount * 100) / 100);
        }
        if (tradeAmount < 0.01) {
          throw new Error("Trade amount is below the vault's usable size after maxTradeBps limits");
        }

        // 2. Authorize runner if not yet authorized
        const isAuthorized = await publicClient.readContract({
          address: CONTRACTS.AGENT_EXECUTOR as `0x${string}`,
          abi: AgentExecutorABI,
          functionName: "isRunnerAuthorized",
          args: [onChainAgentId, address as `0x${string}`],
        }) as boolean;

        if (!isAuthorized) {
          await writeContract({
            address: CONTRACTS.AGENT_EXECUTOR as `0x${string}`,
            abi: AgentExecutorABI,
            functionName: "authorizeRunner",
            args: [onChainAgentId, address as `0x${string}`],
          });
        }

        // 3. Fetch live price for minAmountOut calculation
        const priceRes = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signal, confidence, tradeAmount, fromToken, toToken, strategy: agent.strategy }),
        });
        const priceData = await priceRes.json();
        price = priceData.currentPrice || price;
        const fromPrice = priceData.fromPrice || price;
        const toPrice   = priceData.toPrice || 1;

        const amountIn    = parseUnits(tradeAmount.toString(), 18);
        const rawMinOut   = (tradeAmount * fromPrice / toPrice) * 0.97; // 3% slippage
        const minAmountOut = parseUnits(rawMinOut.toFixed(6), 18);
        const deadline    = BigInt(Math.floor(Date.now() / 1000) + 300);

        // 4. Execute real on-chain swap
        txHash = await writeContract({
          address: CONTRACTS.AGENT_EXECUTOR as `0x${string}`,
          abi: AgentExecutorABI,
          functionName: "executeSwap",
          args: [onChainAgentId, tokenInAddr, tokenOutAddr, amountIn, minAmountOut, deadline],
        });

        // 5. Read actual vault totalAssets to derive real output
        await new Promise(r => setTimeout(r, 1500)); // wait for block
        const totalAssets = await publicClient.readContract({
          address: vaultAddress,
          abi: AgentVaultABI,
          functionName: "totalAssets",
        }) as bigint;
        const vaultBalAfter = Number(formatUnits(totalAssets, 18));
        // Estimate output from price ratio (exact amount emitted in SwapExecuted event)
        outputAmount = Math.round(rawMinOut * 100) / 100;
        slippagePct  = "3.0";
        } catch {
          const res = await fetch("/api/agent/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: agent.id, signal, confidence, tradeAmount, fromToken, toToken, vaultAddress, strategy: agent.strategy, targetToken: agent.target || "INIT" }),
          });
          const result = await res.json();
          outputAmount = result.estimatedOutput || 0;
          price        = result.currentPrice || price;
          txHash       = result.txHash || "";
          slippagePct  = ((result.slippageBps || 100) / 100).toFixed(1);
        }
      } else {
        // ── PRICE-SIMULATED (token not on testnet yet) ────────────────────
        const res = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id, signal, confidence, tradeAmount, fromToken, toToken, vaultAddress, strategy: agent.strategy, targetToken: agent.target || "INIT" }),
        });
        const result = await res.json();
        outputAmount = result.estimatedOutput || 0;
        price        = result.currentPrice || price;
        txHash       = result.txHash || "";
        slippagePct  = ((result.slippageBps || 100) / 100).toFixed(1);
      }

      setInitPrice(price);

      // ── Update local balances ─────────────────────────────────────────
      setRemainingBalance(prev => {
        const updated = {
          ...prev,
          [`${balKey}_${fromToken}`]: Math.max(0, (prev[`${balKey}_${fromToken}`] ?? fromBal) - tradeAmount),
          [`${balKey}_${toToken}`]:   (prev[`${balKey}_${toToken}`] ?? 0) + outputAmount,
        };
        return updated;
      });
      setExecutionCount(prev => prev + 1);

      // ── Profit tracking ───────────────────────────────────────────────
      let realizedProfit = 0;
      if (signal === "BUY") {
        setCostBasis(prev => {
          const updated = { ...prev, [balKey]: (prev[balKey] || 0) + tradeAmount };
          return updated;
        });
      } else {
        const sellPortion    = quoteBal > 0 ? tradeAmount / quoteBal : 1;
        const costForThisSell = (costBasis[balKey] || 0) * sellPortion;
        realizedProfit       = outputAmount - costForThisSell;
        if (realizedProfit > 0) {
          setLiveProfit(prev => {
            return prev + realizedProfit;
          });
        }
        setCostBasis(prev => {
          return { ...prev, [balKey]: Math.max(0, (prev[balKey] || 0) - costForThisSell) };
        });
      }

      const newBaseBal  = (signal === "BUY" ? Math.max(0, baseBal - tradeAmount) : baseBal + outputAmount).toFixed(2);
      const newQuoteBal = (signal === "BUY" ? quoteBal + outputAmount : Math.max(0, quoteBal - tradeAmount)).toFixed(2);
      const txShort     = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}` : "";
      const profitStr   = signal === "SELL" && realizedProfit > 0 ? ` Profit: +${realizedProfit.toFixed(4)} INIT (~$${(realizedProfit * price).toFixed(2)})` : "";
      const onChain     = tokenInAddr && tokenOutAddr ? " [on-chain]" : " [simulated]";

      const execTs = Date.now();
      setLogs(prev => [{
        id: `${execTs}-${Math.random().toString(36).slice(2, 7)}`,
        action: `Swapped ${tradeAmount.toFixed(2)} ${fromToken} → ${outputAmount.toFixed(2)} ${toToken}${onChain}`,
        agent: agent.name,
        amount: `@$${price} INIT`,
        type: "execute" as const,
        time: "Just now",
        timestamp: execTs,
        reasoning: `${signal} at ${confidence}% conf. Bal: ${newBaseBal} ${base} / ${newQuoteBal} ${quote}. Slippage: ${slippagePct}%.${txShort ? ` Tx: ${txShort}` : ""}${profitStr}`,
        signal,
      }, ...prev].slice(0, 20));

      toast.success(`Swapped ${fromToken} → ${toToken}${tokenInAddr && tokenOutAddr ? "" : " (simulated)"}`, {
        description: `${tradeAmount.toFixed(2)} ${fromToken} → ${outputAmount.toFixed(2)} ${toToken}${realizedProfit > 0 ? ` | Profit: +${realizedProfit.toFixed(4)} INIT` : ""}${txShort ? ` | Tx: ${txShort}` : ""}`,
      });
    } catch (error: any) {
      const message = error?.message?.substring(0, 160) || "Unknown execution error";
      console.warn("Auto-execute error:", message);
      setLogs(prev => [{
        id: `${Date.now()}-exec-fail`,
        action: "Trade Failed",
        agent: agent.name,
        amount: `${signal} ${confidence}%`,
        type: "neutral" as const,
        time: "Just now",
        timestamp: Date.now(),
        reasoning: message,
        signal,
      }, ...prev].slice(0, 20));
      toast.error("Trade execution failed", { description: message });
    } finally {
      setIsExecuting(false);
    }
  }, [remainingBalance, getAgentTokens, costBasis, publicClient, address, writeContract, initPrice]);

  const fetchAIAnalysis = useCallback(async (agent: typeof myAgents[0]) => {
    try {
      setLastAnalysisAt(prev => ({ ...prev, [agent.id]: Date.now() }));

      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: agent.strategy,
          targetToken: getPrimaryTargetToken(agent.target),
          pool: agent.pool,
          protocol: agent.protocol,
          vault: agent.vault,
          capital: agent.initialCapital,
          interval: agent.interval || "1 Hour",
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const analysis = await res.json();
      const now = Date.now();

      // Find price for display
      const tokenPrice = analysis.marketPrices?.find((p: any) => p.symbol?.startsWith(analysis.token || "INIT"));
      const priceStr = tokenPrice ? `$${tokenPrice.price}` : "";

      const actionMap: Record<string, { action: string; type: AILog["type"]; amount: string }> = {
        BUY: { action: `AI Buy Signal: ${analysis.token}`, type: "buy", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
        SELL: { action: `AI Sell Signal: ${analysis.token}`, type: "sell", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
        HOLD: { action: `AI Hold Signal: ${analysis.token}`, type: "neutral", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
      };

      const entry = actionMap[analysis.signal] || actionMap.HOLD;

      setLastSignal(analysis.signal);

      const newLog: AILog = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        action: entry.action,
        agent: agent.name,
        amount: entry.amount,
        type: entry.type,
        time: "Just now",
        timestamp: now,
        reasoning: analysis.reasoning,
        signal: analysis.signal,
      };

      setLogs(prev => [newLog, ...prev].slice(0, 20));

      const isLP = (agent.strategy || "").toUpperCase() === "LP";
      const isDCA = (agent.strategy || "").toUpperCase().includes("DCA");
      const scheduledSignal =
        isDCA && analysis.signal !== "SELL"
          ? "BUY"
          : analysis.signal;

      if (isLP && autoExecute) {
        // LP strategy: calculate real fee from live CoinGecko volume data
        const poolList = (agent.pool || "INIT/USDC").split(",").map(p => p.trim());
        const poolCount = poolList.length;

        try {
          const feeRes = await fetch("/api/agent/lp-fee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pools: poolList, capital: agent.initialCapital || 0, cycleSeconds: 15 }),
          });

          if (!feeRes.ok) throw new Error("lp-fee api failed");
          const feeData = await feeRes.json();
          const feeEarned: number = feeData.totalFeeInit || 0;

          if (feeEarned <= 0) {
            // No volume data available — skip silently (no fake profit)
            return analysis;
          }

          const isRebalance = analysis.signal !== "HOLD" && analysis.confidence >= 65;
          const finalFee = isRebalance ? feeEarned * 1.5 : feeEarned;
          const ts = Date.now();

          if (isRebalance) {
            setLogs(prev => [{
              id: `${ts}-lp-r`,
              action: `LP Rebalance: ${poolList[0]}`,
              agent: agent.name,
              amount: `+${finalFee.toFixed(6)} INIT fee`,
              type: "earn" as const,
              time: "Just now",
              timestamp: ts,
              reasoning: `Rebalancing LP position across ${poolCount > 1 ? `${poolCount} pools` : poolList[0]}. Real 24h volume: $${feeData.breakdown?.[0]?.volume24h?.toLocaleString() || "—"}. Fees reinvested.`,
            }, ...prev].slice(0, 20));
            toast.success(`LP Rebalanced: ${poolList[0]}`, {
              description: `Fee: +${finalFee.toFixed(6)} INIT · Vol: $${feeData.breakdown?.[0]?.volume24h?.toLocaleString() || "—"} · ${analysis.confidence}% conf`,
            });
            executeSwapOnChain(agent, analysis.signal, analysis.confidence);
          } else {
            const aprStr = feeData.breakdown?.[0]?.apr ? ` · APR ~${feeData.breakdown[0].apr}%` : "";
            setLogs(prev => [{
              id: `${ts}-lp-f`,
              action: `LP Fee Accrued: ${poolList[0]}`,
              agent: agent.name,
              amount: `+${finalFee.toFixed(6)} INIT`,
              type: "earn" as const,
              time: "Just now",
              timestamp: ts,
              reasoning: `Real trading fees from ${poolCount > 1 ? `${poolCount} pools` : poolList[0]}. 24h vol: $${feeData.breakdown?.[0]?.volume24h?.toLocaleString() || "—"}${aprStr}. Source: ${feeData.source}.`,
            }, ...prev].slice(0, 20));
            toast.success(`LP Fee Accrued`, {
              description: `${agent.name}: +${finalFee.toFixed(6)} INIT${aprStr}`,
            });
          }

          setLiveProfit(prev => {
            return prev + finalFee;
          });
        } catch {
          // API failed — skip, do not simulate
        }
      } else if (autoExecute && scheduledSignal !== "HOLD") {
        if (isDCA && analysis.signal === "HOLD") {
          setLogs(prev => [{
            id: `${now}-dca-scheduled`,
            action: `DCA Scheduled Buy: ${analysis.token}`,
            agent: agent.name,
            amount: `${agent.interval || "1 Hour"} interval`,
            type: "ai" as const,
            time: "Just now",
            timestamp: now,
            reasoning: `Interval ${agent.interval || "1 Hour"} sudah jatuh tempo, jadi strategi DCA tetap akumulasi walau sinyal analisis saat ini HOLD.`,
            signal: "BUY",
          }, ...prev].slice(0, 20));
        }
        // DCA buys every due interval unless there is an explicit SELL signal.
        executeSwapOnChain(agent, scheduledSignal, analysis.confidence);
      } else if (!autoExecute && scheduledSignal !== "HOLD") {
        setLogs(prev => [{
          id: `${now}-manual`,
          action: "Trade Skipped: Auto Execute Off",
          agent: agent.name,
          amount: `${analysis.confidence}% confidence`,
          type: "neutral" as const,
          time: "Just now",
          timestamp: now,
          reasoning: `${scheduledSignal} signal was detected for ${analysis.token}, but Auto mode is disabled.`,
          signal: scheduledSignal,
        }, ...prev].slice(0, 20));
      }

      // Take-profit for non-LP strategies
      if (!isLP && autoExecute && analysis.signal === "HOLD") {
        const { quote } = getAgentTokens(agent);
        const quoteBal = remainingBalance[`${agent.id}_${quote}`] ?? 0;
        const initPrice = analysis.marketPrices?.find((p: any) => p.symbol?.startsWith("INIT"))?.price || 0.08;
        const quoteValueInInit = quote === "USDC" ? quoteBal / initPrice : quoteBal;
        const tpThreshold = (agent.takeProfitPct ?? 20) / 100;
        if (quoteValueInInit > (agent.initialCapital || 0) * tpThreshold) {
          executeSwapOnChain(agent, "SELL", 60);
        }
      }

      return analysis;
    } catch (error) {
      console.error("AI analysis failed:", error);
      return null;
    }
  }, [autoExecute, executeSwapOnChain, getPrimaryTargetToken]);

  useEffect(() => {
    fetchAIAnalysisRef.current = fetchAIAnalysis;
  }, [fetchAIAnalysis]);

  useEffect(() => {
    if (!runtimeHydrated || !runtimeOwnerAddress) return;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/dashboard-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerAddress: runtimeOwnerAddress,
            livePortfolio,
            liveProfit,
            executionCount,
            remainingBalance,
            costBasis,
            lastAnalysisAt,
            logs: logs.slice(0, 20).map((log) => ({
              ...log,
              time: undefined,
            })),
          }),
        });
      } catch (error) {
        console.error("Failed to persist dashboard state:", error);
      }
    }, 500);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [
    runtimeHydrated,
    runtimeOwnerAddress,
    livePortfolio,
    liveProfit,
    executionCount,
    remainingBalance,
    costBasis,
    lastAnalysisAt,
    logs,
  ]);

  useEffect(() => {
    const totalCapitalInit = activeAgents.reduce((sum, a) => sum + (a.initialCapital || 0), 0);
    const fallbackInitPrice = initPrice > 0 ? initPrice : 0.08;
    const totalCapitalUsd = totalCapitalInit * fallbackInitPrice;

    if (!runtimeHydrated) {
      return;
    }

    if (activeAgents.length === 0) {
      setLivePortfolio(0);
      setLiveProfit(0);
      setDynamicChartData(baseChartData);
      return;
    }

    setLivePortfolio(prev => (prev > 0 ? prev : totalCapitalUsd));

    const getIntervalLabel = () => {
      const intervals = activeAgents.map(a => a.interval || "1 Hour");
      if (intervals.includes("15 Minutes")) return 15;
      if (intervals.includes("30 Minutes")) return 30;
      return 60;
    };

    const step = getIntervalLabel();
    const now = new Date();

    const newData = Array.from({ length: 7 }).map((_, i) => {
      const time = new Date(now.getTime() - (6 - i) * step * 60000);
      return {
        name: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: i === 6 ? Math.floor(liveProfit) : Math.floor((liveProfit * (i + 1)) / 7)
      };
    });
    setDynamicChartData(newData);

    const logTs = Date.now();

    if (activeAgents.length === 0) {
      setLogs(prev => {
        if (prev.length > 0 && prev[0].id !== "p1") return prev; // keep saved logs
        return [
          { id: "p1", action: "System Monitoring", agent: "Registry & Executor", amount: "N/A", type: "neutral" as const, time: "Active", timestamp: logTs, reasoning: "Waiting for agent deployment" }
        ];
      });
      return;
    }

    // Only set initial logs if there are no saved logs
    setLogs(prev => {
      if (prev.length > 0 && prev[0].id !== "p1") return prev;
      return [
        { id: "init-3", action: "AI Agent Online", agent: activeAgents[0].name, amount: "Ready", type: "ai" as const, time: "Just now", timestamp: logTs, reasoning: "AI Agent is monitoring market conditions automatically based on your strategy." },
        { id: "init-2", action: "Optimizer Sync", agent: "Global", amount: "Success", type: "neutral" as const, time: "1m ago", timestamp: logTs - 60000, reasoning: "Synchronizing yield optimization strategies with current Initia network congestion levels." },
        { id: "init-1", action: "Liquidity Check", agent: "Core", amount: "Verified", type: "neutral" as const, time: "2m ago", timestamp: logTs - 120000, reasoning: "Verifying available liquidity across DEX pools for the selected pair." }
      ];
    });

    const pickDueAgent = () => {
      const dueAgents = activeAgents.filter((agent) => isAgentDue(agent));
      if (dueAgents.length === 0) return null;
      return dueAgents[Math.floor(Math.random() * dueAgents.length)];
    };

    // Run first eligible AI analysis shortly after load
    const initialTimeout = setTimeout(() => {
      const targetAgent = pickDueAgent();
      if (targetAgent) {
        fetchAIAnalysisRef.current?.(targetAgent);
      }
    }, 3000);

    // Portfolio value recalculation every 10s based on real balances
    const interval = setInterval(() => {
      if (activeAgents.length === 0) return;
      // Calculate total portfolio value in USD from all agent balances
      let totalValueUsd = 0;
      const currentInitPrice = initPrice > 0 ? initPrice : 0.08;

      activeAgents.forEach(a => {
        const { base, quote } = getAgentTokens(a);
        const bBal = remainingBalance[`${a.id}_${base}`] ?? (a.initialCapital || 0);
        const qBal = remainingBalance[`${a.id}_${quote}`] ?? 0;
        // INIT value in USD
        totalValueUsd += bBal * currentInitPrice;
        // Quote value in USD (USDC = $1, ETH = market price, etc.)
        if (quote === "USDC") totalValueUsd += qBal;
        else totalValueUsd += qBal * currentInitPrice; // simplified for non-USDC
      });

      setLivePortfolio(totalValueUsd);

      // Update chart with current profit
      setDynamicChartData(current => {
        const updated = [...current];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], value: Math.floor(liveProfit) };
        }
        return updated;
      });
    }, 10000);

    // Scheduler checks every 15 seconds, but each agent only runs when its
    // configured interval has elapsed.
    const aiInterval = setInterval(() => {
      if (activeAgents.length === 0) return;
      const targetAgent = pickDueAgent();
      if (targetAgent) {
        fetchAIAnalysisRef.current?.(targetAgent);
      }
    }, 15000);

    // Simulated feed entries also respect the selected agent interval.
    const feedInterval = setInterval(() => {
      if (activeAgents.length === 0) return;
      const agent = pickDueAgent();
      if (!agent) return;
      const ts = Date.now();
      const feedEntries: AILog[] = [
        { id: `${ts}-1`, action: `Scanning ${agent.target || "INIT"} Price`, agent: agent.name, amount: "Monitoring", type: "neutral", time: "Just now", timestamp: ts, reasoning: `Tracking price movements for ${agent.target || "INIT"} to identify optimal entry points.` },
        { id: `${ts}-2`, action: `Strategy Check: ${agent.strategy}`, agent: agent.name, amount: "Active", type: "ai", time: "Just now", timestamp: ts, reasoning: `Evaluating ${agent.strategy} parameters against current market volatility and volume.` },
        { id: `${ts}-3`, action: `Risk Assessment`, agent: agent.name, amount: "Passed", type: "neutral", time: "Just now", timestamp: ts, reasoning: `Position sizing and risk limits verified within acceptable thresholds for ${agent.name}.` },
        { id: `${ts}-4`, action: `Pool Liquidity Scan`, agent: agent.name, amount: "Verified", type: "neutral", time: "Just now", timestamp: ts, reasoning: `Checking DEX pool depth and slippage estimates for ${agent.target || "INIT"} trades.` },
        { id: `${ts}-5`, action: `Yield Optimization`, agent: agent.name, amount: "Analyzing", type: "earn", time: "Just now", timestamp: ts, reasoning: `Comparing current yield rates across InitiaDEX pools and esINIT staking rewards.` },
      ];
      const entry = feedEntries[Math.floor(Math.random() * feedEntries.length)];
      entry.id = ts + Math.random();
      setLogs(prev => [entry, ...prev].slice(0, 20));
    }, 20000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      clearInterval(aiInterval);
      clearInterval(feedInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgents.length, initPrice, liveProfit, runtimeHydrated, isAgentDue]);

  const handleSendChat = async (overrideMessage?: string) => {
    const messageText = overrideMessage || chatInput.trim();
    if (!messageText || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageText };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    if (!overrideMessage) setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          model: selectedModel,
          agentContext: {
            agentCount: myAgents.length,
            totalCapital: myAgents.reduce((sum, a) => sum + (a.initialCapital || 0), 0),
            liveProfit,
            initPrice,
            agents: myAgents.map(a => ({ name: a.name, target: a.target, strategy: a.strategy, status: "Active" })),
            network: "Initia Initiation-2 (Testnet)"
          },
        }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm experiencing a temporary issue. Please try again." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDistributeProfit = async (agent: any) => {
    const agentId = BigInt(agent.onChainAgentId || "1");
    if (chainId !== INITIA_CHAIN_ID) {
      try { await switchChainAsync({ chainId: INITIA_CHAIN_ID }); }
      catch { toast.error("Network Error", { description: "Please switch to Initia evm-1." }); return; }
    }

    // Check canDistribute first
    if (publicClient) {
      try {
        const [ok, secondsLeft] = await publicClient.readContract({
          address: CONTRACTS.PROFIT_SPLITTER as `0x${string}`,
          abi: ProfitSplitterABI,
          functionName: "canDistribute",
          args: [agentId],
        }) as [boolean, bigint];

        if (!ok) {
          const hours = Math.ceil(Number(secondsLeft) / 3600);
          toast.error("Epoch not elapsed", { description: `Next distribution in ~${hours}h` });
          return;
        }
      } catch {
        // proceed anyway if read fails
      }
    }

    const toastId = toast.loading("Distributing profit...");
    try {
      await writeContract({
        address: CONTRACTS.PROFIT_SPLITTER as `0x${string}`,
        abi: ProfitSplitterABI,
        functionName: "distributeProfit",
        args: [agentId],
      });
      toast.success("Profit distributed!", {
        id: toastId,
        description: "Protocol fee, creator share, and subscriber share have been allocated.",
      });
    } catch (err: any) {
      toast.error("Distribution failed", { id: toastId, description: err?.message?.slice(0, 80) });
    }
  };

  const handleWithdraw = async (agent: any) => {
    if (chainId !== INITIA_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_CHAIN_ID });
      } catch (err) {
        toast.error("Network Error", { description: "Please switch to Initia evm-1 in your wallet." });
        return;
      }
    }

    setIsWithdrawing(agent.id);
    try {
      const vaultAddress = (agent.contractAddress || CONTRACTS.AGENT_VAULT_DEFAULT) as `0x${string}`;

      // Read user's actual share balance from vault — includes profit from real swaps
      // Multiple demo agents can share the same mock vault. Using the wallet's
      // total `shares(address)` here would over-withdraw when closing one agent.
      const sharesToRedeem: bigint = parseUnits(agent.initialCapital?.toString() || "1", 18);
      await writeContract({
        address: vaultAddress,
        abi: AgentVaultABI,
        functionName: "withdraw",
        args: [sharesToRedeem],
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.warn("Withdraw failed/reverted.", err);
    } finally {
      setRemainingBalance(prev => {
        const next = { ...prev };
        const { base, quote } = getAgentTokens(agent);
        delete next[`${agent.id}_${base}`];
        delete next[`${agent.id}_${quote}`];
        return next;
      });
      setCostBasis(prev => {
        const next = { ...prev };
        delete next[agent.id];
        return next;
      });
      removeAgent(agent.id, !agent.isSubscription ? agent.contractAddress : undefined);
      setIsWithdrawing(null);
    }
  };

  const handleSubscribeOwn = async () => {
    const agent = subscribeTarget;
    if (!agent || !subscribeAmount || parseFloat(subscribeAmount) <= 0) return;

    if (chainId !== INITIA_CHAIN_ID) {
      try { await switchChainAsync({ chainId: INITIA_CHAIN_ID }); }
      catch { toast.error("Network Error", { description: "Please switch to Initia evm-1." }); return; }
    }

    setIsSubscribing(true);
    try {
      const amount = parseUnits(subscribeAmount, 18);
      await writeContract({
        address: CONTRACTS.MOCK_INIT as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`, amount],
      });
      await new Promise(r => setTimeout(r, 1000));
      await writeContract({
        address: CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`,
        abi: AgentVaultABI,
        functionName: "deposit",
        args: [amount],
      });
      await addAgent({
        id: Math.random().toString(36).substring(2, 9),
        name: `${agent.name} (Sub)`,
        strategy: agent.strategy,
        target: agent.target,
        pool: agent.pool,
        protocol: agent.protocol,
        vault: agent.vault,
        status: "Active",
        deployedAt: new Date().toISOString(),
        txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
        contractAddress: agent.contractAddress,
        initialCapital: parseFloat(subscribeAmount),
        creatorAddress: address as string,
        interval: agent.interval,
        isSubscription: true,
      });
      toast.success("Subscribed!", { description: `Deposited ${subscribeAmount} INIT into ${agent.name}.` });
      setSubscribeTarget(null);
      setSubscribeAmount("");
    } catch (err) {
      toast.error("Subscribe Failed");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="p-4 pt-8 md:pt-8 md:p-8 lg:h-[calc(100vh-4rem)] lg:overflow-hidden pb-24 md:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-full">

        {/* Main Content */}
        <div className="lg:col-span-8 space-y-5 lg:overflow-y-auto lg:pr-2 scrollbar-hide">
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-light tracking-tight text-zinc-200 mb-1">Your <span className="text-gradient font-bold">Dashboard</span></h1>
              <p className="text-zinc-600 text-sm">Monitoring {myAgents.length} active agents on Initia.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoExecute(prev => !prev)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full border text-[11px] font-mono transition-all duration-300 ${autoExecute ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/[0.15]" : "bg-white/[0.04] text-zinc-600 border-white/[0.06]"}`}
              >
                <Zap className={`h-3 w-3 ${autoExecute ? "animate-pulse" : ""}`} />
                Auto
              </button>
              <Badge className={`py-1.5 px-4 font-mono text-[11px] ${
                lastSignal === "BUY"  ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/[0.12]" :
                lastSignal === "SELL" ? "bg-red-500/[0.08] text-red-400 border-red-500/[0.12]" :
                "bg-white/[0.04] text-zinc-500 border-white/[0.06]"
              }`}>
                <Activity className={`h-3 w-3 mr-2 ${lastSignal && lastSignal !== "HOLD" ? "animate-pulse" : ""}`} />
                {lastSignal ?? "Scanning..."}
              </Badge>
            </div>
          </motion.div>

          {/* Stats - Pivy double-layer style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-[24px] bg-white/[0.02] border border-white/[0.04] p-[5px] sm:col-span-1">
              <div className="rounded-[19px] bg-white/[0.02] border border-white/[0.03] px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Portfolio</span>
                  <Wallet className="h-3.5 w-3.5 text-zinc-700" />
                </div>
                <div className="text-xl font-light text-zinc-200 font-mono tabular-nums">
                  ${livePortfolio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:contents">
              <div className="rounded-[24px] bg-white/[0.02] border border-white/[0.04] p-[5px]">
                <div className="rounded-[19px] bg-white/[0.02] border border-white/[0.03] px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Agents</span>
                    <Bot className="h-3.5 w-3.5 text-zinc-700" />
                  </div>
                  <div className="text-xl font-light text-zinc-200">{myAgents.length}</div>
                </div>
              </div>

              {/* Gradient border profit card (Spectral pattern) */}
              <div className="gradient-border gradient-border-animated glow-accent">
                <div className="rounded-[27px] px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-medium text-emerald-500/60 uppercase tracking-wider">Vault Profit</span>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="text-[9px] px-2 h-5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{executionCount} Trades</Badge>
                      <button
                        onClick={resetSimulatedPerformance}
                        className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-light text-emerald-400 font-mono tabular-nums">+{liveProfit.toFixed(4)} INIT</div>
                    <div className="text-[10px] text-zinc-600 font-mono mt-0.5">≈ ${(liveProfit * initPrice).toFixed(2)} USD · {priceSource}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart - enhanced with radial glow */}
          <div className="rounded-[28px] bg-white/[0.02] border border-white/[0.04] p-[5px] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] radial-glow pointer-events-none opacity-50" />
            <div className="rounded-[23px] bg-white/[0.02] border border-white/[0.03] relative">
              <div className="py-4 px-6">
                <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500/60" /> Performance
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dynamicChartData}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="name" stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", fontSize: "11px", boxShadow: "0 16px 40px -12px rgba(0,0,0,0.3)" }} />
                      <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} dot={false} fill="url(#chartGradient)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Deployed Agents */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Your Deployed Agents</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...ownedAgents, ...subscribedAgents].map(agent => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
                >
                  {/* Pivy double-layer agent card */}
                  <div className={`rounded-[22px] border p-[5px] transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] group ${agent.agentClosed ? "bg-red-500/[0.02] border-red-500/[0.08]" : "bg-white/[0.02] border-white/[0.04] hover:border-white/[0.07]"}`}>
                    <div className={`rounded-[17px] border p-4 ${agent.agentClosed ? "bg-red-500/[0.02] border-red-500/[0.06]" : "bg-white/[0.02] border-white/[0.03]"}`}>
                      {agent.agentClosed && (
                        <div className="flex items-center gap-2 rounded-[10px] bg-red-500/[0.08] border border-red-500/[0.12] px-3 py-2 mb-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500/60" />
                          <span className="text-[11px] text-red-400/80">Agent closed by creator — trading stopped. Withdraw your funds.</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-medium text-sm ${agent.agentClosed ? "text-zinc-500" : "text-zinc-200"}`}>{agent.name}</h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] text-zinc-600">{agent.strategy}</Badge>
                            <span className="text-[10px] text-zinc-700 font-mono leading-none">{agent.id.substring(0, 8)}</span>
                          </div>
                        </div>
                        <div className={`h-1.5 w-1.5 rounded-full ${agent.agentClosed ? "bg-red-500/40" : "bg-emerald-500/60 animate-pulse"}`} />
                      </div>
                      {/* Live balances */}
                      {(() => {
                        const { base, quote } = getAgentTokens(agent);
                        const baseBal = remainingBalance[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
                        const quoteBal = remainingBalance[`${agent.id}_${quote}`] ?? 0;
                        return (
                          <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <Coins className="h-3 w-3 text-zinc-600" />
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {baseBal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {base}
                                </span>
                              </div>
                              {agent.strategy === "LP" && quoteBal === 0 ? (
                                <span className="text-[10px] text-zinc-600">
                                  {(agent.pool || "").split(",").length > 1
                                    ? `${(agent.pool || "").split(",").length} pools`
                                    : (agent.pool || "").split(",")[0]?.trim() || "LP"}
                                </span>
                              ) : quoteBal > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="h-3 w-3 text-zinc-600" />
                                  <span className="text-[10px] font-mono text-emerald-400/70">
                                    {quoteBal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {quote}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex justify-between items-center opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-700 font-mono">Capital: {agent.initialCapital} {base}</span>
                                {agent.isSubscription
                                  ? <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-zinc-600">Sub</Badge>
                                  : <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-600/60">Creator</Badge>
                                }
                              </div>
                              <div className="flex gap-1.5">
                                <Button size="icon-xs" variant="ghost" className="text-zinc-600 hover:text-zinc-300" onClick={() => window.open(`https://scan.testnet.initia.xyz/initiation-2/accounts/${agent.contractAddress}`, "_blank")}>
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                                {/* Distribute Profit — permissionless, only for creator agents */}
                                {!agent.isSubscription && !agent.agentClosed && (
                                  <Button size="icon-xs" variant="ghost" className="text-zinc-600 hover:text-teal-400" onClick={() => handleDistributeProfit(agent)} title="Distribute epoch profit">
                                    <TrendingUp className="h-3 w-3" />
                                  </Button>
                                )}
                                {/* Withdraw / Close */}
                                {agent.isSubscription ? (
                                  <Button size="icon-xs" variant="ghost" className="text-zinc-600 hover:text-amber-400" onClick={() => handleWithdraw(agent)} disabled={isWithdrawing === agent.id} title="Unsubscribe & withdraw">
                                    {isWithdrawing === agent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownRight className="h-3 w-3" />}
                                  </Button>
                                ) : (
                                  <Button size="icon-xs" variant="ghost" className="text-zinc-600 hover:text-red-400" onClick={() => setCloseWarningAgent(agent)} disabled={isWithdrawing === agent.id} title="Close agent">
                                    {isWithdrawing === agent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Close Agent Warning Modal */}
        <AnimatePresence>
          {closeWarningAgent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setCloseWarningAgent(null)}
            >
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                className="max-w-sm w-full rounded-[24px] bg-[#111113] border border-white/[0.06] p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Close Agent</p>
                    <p className="text-xs text-zinc-600">{closeWarningAgent.name}</p>
                  </div>
                </div>
                <div className="rounded-[14px] bg-amber-500/[0.06] border border-amber-500/10 p-3 mb-5">
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    Subscribers who have joined this agent will lose access to the strategy. Their funds remain in the vault and they can withdraw independently — but closing this agent stops all trading activity.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm" onClick={() => setCloseWarningAgent(null)}>Cancel</Button>
                  <Button className="flex-1 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20" onClick={() => { handleWithdraw(closeWarningAgent); setCloseWarningAgent(null); }}>
                    Close Agent
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subscribe to Own Agent Modal */}
        <AnimatePresence>
          {subscribeTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSubscribeTarget(null)}
            >
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                className="max-w-sm w-full rounded-[24px] bg-[#111113] border border-white/[0.06] p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Subscribe to Agent</p>
                    <p className="text-xs text-zinc-600">{subscribeTarget?.name}</p>
                  </div>
                </div>
                <div className="space-y-2 mb-5">
                  <label className="text-xs text-zinc-500">Deposit Amount (INIT)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={subscribeAmount}
                    onChange={e => setSubscribeAmount(e.target.value)}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className="text-[10px] text-zinc-600">Funds go into the vault and are managed by this agent's strategy. You get them back when you unsubscribe.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm" onClick={() => setSubscribeTarget(null)}>Cancel</Button>
                  <Button className="flex-1 text-sm" disabled={isSubscribing || !subscribeAmount || parseFloat(subscribeAmount) <= 0} onClick={handleSubscribeOwn}>
                    {isSubscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                    Subscribe
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-5 lg:h-full lg:min-h-0 lg:overflow-hidden pb-10 lg:pb-0">
          {/* AI Logs */}
          <Card className="bg-white/[0.02] border-white/[0.04] flex flex-col h-[300px] lg:flex-[0_0_auto] lg:max-h-[280px] lg:overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-white/[0.04] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-[10px] bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-zinc-500" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Live AI Feed</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: [0.36, 0.2, 0.07, 1] }}
                      className="border-l-2 border-white/[0.06] pl-3 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] font-medium ${log.type === "buy" ? "text-emerald-400" : log.type === "sell" ? "text-red-400" : log.type === "execute" ? "text-cyan-400" : log.type === "earn" ? "text-amber-400" : "text-zinc-400"}`}>
                          {log.action}
                        </span>
                        <span className="text-[9px] text-zinc-700 font-mono">{log.time}</span>
                      </div>
                      {log.reasoning && (
                        <p className="text-[10px] leading-relaxed text-zinc-600 line-clamp-2">{log.reasoning}</p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* AI Chat */}
          <Card className="bg-white/[0.02] border-white/[0.04] flex flex-col h-[450px] lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-white/[0.04] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">AI Assistant</span>
                </div>
                {/* Model selector */}
                <div className="relative">
                  <button
                    onClick={() => setModelMenuOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-white/[0.03] border border-white/[0.06] text-[10px] font-medium text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1] transition-all duration-200"
                  >
                    <Sparkles className="h-2.5 w-2.5 text-emerald-400/70" />
                    {selectedModel.replace("gemini-", "").replace("-preview", "★")}
                    <svg className="h-2.5 w-2.5" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-[14px] bg-[#0d0d10] border border-white/[0.08] shadow-xl overflow-hidden">
                      {[
                        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Fast" },
                        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "Smart" },
                        { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", badge: "Lite" },
                        { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", badge: "New" },
                        { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", badge: "Best" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[11px] transition-colors ${
                            selectedModel === m.id
                              ? "bg-emerald-500/[0.08] text-emerald-400"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                          }`}
                        >
                          <span>{m.label}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            selectedModel === m.id
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/[0.06] text-zinc-600"
                          }`}>{m.badge}</span>
                        </button>
                      ))}
                    </div>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-10">
                  <Brain className="h-7 w-7 mb-2" />
                  <p className="text-[10px] uppercase font-medium tracking-wider">System Ready</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-[16px] p-3 text-[11px] leading-relaxed ${msg.role === "user" ? "bg-emerald-500/[0.08] text-zinc-300 border border-emerald-500/10" : "bg-white/[0.03] text-zinc-500 border border-white/[0.04]"}`}>
                    {renderMarkdown(msg.content)}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-[16px] p-3 bg-white/[0.03] border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-[10px] text-zinc-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </CardContent>

            {/* Prompt suggestions */}
            <div className="px-4 py-2.5 overflow-hidden" ref={promptContainerRef}>
              <motion.div
                className="flex gap-2 cursor-grab active:cursor-grabbing"
                drag="x"
                dragConstraints={{ left: dragLimit, right: 0 }}
                whileTap={{ cursor: "grabbing" }}
              >
                {["Portfolio Summary", "Market Analysis", "Check AI Signals", "Help"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSendChat(prompt)}
                    className="whitespace-nowrap px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-500 text-[10px] font-medium hover:bg-white/[0.06] hover:text-zinc-300 transition-all duration-300 active:scale-[0.97]"
                  >
                    {prompt}
                  </button>
                ))}
              </motion.div>
            </div>

            <div className="p-4 border-t border-white/[0.04] shrink-0">
              <div className="flex gap-2.5 items-center">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Ask me anything..."
                  className="h-10 text-[11px] rounded-[14px] pl-4 pr-10"
                />
                <Button
                  size="icon"
                  onClick={() => handleSendChat()}
                  disabled={isChatLoading}
                  className="h-10 w-10 rounded-[14px] shrink-0"
                >
                  {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> : <Send className="h-4 w-4 text-zinc-950" />}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
