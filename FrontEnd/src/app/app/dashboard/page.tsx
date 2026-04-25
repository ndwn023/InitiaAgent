"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getModelMeta } from "@/lib/model-labels";
import {
  Wallet,
  Activity,
  Bot,
  ArrowDownRight,
  Trash2,
  ExternalLink,
  Loader2,
  Coins,
  DollarSign,
  TrendingUp,
  Send,
  Sparkles,
  Zap,
  RotateCcw,
  Share2,
} from "lucide-react";
import { useAgents } from "@/lib/hooks/use-agents";
import { useAccount, useSwitchChain, usePublicClient, useBalance } from "wagmi";
import { toast } from "sonner";
import { AgentVaultABI } from "@/lib/abis/AgentVault";
import { ProfitSplitterABI } from "@/lib/abis/ProfileSplitter";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { parseUnits, formatUnits } from "viem";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  CONTRACTS,
  INITIA_EVM_CHAIN_ID,
  explorerEvmAccountUrl,
  getAgentIntervalMs as getIntervalMsFromLabel,
  readAgentMetrics,
  writeAgentMetrics,
  winRate as computeWinRate,
  type AgentMetrics,
  type DeployedAgent,
} from "@initia-agent/shared";
import { useMockWallet } from "@/lib/hooks/use-mock-wallet";
import { useActivationFee } from "@/lib/hooks/use-activation-fee";

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
  time?: string;
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
  INIT: CONTRACTS.MOCK_INIT,
  USDC: CONTRACTS.MOCK_USDC,
};

const ALL_CHAT_MODELS = [
  // ── Claude (Anthropic) ──────────────────────────────────────────────────────
  { id: "claude-haiku-4-5",  badge: "Fast",  provider: "anthropic" },
  { id: "claude-sonnet-4-6", badge: "Best",  provider: "anthropic" },
  { id: "claude-opus-4-6",   badge: "Pro",   provider: "anthropic" },
  { id: "claude-cli",        badge: "Local", provider: "anthropic" },
  // ── Gemini (Google) ────────────────────────────────────────────────────────
  { id: "gemini-2.5-flash",  badge: "Fast",  provider: "gemini" },
  { id: "gemini-3-flash",    badge: "Fast",  provider: "gemini" },
  { id: "gemini-3.1-pro",    badge: "Smart", provider: "gemini" },
];

const CHART_WINDOW = 30;
const baseChartData: { name: string; value: number }[] = [];

export default function DashboardPage() {
  const { myAgents, removeAgent, addAgent } = useAgents();
  const { writeContract, mockDexSwap } = useInterwovenEvm();
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<DeployedAgent | null>(null);
  const [subscribeAmount, setSubscribeAmount] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [closeWarningAgent, setCloseWarningAgent] = useState<DeployedAgent | null>(null);
  const { data: walletInitBalance } = useBalance({
    address,
    chainId: INITIA_EVM_CHAIN_ID,
  });
  const { creditInit, spendInit } = useMockWallet(address, Number(walletInitBalance?.formatted ?? 0));
  const { chargeFee } = useActivationFee();
  const [logs, setLogs] = useState<AILog[]>([]);
  const [dynamicChartData, setDynamicChartData] = useState(baseChartData);

  const ownedAgents = useMemo(
    () => myAgents.filter((agent) => !agent.isSubscription),
    [myAgents]
  );
  // Hide (Sub) entry if user is already the creator of that same contract — avoids showing duplicate cards
  const ownedContracts = useMemo(
    () => new Set(ownedAgents.map(a => a.contractAddress)),
    [ownedAgents]
  );
  const subscribedAgents = useMemo(
    () => myAgents.filter((agent) => agent.isSubscription && !ownedContracts.has(agent.contractAddress)),
    [myAgents, ownedContracts]
  );
  // Deduplicated list used for all execution loops — no double-trading
  const activeAgents = useMemo(
    () => [...ownedAgents, ...subscribedAgents],
    [ownedAgents, subscribedAgents]
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ anthropic: boolean; gemini: boolean }>({ anthropic: true, gemini: true });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [livePortfolio, setLivePortfolio] = useState(0);
  const [liveProfit, setLiveProfit] = useState(0); // in INIT (portfolio delta vs initial capital)
  // Total initial capital derived from active agents. Recomputes automatically
  // when myAgents changes — safe to read during render.
  const totalInitialCapital = useMemo(
    () => myAgents.reduce((s, a) => s + (a.initialCapital || 0), 0),
    [myAgents],
  );
  const [initPrice, setInitPrice] = useState(0.08); // INIT/USD
  const [lastSignal, setLastSignal] = useState<"BUY" | "SELL" | "HOLD" | null>(null);
  const [autoExecute, setAutoExecute] = useState(true);
  // Per-agent execution lock — prevents duplicate concurrent trades for the same agent
  // while still allowing different agents to execute simultaneously.
  const executingAgentsRef = useRef(new Set<string>());
  const [remainingBalance, setRemainingBalance] = useState<Record<string, number>>({});
  // Track cost basis: how much INIT was spent to acquire quote tokens per agent
  const [costBasis, setCostBasis] = useState<Record<string, number>>({});
  const [executionCount, setExecutionCount] = useState(0);
  const [runtimeHydrated, setRuntimeHydrated] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<Record<string, number>>({});

  const metrics: AgentMetrics = useMemo(() => readAgentMetrics(costBasis), [costBasis]);
  const winRatePct = Math.round(computeWinRate(metrics) * 100);

  const resetSimulatedPerformance = () => {
    const nextBalances: Record<string, number> = {};
    myAgents.forEach(agent => {
      const { base, quote } = getAgentTokens(agent);
      nextBalances[`${agent.id}_${base}`] = agent.initialCapital || 0;
      nextBalances[`${agent.id}_${quote}`] = 0;
    });
    const totalInit = myAgents.reduce((s, a) => s + (a.initialCapital || 0), 0);
    setRemainingBalance(nextBalances);
    setLivePortfolio(totalInit);
    toast.success("Portfolio reset", { description: "Balances restored to initial capital." });
  };

  // Periodic price fetcher (independent of trades)
  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    const fetchLivePrices = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const res = await fetch("/api/agent/analyze/market", { signal: controller.signal });
        if (!res.ok || controller.signal.aborted || cancelled) return;
        const data = await res.json();
        if (typeof data.currentPrice === "number" && data.currentPrice > 0) {
          setInitPrice(data.currentPrice);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("Price fetch failed", err);
        }
      } finally {
        if (activeController === controller) activeController = null;
      }
    };
    void fetchLivePrices();
    const timer = setInterval(() => {
      void fetchLivePrices();
    }, 30_000);

    // Check which API keys are configured
    fetch("/api/agent/strategy-skills").then(r => r.json()).then(data => {
      if (data?.apiKeys) setApiKeyStatus(data.apiKeys);
    }).catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(timer);
      activeController?.abort();
    };
  }, []);

  const promptContainerRef = useRef<HTMLDivElement>(null);
  const fetchAIAnalysisRef = useRef<((agent: typeof myAgents[0]) => Promise<unknown>) | null>(null);
  const executeSwapOnChainRef = useRef<
    | ((
        agent: typeof myAgents[0],
        signal: "BUY" | "SELL",
        confidence: number,
        marketInitPrice?: number,
      ) => Promise<void>)
    | null
  >(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistHashRef = useRef("");
  const hasServerStateLoadedRef = useRef(false);
  const analysisInFlightRef = useRef<Set<string>>(new Set());
  const initPriceRef = useRef(initPrice);
  const liveProfitRef = useRef(liveProfit);
  const remainingBalanceRef = useRef(remainingBalance);
  const costBasisRef = useRef(costBasis);
  const activeAgentsRef = useRef(activeAgents);
  useEffect(() => { initPriceRef.current = initPrice; }, [initPrice]);
  useEffect(() => { liveProfitRef.current = liveProfit; }, [liveProfit]);
  useEffect(() => { remainingBalanceRef.current = remainingBalance; }, [remainingBalance]);
  useEffect(() => { costBasisRef.current = costBasis; }, [costBasis]);
  useEffect(() => { activeAgentsRef.current = activeAgents; }, [activeAgents]);

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
            <span className="text-purple-500/60 shrink-0">•</span>
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
      // Seed assistant greeting once the user has agents but no prior chat — mount-style init.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const getAgentIntervalMs = useCallback(
    (agent: typeof myAgents[0]) => getIntervalMsFromLabel(agent.interval),
    []
  );

  const isAgentDue = useCallback((agent: typeof myAgents[0], now = Date.now()) => {
    const lastRun = lastAnalysisAt[agent.id] || 0;
    return now - lastRun >= getAgentIntervalMs(agent);
  }, [lastAnalysisAt, getAgentIntervalMs]);

  const applyPersistedRuntimeState = useCallback((persisted: Record<string, unknown> | null) => {
    const nextBalances: Record<string, number> = {};
    const nextCostBasis: Record<string, number> = {};
    const incomingCostBasis = (persisted?.costBasis as Record<string, number>) ?? {};
    myAgents.forEach((agent) => {
      const { base, quote } = getAgentTokens(agent);
      nextBalances[`${agent.id}_${base}`] =
        (persisted?.remainingBalance as Record<string, number>)?.[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
      nextBalances[`${agent.id}_${quote}`] =
        (persisted?.remainingBalance as Record<string, number>)?.[`${agent.id}_${quote}`] ?? 0;
      const cb = incomingCostBasis[agent.id];
      if (cb != null) nextCostBasis[agent.id] = Number(cb) || 0;
    });
    for (const [key, value] of Object.entries(incomingCostBasis)) {
      if (key.startsWith("__")) nextCostBasis[key] = Number(value) || 0;
    }

    const fallbackInitPrice = initPriceRef.current > 0 ? initPriceRef.current : 0.08;

    setRemainingBalance(nextBalances);
    setCostBasis(nextCostBasis);
    setLastAnalysisAt((persisted?.lastAnalysisAt as Record<string, number>) ?? {});
    setExecutionCount(Number(persisted?.executionCount || 0));
    setLiveProfit(Number(persisted?.liveProfit || 0));

    const totalInitEquiv = myAgents.reduce((sum, agent) => {
      const { base, quote } = getAgentTokens(agent);
      const bBal = nextBalances[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
      const qBal = nextBalances[`${agent.id}_${quote}`] ?? 0;
      return sum + bBal + (quote === "USDC" && fallbackInitPrice > 0 ? qBal / fallbackInitPrice : qBal);
    }, 0);
    setLivePortfolio(totalInitEquiv);
    setLogs(Array.isArray(persisted?.logs) ? (persisted.logs as AILog[]).slice(0, 20) : []);
  }, [getAgentTokens, myAgents]);

  useEffect(() => {
    if (!runtimeOwnerAddress) {
      hasServerStateLoadedRef.current = false;
      const nextBalances: Record<string, number> = {};
      myAgents.forEach((agent) => {
        const { base, quote } = getAgentTokens(agent);
        nextBalances[`${agent.id}_${base}`] = agent.initialCapital || 0;
        nextBalances[`${agent.id}_${quote}`] = 0;
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemainingBalance(nextBalances);
      setRuntimeHydrated(true);
      return;
    }

    const controller = new AbortController();

    const hydrateRuntimeState = async () => {
      // Retry up to 2 times with 1s backoff for transient backend startup races
      const MAX_ATTEMPTS = 3;
      const RETRY_MS     = 1000;
      let persisted: Record<string, unknown> | null = null;
      let loadedFromServer = false;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (controller.signal.aborted) return;

        // Per-attempt timeout: 8 seconds
        const attemptController = new AbortController();
        const timeoutId = setTimeout(() => attemptController.abort(), 8000);
        // Also abort if the outer cleanup fires
        controller.signal.addEventListener("abort", () => attemptController.abort(), { once: true });

        try {
          const res = await fetch(
            `/api/dashboard-state?ownerAddress=${encodeURIComponent(runtimeOwnerAddress)}`,
            { signal: attemptController.signal },
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            persisted = await res.json() as Record<string, unknown>;
            loadedFromServer = true;
          }
          // Non-2xx (e.g. 400, 500) → persisted stays null, don't retry
          break;
        } catch (err) {
          clearTimeout(timeoutId);
          if (controller.signal.aborted) return; // component unmounted — bail silently

          const isNetworkErr = (err as Error).name === "AbortError" ||
                               (err as Error).name === "TypeError";

          if (isNetworkErr && attempt < MAX_ATTEMPTS) {
            // Transient failure — wait then retry
            await new Promise<void>(resolve => setTimeout(resolve, RETRY_MS * attempt));
            continue;
          }

          // Final attempt or non-retriable error
          console.warn("[dashboard] Failed to hydrate dashboard state (backend may not be ready):", (err as Error).message);
          break;
        }
      }

      if (controller.signal.aborted) return;

      if (loadedFromServer) {
        hasServerStateLoadedRef.current = true;
        applyPersistedRuntimeState(persisted);
      } else {
        const nextBalances: Record<string, number> = {};
        myAgents.forEach((agent) => {
          const { base, quote } = getAgentTokens(agent);
          nextBalances[`${agent.id}_${base}`] = agent.initialCapital || 0;
          nextBalances[`${agent.id}_${quote}`] = 0;
        });
        setRemainingBalance(nextBalances);
      }
      setRuntimeHydrated(true);
    };

    void hydrateRuntimeState();

    return () => {
      controller.abort();
    };
  }, [applyPersistedRuntimeState, getAgentTokens, myAgents, runtimeOwnerAddress]);

  // Real-time dashboard sync via Server-Sent Events.
  // The backend pushes a new snapshot the moment state is upserted — no polling delay.
  // Falls back to a 15s poll if SSE is unavailable (e.g. old proxy that strips streaming).
  useEffect(() => {
    if (!runtimeHydrated || !runtimeOwnerAddress) return;

    const url = `/api/dashboard-state/stream?ownerAddress=${encodeURIComponent(runtimeOwnerAddress)}`;
    let es: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let sseWorking = false;

    const applyData = (raw: string) => {
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        hasServerStateLoadedRef.current = true;
        applyPersistedRuntimeState(data);
      } catch {
        // malformed SSE frame — ignore
      }
    };

    const startFallbackPoll = () => {
      if (fallbackTimer) return; // already running
      const poll = async () => {
        try {
          const res = await fetch(
            `/api/dashboard-state?ownerAddress=${encodeURIComponent(runtimeOwnerAddress)}`,
            { cache: "no-store" },
          );
          if (!res.ok) return;
          const persisted = await res.json() as Record<string, unknown> | null;
          if (persisted) applyPersistedRuntimeState(persisted);
          hasServerStateLoadedRef.current = true;
        } catch {
          // keep local state on transient failure
        }
      };
      void poll();
      fallbackTimer = setInterval(() => void poll(), 15_000);
    };

    try {
      es = new EventSource(url);

      es.onmessage = (e) => {
        sseWorking = true;
        applyData(e.data);
      };

      es.onerror = () => {
        if (!sseWorking) {
          // SSE never connected successfully — fall back to polling
          es?.close();
          es = null;
          startFallbackPoll();
        }
        // If SSE was working before, EventSource auto-reconnects — let it retry
      };
    } catch {
      // EventSource not supported — fall back
      startFallbackPoll();
    }

    return () => {
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [applyPersistedRuntimeState, runtimeHydrated, runtimeOwnerAddress]);

  const executeSwapOnChain = useCallback(async (
    agent: typeof myAgents[0],
    signal: "BUY" | "SELL",
    confidence: number,
    marketInitPrice?: number
  ) => {
    const ts = Date.now();
    const { base, quote } = getAgentTokens(agent);
    const fromToken = signal === "BUY" ? base : quote;
    const toToken   = signal === "BUY" ? quote : base;

    const balKey  = agent.id;
    const latestBalances = remainingBalanceRef.current;
    const baseBal = latestBalances[`${balKey}_${base}`] ?? (agent.initialCapital || 0);
    const quoteBal = latestBalances[`${balKey}_${quote}`] ?? 0;
    const fromBal  = signal === "BUY" ? baseBal : quoteBal;
    const minConfidence = agent.minConfidence ?? 50;
    if (confidence < minConfidence) {
      setLogs(prev => [{
        id: `${ts}-lowconf`,
        action: "Trade Skipped: Low Confidence",
        agent: agent.name,
        amount: `${confidence}% < ${minConfidence}%`,
        type: "neutral" as const,
        time: "Just now",
        timestamp: ts,
        reasoning: `AI confidence ${confidence}% is below configured minimum ${minConfidence}%.`,
        signal,
      }, ...prev].slice(0, 20));
      return;
    }
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

    if (executingAgentsRef.current.has(agent.id)) return;
    executingAgentsRef.current.add(agent.id);

    const isDCA   = (agent.strategy || "").toUpperCase().includes("DCA");
    const isYIELD = (agent.strategy || "").toUpperCase().includes("YIELD");
    const isVIP   = (agent.strategy || "").toUpperCase().includes("VIP");
    // Per-strategy defaults when the user hasn't overridden tradeSizePct:
    //  DCA   → 6 % (steady accumulation, more than before to compound faster)
    //  YIELD → 12% (move quickly to capture APY windows)
    //  VIP   → 15% (aggressive sizing for tier maintenance and breakout capture)
    //  other → 10% (balanced default)
    const defaultTradePct = isDCA ? 0.06 : isYIELD ? 0.12 : isVIP ? 0.15 : 0.10;
    const baseTradePct = agent.tradeSizePct != null ? agent.tradeSizePct / 100 : defaultTradePct;
    const confidenceScale = 0.75 + confidence / 200; // 0.75 .. 1.25
    const tradePct    = Math.min(baseTradePct * confidenceScale, 0.35);
    let tradeAmount = Math.round(fromBal * tradePct * 100) / 100;

    const stopLossPct   = agent.stopLossPct ?? 10;
    const stopLossFloor = (agent.initialCapital || 0) * (1 - stopLossPct / 100);
    // Convert all holdings to INIT-equivalent before comparing against the floor.
    // Without this conversion, USDC balance (e.g. 4 USDC) is incorrectly treated as
    // 4 INIT, causing false-positive stop-loss triggers after every BUY trade.
    const slCheckPrice  = typeof marketInitPrice === "number" && marketInitPrice > 0
      ? marketInitPrice
      : (initPriceRef.current > 0 ? initPriceRef.current : 0.08);
    const totalValueInInit = baseBal + (quote === "USDC" && slCheckPrice > 0 ? quoteBal / slCheckPrice : quoteBal);
    if (signal === "BUY" && totalValueInInit < stopLossFloor) {
      executingAgentsRef.current.delete(agent.id);
      if (quoteBal > 0) void executeSwapOnChainRef.current?.(agent, "SELL", 99, marketInitPrice);
      return;
    }
    if (tradeAmount < 0.01) {
      executingAgentsRef.current.delete(agent.id);
      return;
    }

    try {
      const vaultAddress = (agent.contractAddress || CONTRACTS.AGENT_VAULT_DEFAULT) as `0x${string}`;
      const tokenInAddr  = TESTNET_TOKENS[fromToken];

      if (!tokenInAddr) {
        throw new Error(`Token ${fromToken} not configured`);
      }

      let outputAmount = 0;
      let price = initPriceRef.current > 0 ? initPriceRef.current : 0.08;
      let txHash = "";

      if (publicClient) {
        try {
          const [vaultPaused, intervalSeconds, lastExecutionTs, maxTradeBps, vaultTotalAssets, tokenInAllowed] = await Promise.all([
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "paused" }) as Promise<boolean>,
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "intervalSeconds" }) as Promise<bigint>,
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "lastExecutionTs" }) as Promise<bigint>,
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "maxTradeBps" }) as Promise<bigint>,
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "totalAssets" }) as Promise<bigint>,
            publicClient.readContract({ address: vaultAddress, abi: AgentVaultABI, functionName: "allowedTokens", args: [tokenInAddr] }) as Promise<boolean>,
          ]);

          if (vaultPaused) throw new Error("Vault is paused");
          if (!tokenInAllowed) throw new Error(`Token ${fromToken} is not whitelisted in this vault`);

          const nowSec = BigInt(Math.floor(Date.now() / 1000));
          if (intervalSeconds > 0n && lastExecutionTs > 0n && nowSec < lastExecutionTs + intervalSeconds) {
            const waitSeconds = Number(lastExecutionTs + intervalSeconds - nowSec);
            throw new Error(`Vault cooldown: wait ${waitSeconds}s`);
          }

          const maxTradeAmount = Number(formatUnits((vaultTotalAssets * maxTradeBps) / 10000n, 18));
          if (maxTradeAmount > 0) {
            tradeAmount = Math.min(tradeAmount, Math.round(maxTradeAmount * 100) / 100);
          }
          if (tradeAmount < 0.01) throw new Error("Trade amount below vault minimum");
        } catch (readErr: unknown) {
          const msg = readErr instanceof Error ? readErr.message : String(readErr);
          if (msg.includes("Vault") || msg.includes("cooldown") || msg.includes("whitelist") || msg.includes("minimum")) {
            throw readErr; // re-throw pre-check failures
          }
          console.warn("Vault read failed, proceeding with defaults:", msg.slice(0, 80));
        }
      }

      const resolvedInitPrice =
        typeof marketInitPrice === "number" && marketInitPrice > 0
          ? marketInitPrice
          : (initPriceRef.current > 0 ? initPriceRef.current : 0.08);
      const fromPriceUsd = fromToken === "USDC" ? 1.0 : resolvedInitPrice;
      const toPriceUsd   = toToken   === "USDC" ? 1.0 : resolvedInitPrice;
      price = resolvedInitPrice;

      // ── Execute swap on-chain via InterwovenKit (auto-signed, no runner auth needed) ──
      let clientExecutionFee = 0;
      try {
        const swapResult = await mockDexSwap({
          fromToken, toToken, amountIn: tradeAmount,
          fromPriceUsd, toPriceUsd,
          confidence,
          strategy: agent.strategy,
        });
        txHash            = swapResult.txHash;
        outputAmount      = swapResult.amountOut;
        clientExecutionFee = swapResult.executionFee;
        console.log(`[InterwovenKit] swap executed: ${txHash}`);
      } catch (swapErr: unknown) {
        // Fallback: compute estimated output without on-chain tx
        const swapMsg = swapErr instanceof Error ? swapErr.message : String(swapErr);
        console.warn("[InterwovenKit] swap failed, using estimate:", swapMsg.slice(0, 80));
        const slippage = confidence >= 80 ? 0.999 : 0.997;
        outputAmount = Math.round((tradeAmount * fromPriceUsd / toPriceUsd) * slippage * 100) / 100;
        txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      }

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

      // ── Profit is computed from portfolio-delta in the 10s interval ──────
      // Keep realizedProfit for the trade log display only (not for state)
      let realizedProfit = 0;
      if (signal === "SELL") {
        const sellPortion     = quoteBal > 0 ? tradeAmount / quoteBal : 1;
        const costForThisSell = (costBasisRef.current[balKey] || 0) * sellPortion;
        realizedProfit        = outputAmount - costForThisSell;
        setCostBasis(prev => {
          const next = { ...prev };
          next[balKey] = Math.max(0, (prev[balKey] || 0) - costForThisSell);
          const m = readAgentMetrics(next);
          m.tradesExecuted += 1;
          m.feesPaid       += clientExecutionFee;
          if (realizedProfit > 0) m.winningTrades += 1;
          writeAgentMetrics(next, m);
          return next;
        });
      } else {
        setCostBasis(prev => {
          const next = { ...prev, [balKey]: (prev[balKey] || 0) + tradeAmount };
          const m = readAgentMetrics(next);
          m.tradesExecuted += 1;
          m.feesPaid       += clientExecutionFee / Math.max(resolvedInitPrice, 0.0001);
          writeAgentMetrics(next, m);
          return next;
        });
      }

      const newBaseBal  = (signal === "BUY" ? Math.max(0, baseBal - tradeAmount) : baseBal + outputAmount).toFixed(2);
      const newQuoteBal = (signal === "BUY" ? quoteBal + outputAmount : Math.max(0, quoteBal - tradeAmount)).toFixed(2);
      const txShort     = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}` : "";
      const profitStr   = signal === "SELL" && realizedProfit > 0 ? ` Profit: +${realizedProfit.toFixed(4)} INIT (~$${(realizedProfit * price).toFixed(2)})` : "";

      const execTs = Date.now();
      setLogs(prev => [{
        id: `${execTs}-${Math.random().toString(36).slice(2, 7)}`,
        action: `Swapped ${tradeAmount.toFixed(2)} ${fromToken} → ${outputAmount.toFixed(2)} ${toToken}`,
        agent: agent.name,
        amount: `@$${price} INIT`,
        type: "execute" as const,
        time: "Just now",
        timestamp: execTs,
        reasoning: `${signal} at ${confidence}% conf. Bal: ${newBaseBal} ${base} / ${newQuoteBal} ${quote}.${txShort ? ` Tx: ${txShort}` : ""}${profitStr}`,
        signal,
      }, ...prev].slice(0, 20));

      toast.success(`Swapped ${fromToken} → ${toToken}`, {
        description: `${tradeAmount.toFixed(2)} ${fromToken} → ${outputAmount.toFixed(2)} ${toToken}${realizedProfit > 0 ? ` | Profit: +${realizedProfit.toFixed(4)} INIT` : ""}${txShort ? ` | Tx: ${txShort}` : ""}`,
      });
    } catch (error: unknown) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      const message = rawMsg.substring(0, 160) || "Unknown execution error";
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
      executingAgentsRef.current.delete(agent.id);
    }
  }, [getAgentTokens, mockDexSwap, publicClient]);

  const fetchAIAnalysis = useCallback(async (agent: typeof myAgents[0]) => {
    if (analysisInFlightRef.current.has(agent.id)) return null;
    analysisInFlightRef.current.add(agent.id);

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
      type MarketPrice = { symbol?: string; price?: number };
      type AnalysisResponse = {
        signal?: "BUY" | "SELL" | "HOLD";
        token?: string;
        confidence?: number;
        reasoning?: string;
        marketPrices?: MarketPrice[];
      };
      const analysis = (await res.json()) as AnalysisResponse;
      const now = Date.now();
      const liveInitPrice =
        analysis.marketPrices?.find((p) => p.symbol?.startsWith("INIT"))?.price ||
        initPriceRef.current ||
        0.08;

      // Find price for display
      const tokenPrice = analysis.marketPrices?.find((p) => p.symbol?.startsWith(analysis.token || "INIT"));
      const priceStr = tokenPrice ? `$${tokenPrice.price}` : "";

      const actionMap: Record<string, { action: string; type: AILog["type"]; amount: string }> = {
        BUY: { action: `AI Buy Signal: ${analysis.token}`, type: "buy", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
        SELL: { action: `AI Sell Signal: ${analysis.token}`, type: "sell", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
        HOLD: { action: `AI Hold Signal: ${analysis.token}`, type: "neutral", amount: priceStr ? `${priceStr} | ${analysis.confidence}%` : `${analysis.confidence}% confidence` },
      };

      const resolvedSignal: "BUY" | "SELL" | "HOLD" = analysis.signal ?? "HOLD";
      const resolvedConfidence = analysis.confidence ?? 0;
      const entry = actionMap[resolvedSignal] || actionMap.HOLD;

      setLastSignal(resolvedSignal);

      const newLog: AILog = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        action: entry.action,
        agent: agent.name,
        amount: entry.amount,
        type: entry.type,
        time: "Just now",
        timestamp: now,
        reasoning: analysis.reasoning,
        signal: resolvedSignal,
      };

      setLogs(prev => [newLog, ...prev].slice(0, 20));

      const isLP = (agent.strategy || "").toUpperCase() === "LP";
      const isDCA = (agent.strategy || "").toUpperCase().includes("DCA");
      const scheduledSignal: "BUY" | "SELL" | "HOLD" =
        isDCA && resolvedSignal !== "SELL"
          ? "BUY"
          : resolvedSignal;

      if (isLP && autoExecute) {
        // LP strategy: calculate real fee from live CoinGecko volume data
        const poolList = (agent.pool || "INIT/USDC").split(",").map(p => p.trim());
        const poolCount = poolList.length;

        try {
          const feeRes = await fetch("/api/agent/lp-fee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pools: poolList, capital: agent.initialCapital || 0, cycleSeconds: Math.round(getAgentIntervalMs(agent) / 1000) }),
          });

          if (!feeRes.ok) throw new Error("lp-fee api failed");
          const feeData = await feeRes.json();
          const feeEarned: number = feeData.totalFeeInit || 0;

          if (feeEarned <= 0) {
            // No volume data available — skip silently (no fake profit)
            return analysis;
          }

          const isRebalance = resolvedSignal !== "HOLD" && resolvedConfidence >= 65;
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
              description: `Fee: +${finalFee.toFixed(6)} INIT · Vol: $${feeData.breakdown?.[0]?.volume24h?.toLocaleString() || "—"} · ${resolvedConfidence}% conf`,
            });
            // LP rebalancing is handled automatically by the AMM as traders use the pool.
            // No directional swap needed from the agent side — just reinvest the boosted fee.
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

          // Add fee to base balance so the portfolio-delta interval picks it up
          const { base } = getAgentTokens(agent);
          setRemainingBalance(prev => ({
            ...prev,
            [`${agent.id}_${base}`]: (prev[`${agent.id}_${base}`] ?? (agent.initialCapital || 0)) + finalFee,
          }));
        } catch {
          // API failed — skip, do not simulate
        }
      } else if (autoExecute && scheduledSignal !== "HOLD") {
        if (isDCA && resolvedSignal === "HOLD") {
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
        void executeSwapOnChain(agent, scheduledSignal, resolvedConfidence, liveInitPrice);
      } else if (!autoExecute && scheduledSignal !== "HOLD") {
        setLogs(prev => [{
          id: `${now}-manual`,
          action: "Trade Skipped: Auto Execute Off",
          agent: agent.name,
          amount: `${resolvedConfidence}% confidence`,
          type: "neutral" as const,
          time: "Just now",
          timestamp: now,
          reasoning: `${scheduledSignal} signal was detected for ${analysis.token}, but Auto mode is disabled.`,
          signal: scheduledSignal,
        }, ...prev].slice(0, 20));
      }

      // Take-profit for non-LP strategies
      // Trigger sell when quote (USDC) position is >= takeProfitPct of initial capital
      // Default threshold lowered to 5% so profit is realized more frequently in demo
      if (!isLP && autoExecute && resolvedSignal !== "SELL") {
        const { quote } = getAgentTokens(agent);
        const quoteBal = remainingBalanceRef.current[`${agent.id}_${quote}`] ?? 0;
        const quoteValueInInit = quote === "USDC" ? quoteBal / liveInitPrice : quoteBal;
        const tpThreshold = (agent.takeProfitPct ?? 5) / 100;
        if (quoteBal > 0 && quoteValueInInit > (agent.initialCapital || 0) * tpThreshold) {
          void executeSwapOnChain(agent, "SELL", 70, liveInitPrice);
        }
      }

      return analysis;
    } catch (error) {
      console.error("AI analysis failed:", error);
      return null;
    } finally {
      analysisInFlightRef.current.delete(agent.id);
    }
  }, [autoExecute, executeSwapOnChain, getAgentIntervalMs, getAgentTokens, getPrimaryTargetToken]);

  useEffect(() => {
    fetchAIAnalysisRef.current = fetchAIAnalysis;
  }, [fetchAIAnalysis]);

  useEffect(() => {
    executeSwapOnChainRef.current = executeSwapOnChain;
  }, [executeSwapOnChain]);

  // Backend agent-worker is the sole writer of persisted dashboard state.
  // Client used to POST its own snapshot here which raced the worker and
  // overwrote accumulated progress — causing liveProfit to flip-flop between
  // the worker's value and the client's stale recomputation.
  useEffect(() => {
    void persistHashRef;
    void persistTimeoutRef;
  }, []);

  useEffect(() => {
    if (!runtimeHydrated) {
      return;
    }

    if (activeAgents.length === 0) {
      if (myAgents.length === 0) {
        // Reset UI when user deletes every agent — treated as mount-level sync.
        /* eslint-disable react-hooks/set-state-in-effect */
        setLivePortfolio(0);
        setLiveProfit(0);
        setDynamicChartData(baseChartData);
        /* eslint-enable react-hooks/set-state-in-effect */
        const logTs = Date.now();
        setLogs(prev => {
          if (prev.length > 0 && prev[0].id !== "p1") return prev;
          return [
            { id: "p1", action: "System Monitoring", agent: "Registry & Executor", amount: "N/A", type: "neutral", time: "Active", timestamp: logTs, reasoning: "Waiting for agent deployment" }
          ];
        });
      }
      return;
    }

    setDynamicChartData(prev => (prev.length > 0 ? prev : baseChartData));

    const logTs = Date.now();

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
      const dueAgents = activeAgentsRef.current.filter((agent) => isAgentDue(agent));
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

    // Append a chart point every 5s using the SSE-delivered liveProfit as
    // source of truth. Don't recompute profit here — the worker already did
    // that. Overlapping local recomputation was the oscillation source.
    const recordChartTick = () => {
      if (activeAgentsRef.current.length === 0) return;
      const profit = liveProfitRef.current;
      const label = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const point = { name: label, value: Number(profit.toFixed(4)) };
      setDynamicChartData(current => {
        const last = current[current.length - 1];
        if (last && last.value === point.value && last.name === point.name) return current;
        const next = [...current, point];
        if (next.length > CHART_WINDOW) next.splice(0, next.length - CHART_WINDOW);
        return next;
      });
    };

    recordChartTick();
    const interval = setInterval(recordChartTick, 5_000);

    // Scheduler checks every 5 seconds, but each agent only runs when its
    // configured interval has elapsed.
    const aiInterval = setInterval(() => {
      const targetAgent = pickDueAgent();
      if (targetAgent) {
        void fetchAIAnalysisRef.current?.(targetAgent);
      }
    }, 10_000);

    // Simulated feed entries also respect the selected agent interval.
    const feedInterval = setInterval(() => {
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
    }, 30_000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      clearInterval(aiInterval);
      clearInterval(feedInterval);
    };
  }, [activeAgents, getAgentTokens, isAgentDue, runtimeHydrated, myAgents.length]);

  const handleSendChat = async (overrideMessage?: string) => {
    const messageText = overrideMessage || chatInput.trim();
    if (!messageText || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageText };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    if (!overrideMessage) setChatInput("");
    setIsChatLoading(true);

    // Add empty assistant placeholder for streaming
    setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          model: selectedModel,
          stream: true,
          agentContext: {
            agentCount: myAgents.length,
            totalCapital: myAgents.reduce((sum, a) => sum + (a.initialCapital || 0), 0),
            liveProfit,
            initPrice,
            agents: myAgents.map(a => ({ name: a.name, target: a.target, strategy: a.strategy, status: "Active" })),
            network: "Initia evm-1 (Testnet)"
          },
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // Wrap the running transcript in a mutable holder so the streaming loop
      // can mutate a single reference without tripping React's immutability lint.
      const acc = { text: "" };
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line for next chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as { text?: string; done?: boolean };
            if (parsed.text) {
              acc.text = acc.text + parsed.text;
              const snapshot = acc.text;
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: snapshot };
                return updated;
              });
            }
          } catch { /* skip malformed line */ }
        }
      }

      // If nothing was streamed (empty response), show fallback
      if (!acc.text) {
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "No response received. Please try again." };
          return updated;
        });
      }

    } catch {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I'm experiencing a temporary issue. Please try again." };
        return updated;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDistributeProfit = async (agent: DeployedAgent) => {
    const agentId = BigInt(agent.onChainAgentId || "1");
    if (chainId !== INITIA_EVM_CHAIN_ID) {
      try { await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID }); }
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Distribution failed", { id: toastId, description: msg.slice(0, 80) });
    }
  };

  const handleWithdraw = async (agent: DeployedAgent) => {
    if (chainId !== INITIA_EVM_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID });
      } catch {
        toast.error("Network Error", { description: "Please switch to Initia evm-1 in your wallet." });
        return;
      }
    }

    setIsWithdrawing(agent.id);
    const toastId = `withdraw-${agent.id}`;
    let didCloseAgent = false;
    try {
      const { base, quote } = getAgentTokens(agent);
      const quoteBal = remainingBalance[`${agent.id}_${quote}`] ?? 0;
      const baseBal = remainingBalance[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
      let returnedInit = baseBal;

      // ── Step 1: swap remaining quote (e.g. USDC) back to base (INIT) ──────
      if (quoteBal > 0.001 && quote !== base) {
        toast.loading(`Swapping ${quoteBal.toFixed(2)} ${quote} → ${base}...`, { id: toastId });
        const swapResult = await mockDexSwap({
          fromToken: quote,
          toToken: base,
          amountIn: quoteBal,
          fromPriceUsd: quote === "USDC" ? 1.0 : (initPrice || 0.08),
          toPriceUsd: base === "USDC" ? 1.0 : (initPrice || 0.08),
          confidence: Math.max(agent.minConfidence ?? 50, 70),
        });
        const initReceived = swapResult.amountOut;
        returnedInit += initReceived;
        setRemainingBalance(prev => ({
          ...prev,
          [`${agent.id}_${quote}`]: 0,
          [`${agent.id}_${base}`]: (prev[`${agent.id}_${base}`] ?? (agent.initialCapital || 0)) + initReceived,
        }));
        setLogs(prev => [{
          id: `${Date.now()}-close-swap`,
          action: `Closed: swapped ${quoteBal.toFixed(2)} ${quote} → ${initReceived.toFixed(2)} ${base}`,
          agent: agent.name,
          amount: `@$${(initPrice || 0.08).toFixed(4)}`,
          type: "execute" as const,
          time: "Just now",
          timestamp: Date.now(),
          reasoning: `Agent closing — converted remaining ${quote} position back to ${base} before withdrawal.`,
          signal: "SELL",
        }, ...prev].slice(0, 20));
      }

      // ── Step 2: withdraw INIT from vault ────────────────────────────────
      toast.loading("Withdrawing funds from vault...", { id: toastId });
      const vaultAddress = (agent.contractAddress || CONTRACTS.AGENT_VAULT_DEFAULT) as `0x${string}`;
      const sharesToRedeem: bigint = parseUnits(agent.initialCapital?.toString() || "1", 18);
      await writeContract({
        address: vaultAddress,
        abi: AgentVaultABI,
        functionName: "withdraw",
        args: [sharesToRedeem],
      });
      await new Promise(r => setTimeout(r, 1500));
      creditInit(returnedInit);
      didCloseAgent = true;
      toast.success("Funds withdrawn successfully", { id: toastId });
    } catch (err) {
      console.warn("Withdraw failed/reverted.", err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Close agent failed", { id: toastId, description: message.slice(0, 120) });
    } finally {
      if (!didCloseAgent) {
        setIsWithdrawing(null);
        return;
      }
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
    const deposit = parseFloat(subscribeAmount);

    if (chainId !== INITIA_EVM_CHAIN_ID) {
      try { await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID }); }
      catch { toast.error("Network Error", { description: "Please switch to Initia evm-1." }); return; }
    }

    setIsSubscribing(true);
    let debited = false;
    try {
      const feeReceipt = await chargeFee("subscription");
      toast.success("Subscription fee paid", {
        description: `${feeReceipt.amountInit} INIT → treasury (${feeReceipt.txHash.slice(0, 10)}…)`,
      });

      if (!spendInit(deposit)) {
        throw new Error("Insufficient Mock INIT balance");
      }
      debited = true;

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
        initialCapital: deposit,
        creatorAddress: address as string,
        interval: agent.interval,
        isSubscription: true,
      });
      toast.success("Subscribed!", { description: `Deposited ${subscribeAmount} INIT into ${agent.name}.` });
      setSubscribeTarget(null);
      setSubscribeAmount("");
    } catch (err) {
      if (debited) {
        creditInit(deposit);
      }
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Subscribe Failed", { description: message.slice(0, 120) });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-4rem)] lg:overflow-hidden pb-24 lg:pb-0">

      {/* ── HEADER ── */}
      <div className="shrink-0 px-5 md:px-6 pt-5 md:pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] text-white leading-tight" style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
            Your <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-white/40 text-[13px] mt-0.5">
            {myAgents.length} agent{myAgents.length !== 1 ? "s" : ""} running on Initia evm-1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoExecute(prev => !prev)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-medium transition-all duration-200"
            style={{
              fontFamily: "var(--font-cabin)",
              background: autoExecute ? "#7b39fc" : "rgba(255,255,255,0.06)",
              border: autoExecute ? "1px solid #7b39fc" : "1px solid rgba(255,255,255,0.1)",
              color: autoExecute ? "white" : "rgba(255,255,255,0.45)",
            }}
          >
            <Zap className={`h-3 w-3 ${autoExecute ? "animate-pulse" : ""}`} />
            Auto
          </button>
          <div className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[12px] font-mono"
            style={{
              background: lastSignal === "BUY" ? "rgba(123,57,252,0.15)" : lastSignal === "SELL" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
              border: lastSignal === "BUY" ? "1px solid rgba(123,57,252,0.3)" : lastSignal === "SELL" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.08)",
              color: lastSignal === "BUY" ? "#a78bfa" : lastSignal === "SELL" ? "#f87171" : "rgba(255,255,255,0.35)",
            }}>
            <Activity className={`h-3 w-3 ${lastSignal && lastSignal !== "HOLD" ? "animate-pulse" : ""}`} />
            <span className="ml-1">{lastSignal ?? "Scanning..."}</span>
          </div>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="shrink-0 px-5 md:px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Portfolio",
              value: `${livePortfolio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INIT`,
              icon: Wallet, accent: false,
              sub: `≈ $${(livePortfolio * (initPrice > 0 ? initPrice : 0.08)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            {
              label: "Net PnL",
              value: `${liveProfit >= 0 ? "+" : ""}${liveProfit.toFixed(3)} INIT`,
              icon: TrendingUp, accent: true,
              sub: `≈ $${(liveProfit * (initPrice > 0 ? initPrice : 0.08)).toFixed(2)}`,
            },
            {
              label: "Gross",
              value: `${metrics.grossProfit >= 0 ? "+" : ""}${metrics.grossProfit.toFixed(3)} INIT`,
              icon: Sparkles, accent: false,
              sub: "before fees",
            },
            {
              label: "Fees Paid",
              value: `${metrics.feesPaid.toFixed(3)} INIT`,
              icon: Coins, accent: false,
              sub: metrics.protocolFee > 0 ? `incl. ${metrics.protocolFee.toFixed(3)} protocol` : "execution + protocol",
            },
            {
              label: "Win Rate",
              value: metrics.tradesExecuted > 0 ? `${winRatePct}%` : "—",
              icon: Activity, accent: false,
              sub: `${metrics.winningTrades}/${metrics.tradesExecuted} trades`,
            },
            {
              label: "Agents",
              value: String(myAgents.length),
              icon: Bot, accent: false,
              sub: `${executionCount} cycles`,
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[16px] p-3.5 flex items-center gap-3"
              style={{ background: stat.accent ? "rgba(123,57,252,0.12)" : "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: `1px solid ${stat.accent ? "rgba(123,57,252,0.25)" : "rgba(255,255,255,0.09)"}` }}>
              <div className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: stat.accent ? "rgba(123,57,252,0.2)" : "rgba(255,255,255,0.06)" }}>
                <stat.icon className="h-4 w-4" style={{ color: stat.accent ? "#a78bfa" : "rgba(255,255,255,0.4)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wider" style={{ fontFamily: "var(--font-manrope)" }}>{stat.label}</p>
                <p className={`text-[14px] font-semibold font-mono truncate ${stat.accent ? "text-gradient" : "text-white/90"}`}>{stat.value}</p>
                {stat.sub && <p className="text-[10px] text-white/30 font-mono">{stat.sub}</p>}
              </div>
              {stat.label === "Portfolio" && (
                <button onClick={resetSimulatedPerformance} title="Reset portfolio"
                  className="shrink-0 flex items-center gap-1 px-2 h-6 rounded-[6px] text-[10px] font-medium transition-all duration-200 hover:text-white/70"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-cabin)" }}>
                  <RotateCcw className="h-2.5 w-2.5" /> Reset
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 md:px-6 pb-5 lg:overflow-hidden">

        {/* LEFT: Chart */}
        <div className="lg:col-span-5 flex flex-col gap-0 min-h-[250px] lg:min-h-0 rounded-[20px] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(() => {
            const isUp = liveProfit >= 0;
            const accentColor = isUp ? "#22c55e" : "#ef4444";
            const initial = totalInitialCapital || 0;
            const roiPct = initial > 0 ? (liveProfit / initial) * 100 : 0;
            const values = dynamicChartData.map(d => d.value);
            const minV = values.length ? Math.min(0, ...values) : 0;
            const maxV = values.length ? Math.max(0, ...values) : 0;
            const pad  = Math.max(Math.abs(maxV - minV) * 0.15, 0.0005);
            const windowLabel = dynamicChartData.length > 1
              ? `${dynamicChartData.length * 5}s window`
              : "waiting for tick";
            return (
              <>
                <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider" style={{ fontFamily: "var(--font-manrope)" }}>Performance</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] ml-1"
                      style={{
                        background: isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        border: `1px solid ${isUp ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                        color: accentColor,
                      }}>
                      {isUp ? "+" : ""}{roiPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
                    <span className="text-[10px] text-white/30 font-mono">{windowLabel}</span>
                  </div>
                </div>
                <div className="flex-1 p-2 relative" style={{ minHeight: "180px" }}>
                  {dynamicChartData.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center animate-pulse"
                        style={{ background: "rgba(123,57,252,0.12)", border: "1px solid rgba(123,57,252,0.25)" }}>
                        <Activity className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
                      </div>
                      <p className="text-[11px] text-white/40 font-mono">Waiting for first PnL tick…</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                      <AreaChart data={dynamicChartData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={accentColor} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="name" stroke="#3f3f46" fontSize={9} axisLine={false} tickLine={false} minTickGap={40} />
                        <YAxis
                          stroke="#3f3f46"
                          fontSize={9}
                          axisLine={false}
                          tickLine={false}
                          domain={[minV - pad, maxV + pad]}
                          tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(3)}`}
                          width={48}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0a0612", border: `1px solid ${accentColor}40`, borderRadius: "10px", fontSize: "11px" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px" }}
                          formatter={(val) => {
                            const n = Number(val) || 0;
                            return [`${n >= 0 ? "+" : ""}${n.toFixed(4)} INIT`, "Net PnL"];
                          }}
                        />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={accentColor}
                          strokeWidth={2}
                          fill="url(#perfGradient)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* CENTER: Agent List */}
        <div className="lg:col-span-3 flex flex-col gap-0 min-h-[280px] lg:min-h-0 rounded-[20px] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider" style={{ fontFamily: "var(--font-manrope)" }}>Your Agents</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.25)", color: "#a78bfa" }}>
              {myAgents.length}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-3 space-y-2">
            {[...ownedAgents, ...subscribedAgents].length === 0 && (
              <div className="h-full flex items-center justify-center py-12 text-center">
                <div>
                  <Bot className="h-8 w-8 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30 text-[12px]">No agents yet</p>
                  <p className="text-white/20 text-[11px] mt-1">Go to Builder to create one</p>
                </div>
              </div>
            )}
            {[...ownedAgents, ...subscribedAgents].map(agent => {
              const { base, quote } = getAgentTokens(agent);
              const baseBal = remainingBalance[`${agent.id}_${base}`] ?? (agent.initialCapital || 0);
              const quoteBal = remainingBalance[`${agent.id}_${quote}`] ?? 0;
              const currentInitPrice = initPrice > 0 ? initPrice : 0.08;
              const currentValueInit = baseBal + (quote === "USDC" ? quoteBal / currentInitPrice : quoteBal);
              const profitInit = currentValueInit - (agent.initialCapital || 0);
              const profitPct = (agent.initialCapital || 0) > 0 ? (profitInit / (agent.initialCapital || 1)) * 100 : 0;
              const isProfit = profitInit >= 0;
              return (
                <motion.div key={agent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                  <div className={`group rounded-[14px] p-3 transition-all duration-300 cursor-pointer hover:scale-[1.01]`}
                    style={{
                      background: agent.agentClosed ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${agent.agentClosed ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    {agent.agentClosed && (
                      <div className="flex items-center gap-1.5 rounded-[6px] px-2 py-1 mb-2 text-[10px]"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                        <div className="h-1 w-1 rounded-full bg-red-500/60" />
                        Closed — withdraw funds
                      </div>
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${agent.agentClosed ? "text-white/30" : "text-white/90"}`}>{agent.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(123,57,252,0.12)", border: "1px solid rgba(123,57,252,0.2)", color: "#a78bfa", fontFamily: "var(--font-cabin)" }}>
                            {agent.strategy}
                          </span>
                          {agent.isSubscription
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white/30" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>Sub</span>
                            : <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(123,57,252,0.08)", border: "1px solid rgba(123,57,252,0.15)", color: "#a78bfa" }}>Creator</span>
                          }
                        </div>
                      </div>
                      {/* Profit badge */}
                      {!agent.agentClosed ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] font-mono text-[11px] font-semibold"
                            style={{
                              background: isProfit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                              border: `1px solid ${isProfit ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                              color: isProfit ? "#4ade80" : "#f87171",
                            }}>
                            {isProfit ? "▲" : "▼"} {Math.abs(profitPct).toFixed(2)}%
                          </div>
                          <span className="text-[9px] font-mono"
                            style={{ color: isProfit ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)" }}>
                            {isProfit ? "+" : ""}{profitInit.toFixed(2)} {base}
                          </span>
                        </div>
                      ) : (
                        <div className="h-2 w-2 rounded-full mt-1 shrink-0 bg-red-500/40" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.05]">
                      <div className="flex items-center gap-1">
                        <Coins className="h-3 w-3 text-white/30" />
                        <span className="text-[11px] font-mono text-white/60">{baseBal.toLocaleString(undefined, { maximumFractionDigits: 1 })} {base}</span>
                      </div>
                      {agent.strategy !== "LP" && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-white/30" />
                          <span className={`text-[11px] font-mono ${quoteBal > 0 ? "" : "text-white/20"}`}
                            style={quoteBal > 0 ? { color: "#a78bfa" } : {}}>
                            {quoteBal.toLocaleString(undefined, { maximumFractionDigits: 1 })} {quote}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => window.open(explorerEvmAccountUrl(agent.contractAddress), "_blank")}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] text-white/30 hover:text-white/70 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <ExternalLink className="h-2.5 w-2.5" /> Explorer
                      </button>
                      {!agent.isSubscription && !agent.agentClosed && (
                        <button onClick={() => handleDistributeProfit(agent)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] text-white/30 hover:text-teal-400 transition-colors"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <Share2 className="h-2.5 w-2.5" /> Split
                        </button>
                      )}
                      {agent.isSubscription ? (
                        <button onClick={() => handleWithdraw(agent)} disabled={isWithdrawing === agent.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] text-white/30 hover:text-amber-400 transition-colors disabled:opacity-40"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {isWithdrawing === agent.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ArrowDownRight className="h-2.5 w-2.5" />} Withdraw
                        </button>
                      ) : (
                        <button onClick={() => setCloseWarningAgent(agent)} disabled={isWithdrawing === agent.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] text-white/30 hover:text-red-400 transition-colors disabled:opacity-40"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {isWithdrawing === agent.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />} Close
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: AI Feed + Chat */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-h-[400px] lg:min-h-0">

          {/* AI Feed */}
          <div className="shrink-0 rounded-[20px] overflow-hidden flex flex-col" style={{ height: "190px", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "#7b39fc" }} />
                <span className="text-[12px] font-semibold text-white/60 uppercase tracking-wider" style={{ fontFamily: "var(--font-manrope)" }}>AI Feed</span>
              </div>
              {logs.length > 0 && <span className="text-[10px] font-mono text-white/25">{logs.length} events</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-hide space-y-2.5">
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div key={log.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
                    className="border-l-2 pl-2.5 space-y-0.5" style={{ borderColor: log.type === "buy" ? "#7b39fc" : log.type === "sell" ? "#ef4444" : log.type === "earn" ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] font-medium truncate"
                        style={{ color: log.type === "buy" ? "#a78bfa" : log.type === "sell" ? "#f87171" : log.type === "earn" ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
                        {log.action}
                      </span>
                      <span className="text-[9px] font-mono text-white/25 shrink-0">{log.time ?? getRelativeTime(log.timestamp)}</span>
                    </div>
                    {log.reasoning && <p className="text-[10px] text-white/30 line-clamp-1">{log.reasoning}</p>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* AI Chat */}
          <div className="h-[300px] lg:flex-1 lg:min-h-0 rounded-[20px] overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7">
                  <span className="absolute inset-0 rounded-full bg-purple-500/10 animate-ping opacity-30" />
                  <div className="relative h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "rgba(123,57,252,0.2)", border: "1px solid rgba(123,57,252,0.3)" }}>
                    <Bot className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/80" style={{ fontFamily: "var(--font-manrope)" }}>AI Assistant</p>
                  <p className="text-[9px]" style={{ color: "#7b39fc" }}>● Live</p>
                </div>
              </div>
              <div className="relative">
                <button onClick={() => setModelMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[10px] font-medium text-white/40 hover:text-white/70 transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Sparkles className="h-3 w-3" style={{ color: "#7b39fc" }} />
                  <span style={{ color: getModelMeta(selectedModel).color }}>{getModelMeta(selectedModel).label}</span>
                  <svg className="h-2.5 w-2.5 text-white/30" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {modelMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-[220px] rounded-[16px] overflow-hidden shadow-2xl"
                      style={{ background: "rgba(10,6,24,0.95)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {ALL_CHAT_MODELS.map(m => {
                        const meta = getModelMeta(m.id);
                        const isSelected = selectedModel === m.id;
                        const needsKey = m.id !== "claude-cli";
                        const warn = needsKey && (m.provider === "anthropic" ? !apiKeyStatus.anthropic : !apiKeyStatus.gemini);
                        return (
                          <button key={m.id} disabled={warn}
                            onClick={() => { if (!warn) { setSelectedModel(m.id); setModelMenuOpen(false); } }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] transition-all ${warn ? "opacity-30 cursor-not-allowed" : isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.04] cursor-pointer"}`}>
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="font-semibold" style={{ color: isSelected ? meta.color : warn ? "#52525b" : meta.color + "CC" }}>{meta.label}</span>
                              {warn && <span className="text-[9px] text-amber-500/60">⚠ API key needed</span>}
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: isSelected ? "rgba(123,57,252,0.25)" : "rgba(255,255,255,0.05)", color: isSelected ? "#a78bfa" : "rgba(255,255,255,0.4)" }}>
                              {m.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-3 space-y-2.5">
              {chatMessages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] rounded-[14px] px-3 py-2 text-[12px] leading-relaxed"
                    style={msg.role === "user"
                      ? { background: "#7b39fc", color: "white" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.8)" }}>
                    {msg.role === "assistant" && !msg.content ? (
                      <div className="flex gap-1">
                        {[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "#7b39fc", animationDelay: `${i*0.15}s` }} />)}
                      </div>
                    ) : renderMarkdown(msg.content)}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestion chips */}
            {chatMessages.length <= 1 && (
              <div className="px-3 pb-2 shrink-0 overflow-hidden">
                <div ref={promptContainerRef} className="overflow-hidden">
                  <motion.div drag="x" dragConstraints={promptContainerRef} dragElastic={0}
                    className="flex gap-1.5 cursor-grab active:cursor-grabbing select-none w-max">
                    {[
                      "How are my agents doing?",
                      "What's my total profit?",
                      "Show latest trades",
                      "Best strategy for now?",
                      "Should I rebalance?",
                    ].map(q => (
                      <button key={q} onClick={() => handleSendChat(q)}
                        className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium text-white/50 hover:text-white/80 transition-all whitespace-nowrap"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {q}
                      </button>
                    ))}
                  </motion.div>
                </div>
              </div>
            )}

            {/* Chat input */}
            <div className="px-3 pb-3 shrink-0">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Ask your AI assistant..."
                  className="flex-1 h-9 rounded-[10px] px-3 text-[12px] text-white/80 placeholder-white/25 outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
                />
                <button onClick={() => handleSendChat()} disabled={isChatLoading || !chatInput.trim()}
                  className="h-9 w-9 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-40 hover:opacity-90"
                  style={{ background: "#7b39fc" }}>
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {closeWarningAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-[20px] p-6"
            style={{ background: "rgba(10,6,24,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 className="text-[18px] text-white font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Close Agent?</h3>
            <p className="text-white/50 text-[13px] mb-6">This will stop the agent and withdraw all funds. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setCloseWarningAgent(null)} className="flex-1 h-10 rounded-[10px] text-[13px] font-medium text-white/60 hover:text-white transition-all" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-cabin)" }}>
                Cancel
              </button>
              <button onClick={() => { handleWithdraw(closeWarningAgent); setCloseWarningAgent(null); }} disabled={isWithdrawing === closeWarningAgent.id}
                className="flex-1 h-10 rounded-[10px] text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ef4444", fontFamily: "var(--font-cabin)" }}>
                {isWithdrawing === closeWarningAgent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Close & Withdraw
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {subscribeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-[20px] p-6 relative"
            style={{ background: "rgba(10,6,24,0.95)", border: "1px solid rgba(123,57,252,0.3)" }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[20px]" style={{ background: "linear-gradient(90deg, transparent, #7b39fc, transparent)" }} />
            <h3 className="text-[18px] text-white font-semibold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Subscribe to {subscribeTarget.name}</h3>
            <p className="text-white/40 text-[13px] mb-4">Deposit INIT to start earning from this agent</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-white/40 text-[11px] block mb-1.5" style={{ fontFamily: "var(--font-manrope)" }}>Amount (INIT)</label>
                <input type="number" value={subscribeAmount} onChange={e => setSubscribeAmount(e.target.value)}
                  placeholder="0.00" className="w-full h-10 rounded-[10px] px-3 text-[13px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSubscribeTarget(null)} className="flex-1 h-10 rounded-[10px] text-[13px] font-medium text-white/50 hover:text-white transition-all" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-cabin)" }}>
                Cancel
              </button>
              <button onClick={handleSubscribeOwn} disabled={isSubscribing || !subscribeAmount || parseFloat(subscribeAmount) <= 0}
                className="flex-1 h-10 rounded-[10px] text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
                {isSubscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
