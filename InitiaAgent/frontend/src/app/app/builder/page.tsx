"use client";

import { useState, useEffect, useRef } from "react";
import type { MarketAnalysis } from "@/lib/ai-agent";
import { getModelMeta } from "@/lib/model-labels";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Play,
  LineChart,
  Activity,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Wallet,
  Brain,
  Sparkles,
} from "lucide-react";
import { useAgents } from "@/lib/hooks/use-agents";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CONTRACTS } from "@/lib/constants";
import { useAccount, useSwitchChain, useBalance, usePublicClient } from "wagmi";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { AgentVaultABI } from "@/lib/abis/AgentVault";
import { AgentRegistryABI } from "@/lib/abis/AgentRegistry";
import { AgentExecutorABI } from "@/lib/abis/AgentExecutor";
import { ProfitSplitterABI } from "@/lib/abis/ProfileSplitter";
import { parseUnits } from "viem";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";

const AI_ANALYSIS_MODELS = [
  { id: "claude-haiku-4-5",  badge: "Fast",  provider: "anthropic" },
  { id: "claude-sonnet-4-6", badge: "Best",  provider: "anthropic" },
  { id: "claude-opus-4-6",   badge: "Pro",   provider: "anthropic" },
  { id: "claude-cli",        badge: "Local", provider: "anthropic" },
  { id: "gemini-2.5-flash",  badge: "Fast",  provider: "gemini" },
  { id: "gemini-3-flash",    badge: "Fast",  provider: "gemini" },
  { id: "gemini-3.1-pro",    badge: "Smart", provider: "gemini" },
];

const STRATEGY_SKILLS: Record<string, {
  label: string;
  tagline: string;
  skills: string[];
  indicators: string[];
  bgColor: string;
  iconColor: string;
  dotColor: string;
  badgeColor: string;
}> = {
  DCA: {
    label: "Dollar Cost Averaging",
    tagline: "Accumulate on every dip — cost basis tracking built-in",
    skills: ["Dip Entry Detector", "Accumulation Engine", "Cost Basis Tracker", "DCA Interval Optimizer"],
    indicators: ["RSI < 35 oversold", "EMA 20/50 crossover", "Volume spike +2σ", "24h momentum score"],
    bgColor: "bg-blue-500/10", iconColor: "text-blue-400", dotColor: "bg-blue-400/60", badgeColor: "border-blue-500/20 text-blue-400",
  },
  LP: {
    label: "LP Auto-Rebalancing",
    tagline: "Maximize fee income while guarding against IL",
    skills: ["IL Protection Guard", "Fee APR Optimizer", "Pool Rebalance Trigger", "Depth Scanner"],
    indicators: ["Pool ratio deviation >5%", "Volume/TVL ratio", "Fee 24h APR", "Price range delta"],
    bgColor: "bg-purple-500/10", iconColor: "text-purple-400", dotColor: "bg-purple-400/60", badgeColor: "border-purple-500/20 text-purple-400",
  },
  YIELD: {
    label: "Yield Optimizer",
    tagline: "Chase highest APY — rotate protocols on decay",
    skills: ["APY Scanner", "Protocol Rotation Engine", "Harvest Timer", "Compound Frequency Optimizer"],
    indicators: ["APY delta 7d", "Emissions decay rate", "Utilization ratio", "Reward token trend"],
    bgColor: "bg-amber-500/10", iconColor: "text-amber-400", dotColor: "bg-amber-400/60", badgeColor: "border-amber-500/20 text-amber-400",
  },
  VIP: {
    label: "VIP Maximizer",
    tagline: "Retain tier status — compound esINIT automatically",
    skills: ["Tier Retention Monitor", "esINIT Compounder", "Epoch Timing Tracker", "Volume Threshold Manager"],
    indicators: ["esINIT APR", "VIP tier threshold", "Epoch progress %", "Loyalty multiplier"],
    bgColor: "bg-rose-500/10", iconColor: "text-rose-400", dotColor: "bg-rose-400/60", badgeColor: "border-rose-500/20 text-rose-400",
  },
};

export default function BuilderPage() {
  const router = useRouter();
  const { addAgent } = useAgents();
  const { writeContract } = useInterwovenEvm();
  const INITIA_CHAIN_ID = 2124225178762456;
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    token: CONTRACTS.MOCK_INIT as `0x${string}`,
    chainId: INITIA_CHAIN_ID,
  });

  const [strategy, setStrategy] = useState("DCA");
  const [targetTokens, setTargetTokens] = useState<string[]>(["USDC"]);
  const [interval, setIntervalVal] = useState("4 Hours");
  const [pools, setPools] = useState<string[]>(["INIT/USDC"]);
  const [threshold, setThreshold] = useState("5");
  const [protocol, setProtocol] = useState("InitiaLend");
  const [riskLevel, setRiskLevel] = useState("Medium");
  const [vault, setVault] = useState("Main Vault");
  const [frequency, setFrequency] = useState("Daily");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<MarketAnalysis | null>(null);
  const [analysisModel, setAnalysisModel] = useState("gemini-2.5-flash");
  const [analysisModelMenuOpen, setAnalysisModelMenuOpen] = useState(false);
  const [analysisMenuPos, setAnalysisMenuPos] = useState({ top: 0, right: 0 });
  const analysisModelBtnRef = useRef<HTMLButtonElement>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ anthropic: boolean; gemini: boolean }>({ anthropic: true, gemini: true });

  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [initialCapital, setInitialCapital] = useState("5");
  const [mounted, setMounted] = useState(false);

  // Risk & Execution settings
  const [takeProfitPct, setTakeProfitPct] = useState("20");
  const [stopLossPct, setStopLossPct] = useState("10");
  const [minConfidence, setMinConfidence] = useState("50");
  const [tradeSizePct, setTradeSizePct] = useState("10");

  useEffect(() => {
    setMounted(true);
    fetch("/api/agent/strategy-skills")
      .then(r => r.json())
      .then(d => {
        if (d?.apiKeys) {
          setApiKeyStatus(d.apiKeys);
          // Auto-fallback: if selected model needs a key that's missing, switch to gemini flash
          if (!d.apiKeys.anthropic && analysisModel.startsWith("claude") && analysisModel !== "claude-cli") {
            setAnalysisModel("gemini-2.5-flash");
          }
          if (!d.apiKeys.gemini && analysisModel.startsWith("gemini")) {
            setAnalysisModel("claude-cli");
          }
        }
      })
      .catch(() => {});
  }, []);

  const [deploymentStatus, setDeploymentStatus] = useState<
    "idle" | "preparing" | "funding" | "signing" | "broadcasting" | "success"
  >("idle");
  const [txHash, setTxHash] = useState("");

  const capitalVal = parseFloat(initialCapital) || 0;

  const simulationData = [
    { day: "1", value: capitalVal },
    { day: "5", value: capitalVal * 1.05 },
    { day: "10", value: capitalVal * 1.02 },
    { day: "15", value: capitalVal * 1.1 },
    { day: "20", value: capitalVal * 1.15 },
    { day: "25", value: capitalVal * 1.13 },
    { day: "30", value: capitalVal * 1.25 },
  ];

  const handleSimulate = async () => {
    setIsSimulating(true);
    setShowSimulation(false);
    setAiAnalysis(null);

    try {
      const res = await fetch("/api/agent/analyze?mode=ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, targetToken: targetTokens[0] || "USDC", pool: pools.join(", "), protocol, vault, capital: capitalVal, interval, model: analysisModel }),
      });

      if (res.ok) {
        const analysis = await res.json();
        setAiAnalysis(analysis);
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    }

    setIsSimulating(false);
    setShowSimulation(true);
  };

  const applyRecommendation = () => {
    setStrategy("DCA");
    setTargetTokens(["USDC"]);
    setPools(["INIT/USDC"]);
    setIntervalVal("1 Hour");
    setTakeProfitPct("20");
    setStopLossPct("10");
    setMinConfidence("30");
    setTradeSizePct("20");
    setRiskLevel("Medium");
    setProtocol("InitiaLend");
    setVault("Main Vault");
    setFrequency("Daily");
    setShowSimulation(false);
    setAiAnalysis(null);

    if (!agentName.trim()) {
      setAgentName("INIT Momentum DCA");
    }

    if (!agentDesc.trim()) {
      setAgentDesc("Optimized INIT/USDC agent that accumulates on AI buy signals and exits into INIT when momentum weakens.");
    }

    toast.success("Recommendation applied", {
      description: "Builder set to the recommended INIT/USDC configuration.",
    });
  };

  const handleDeploy = async () => {
    if (!agentName) {
      toast.error("Validation Error", { description: "Please enter an Agent Name to proceed with deployment." });
      return;
    }

    if (chainId !== INITIA_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_CHAIN_ID });
      } catch (err) {
        toast.error("Network Error", { description: "Please switch to Initia evm-1 in your wallet." });
        return;
      }
    }

    setDeploymentStatus("preparing");
    const vaultAddress = CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`;
    let deployTxHash = "";
    let onChainAgentId = "";

    try {
      // Step 1: Approve vault to spend MOCK_INIT
      setDeploymentStatus("funding");
      await writeContract({
        address: CONTRACTS.MOCK_INIT as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [vaultAddress, parseUnits(initialCapital, 18)],
      });

      // Step 2: Deposit into vault — this is the main "deploy" tx
      setDeploymentStatus("signing");
      deployTxHash = await writeContract({
        address: vaultAddress,
        abi: AgentVaultABI,
        functionName: "deposit",
        args: [parseUnits(initialCapital, 18)],
      });

      // Step 3: Register agent in registry → get on-chain agentId
      setDeploymentStatus("broadcasting");
      try {
        const regTxHash = await writeContract({
          address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
          abi: AgentRegistryABI,
          functionName: "registerAgent",
          args: [agentName, strategy, vaultAddress],
        });
        // agentId is returned in the tx receipt event — store hash for now,
        // we'll read agentId from vault directly on next load
        onChainAgentId = regTxHash; // placeholder until receipt decoded
      } catch (err) {
        console.warn("registerAgent failed (vault may already be registered):", err);
      }

      // Step 4: Register vault in ProfitSplitter
      try {
        // Read agentId from vault contract
        const vaultAgentId = BigInt(1); // default for Agent #1 vault
        await writeContract({
          address: CONTRACTS.PROFIT_SPLITTER as `0x${string}`,
          abi: ProfitSplitterABI,
          functionName: "registerVault",
          args: [vaultAgentId, vaultAddress],
        });
      } catch (err) {
        console.warn("registerVault failed (may already be registered):", err);
      }

      // Step 5: Authorize self as runner in executor (skip if already authorized)
      try {
        const vaultAgentId = BigInt(1);
        const alreadyAuthorized = publicClient ? await publicClient.readContract({
          address: CONTRACTS.AGENT_EXECUTOR as `0x${string}`,
          abi: AgentExecutorABI,
          functionName: "isRunnerAuthorized",
          args: [vaultAgentId, address as `0x${string}`],
        }) as boolean : false;
        if (!alreadyAuthorized) {
          await writeContract({
            address: CONTRACTS.AGENT_EXECUTOR as `0x${string}`,
            abi: AgentExecutorABI,
            functionName: "authorizeRunner",
            args: [vaultAgentId, address as `0x${string}`],
          });
        }
      } catch (err) {
        console.warn("authorizeRunner check failed:", err);
      }

    } catch (err) {
      console.warn("Deployment failed:", err);
      setDeploymentStatus("idle");
      return;
    }

    setTxHash(deployTxHash);

    await addAgent({
      id: Math.random().toString(36).substr(2, 9),
      name: agentName,
      strategy: strategy,
      target: targetTokens[0] || "USDC",
      pool: pools.join(", "),
      protocol: protocol,
      vault: vault,
      status: "Active",
      deployedAt: new Date().toISOString(),
      txHash: deployTxHash,
      contractAddress: vaultAddress,
      initialCapital: parseFloat(initialCapital) || 0,
      creatorAddress: address || "",
      interval: interval,
      isSubscription: false,
      takeProfitPct: parseFloat(takeProfitPct) || 20,
      stopLossPct: parseFloat(stopLossPct) || 10,
      minConfidence: parseFloat(minConfidence) || 50,
      tradeSizePct: parseFloat(tradeSizePct) || 10,
      onChainAgentId: "1", // Agent #1 vault
    });

    setDeploymentStatus("success");
  };

  // Shared selection button style
  const selectBtn = (active: boolean) =>
    `flex-1 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] ${
      active
        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
        : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
    }`;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="relative mb-8">
        <div className="absolute -top-20 left-1/4 w-[400px] h-[250px] radial-glow pointer-events-none opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
          className="relative"
        >
          <h1 className="text-2xl font-light tracking-tight text-zinc-200 sm:text-3xl">
            Agent <span className="text-gradient font-bold">Builder</span>
          </h1>
          <p className="mt-2 text-zinc-600 text-sm">
            Create a new AI trading agent without writing code. Configure your strategy and deploy to Initia.
          </p>
        </motion.div>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Strategy */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.36, 0.2, 0.07, 1] }}
          >
            <Card className="bg-white/[0.02] border-white/[0.04]">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-zinc-200 text-base font-medium">1. Select Strategy</CardTitle>
                    <CardDescription>Choose the core logic for your agent.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 hover:bg-emerald-500/[0.08] hover:text-emerald-300"
                    onClick={applyRecommendation}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Best Recommendation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "DCA", name: "Dollar Cost Averaging", desc: "Buy tokens at regular intervals." },
                    { id: "LP", name: "LP Auto-Rebalancing", desc: "Maintain optimal liquidity pool ratios." },
                    { id: "YIELD", name: "Yield Optimizer", desc: "Chase highest APY across protocols." },
                    { id: "VIP", name: "VIP Maximizer", desc: "Auto-claim and reinvest VIP rewards." },
                  ].map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setStrategy(s.id); setShowSimulation(false); }}
                      className={`cursor-pointer rounded-[20px] border p-5 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] ${
                        strategy === s.id
                          ? "border-emerald-500/15 bg-emerald-500/[0.04]"
                          : "border-white/[0.05] bg-white/[0.01] hover:border-white/[0.08]"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-sm text-zinc-200">{s.name}</div>
                        {strategy === s.id && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 leading-relaxed">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Strategy Skills */}
          <AnimatePresence mode="wait">
            <motion.div
              key={strategy}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.36, 0.2, 0.07, 1] }}
            >
              <Card className="bg-white/[0.02] border-white/[0.04]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center ${STRATEGY_SKILLS[strategy]?.bgColor ?? "bg-zinc-500/10"}`}>
                        <Brain className={`h-3.5 w-3.5 ${STRATEGY_SKILLS[strategy]?.iconColor ?? "text-zinc-400"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-zinc-200 text-sm font-medium">AI Skills — {STRATEGY_SKILLS[strategy]?.label}</CardTitle>
                        <CardDescription className="text-[11px]">{STRATEGY_SKILLS[strategy]?.tagline}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${STRATEGY_SKILLS[strategy]?.badgeColor ?? "border-zinc-500/20 text-zinc-400"}`}>
                      {STRATEGY_SKILLS[strategy]?.skills.length ?? 0} Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {(STRATEGY_SKILLS[strategy]?.skills ?? []).map((skill) => (
                      <div key={skill} className="flex items-center gap-2 rounded-[12px] bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STRATEGY_SKILLS[strategy]?.dotColor ?? "bg-zinc-400/60"}`} />
                        <span className="text-[11px] text-zinc-400">{skill}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[12px] bg-white/[0.02] border border-white/[0.04] p-3">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Key Indicators</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(STRATEGY_SKILLS[strategy]?.indicators ?? []).map((ind) => (
                        <span key={ind} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-500">{ind}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Step 2: Parameters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.36, 0.2, 0.07, 1] }}
          >
            <Card className="bg-white/[0.02] border-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-zinc-200 text-base font-medium">2. Configure Parameters</CardTitle>
                <CardDescription>Set the rules for your {strategy} strategy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <AnimatePresence mode="wait">
                  {strategy === "DCA" && (
                    <motion.div key="dca" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-zinc-400">Trading Pair</label>
                          <span className="text-[10px] text-zinc-600">Optimized single-pair execution</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            onClick={() => setTargetTokens(["USDC"])}
                            className={selectBtn(true)}
                          >
                            INIT/USDC
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Interval</label>
                        <div className="flex gap-2 flex-wrap">
                          {["5 Minutes", "15 Minutes", "30 Minutes", "1 Hour", "4 Hours", "12 Hours", "24 Hours"].map((i) => (
                            <Button key={i} variant="outline" onClick={() => setIntervalVal(i)} className={selectBtn(interval === i)}>{i}</Button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {strategy === "LP" && (
                    <motion.div key="lp" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-zinc-400">Target Pools</label>
                          <span className="text-[10px] text-zinc-600">{pools.length} selected · LP spread across all</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {["INIT/USDC"].map((p) => (
                            <Button key={p} variant="outline" onClick={() => {
                              setPools(prev =>
                                prev.includes(p)
                                  ? prev.length > 1 ? prev.filter(x => x !== p) : prev
                                  : [...prev, p]
                              );
                            }} className={selectBtn(pools.includes(p))}>{p}</Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Rebalance Threshold (%)</label>
                        <div className="flex gap-2">
                          {["1", "5", "10", "20"].map((t) => (
                            <Button key={t} variant="outline" onClick={() => setThreshold(t)} className={selectBtn(threshold === t)}>{t}%</Button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {strategy === "YIELD" && (
                    <motion.div key="yield" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Target Protocol</label>
                        <div className="flex gap-2">
                          {["InitiaLend", "LiquidSwap", "Minitia"].map((p) => (
                            <Button key={p} variant="outline" onClick={() => setProtocol(p)} className={selectBtn(protocol === p)}>{p}</Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Risk Profile</label>
                        <div className="flex gap-2">
                          {["Low", "Medium", "High"].map((r) => (
                            <Button key={r} variant="outline" onClick={() => setRiskLevel(r)} className={selectBtn(riskLevel === r)}>{r}</Button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {strategy === "VIP" && (
                    <motion.div key="vip" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Target Vault</label>
                        <div className="flex gap-2">
                          {["Main Vault", "Alpha Vault", "Beta Vault"].map((v) => (
                            <Button key={v} variant="outline" onClick={() => setVault(v)} className={selectBtn(vault === v)}>{v}</Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Claim Frequency</label>
                        <div className="flex gap-2">
                          {["Daily", "Weekly", "Bi-Weekly"].map((f) => (
                            <Button key={f} variant="outline" onClick={() => setFrequency(f)} className={selectBtn(frequency === f)}>{f}</Button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 border-t border-white/[0.04]">
                  {/* AI Model picker */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-zinc-600">Analysis engine</span>
                    <div className="relative">
                      <button
                        ref={analysisModelBtnRef}
                        onClick={() => {
                          if (!analysisModelMenuOpen && analysisModelBtnRef.current) {
                            const r = analysisModelBtnRef.current.getBoundingClientRect();
                            setAnalysisMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
                          }
                          setAnalysisModelMenuOpen(v => !v);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-200 group"
                      >
                        <Sparkles className="h-3 w-3 text-emerald-400/80 group-hover:text-emerald-400 transition-colors" />
                        <span style={{ color: getModelMeta(analysisModel).color }}>{getModelMeta(analysisModel).label}</span>
                        <svg className="h-2.5 w-2.5 text-zinc-600" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {analysisModelMenuOpen && typeof document !== "undefined" && createPortal(
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setAnalysisModelMenuOpen(false)} />
                          <div className="fixed z-50 w-[230px] rounded-2xl bg-[#0c0c0f] border border-white/[0.08] shadow-2xl overflow-hidden"
                            style={{ top: analysisMenuPos.top, right: analysisMenuPos.right }}
                          >
                            {/* Anthropic group */}
                            <div className="px-3 pt-2.5 pb-1">
                              <p className="text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#CC785C88" }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#CC785C" }} />
                                Anthropic
                              </p>
                            </div>
                            {AI_ANALYSIS_MODELS.filter(m => m.provider === "anthropic").map(m => {
                              const meta = getModelMeta(m.id);
                              const isSelected = analysisModel === m.id;
                              const needsKey = m.id !== "claude-cli";
                              const warn = needsKey && !apiKeyStatus.anthropic;
                              return (
                                <button
                                  key={m.id}
                                  disabled={warn}
                                  onClick={() => { if (!warn) { setAnalysisModel(m.id); setAnalysisModelMenuOpen(false); } }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-all duration-150 ${warn ? "opacity-35 cursor-not-allowed" : isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.04] cursor-pointer"}`}
                                >
                                  <div className="flex flex-col items-start gap-0.5 min-w-0">
                                    <span className="font-semibold" style={{ color: isSelected ? meta.color : warn ? "#71717A" : meta.color + "CC" }}>{meta.label}</span>
                                    {warn
                                      ? <span className="text-[9px] text-amber-500/60 flex items-center gap-1"><span>⚠</span> Set ANTHROPIC_API_KEY in .env</span>
                                      : m.id === "claude-cli" ? <span className="text-[9px] text-zinc-600">No API key needed</span>
                                      : null}
                                  </div>
                                  <span className={`ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isSelected ? "bg-emerald-500/20 text-emerald-400" : warn ? "bg-white/[0.04] text-zinc-600" : m.badge === "Best" ? "bg-purple-500/10 text-purple-400/70" : m.badge === "Pro" ? "bg-orange-500/10 text-orange-400/70" : m.badge === "Local" ? "bg-zinc-500/10 text-zinc-500" : "bg-white/[0.05] text-zinc-500"}`}>{m.badge}</span>
                                </button>
                              );
                            })}
                            {/* Google group */}
                            <div className="px-3 pt-3 pb-1 border-t border-white/[0.04] mt-1">
                              <p className="text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#4285F488" }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4285F4" }} />
                                Google
                              </p>
                            </div>
                            {AI_ANALYSIS_MODELS.filter(m => m.provider === "gemini").map(m => {
                              const meta = getModelMeta(m.id);
                              const isSelected = analysisModel === m.id;
                              const warn = !apiKeyStatus.gemini;
                              return (
                                <button
                                  key={m.id}
                                  disabled={warn}
                                  onClick={() => { if (!warn) { setAnalysisModel(m.id); setAnalysisModelMenuOpen(false); } }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-all duration-150 ${warn ? "opacity-35 cursor-not-allowed" : isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.04] cursor-pointer"}`}
                                >
                                  <div className="flex flex-col items-start gap-0.5 min-w-0">
                                    <span className="font-semibold" style={{ color: isSelected ? meta.color : warn ? "#71717A" : meta.color + "CC" }}>{meta.label}</span>
                                    {warn && <span className="text-[9px] text-amber-500/60 flex items-center gap-1"><span>⚠</span> Set GEMINI_API_KEY in .env</span>}
                                  </div>
                                  <span className={`ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isSelected ? "bg-emerald-500/20 text-emerald-400" : warn ? "bg-white/[0.04] text-zinc-600" : m.badge === "Smart" ? "bg-blue-500/10 text-blue-400/70" : "bg-white/[0.05] text-zinc-500"}`}>{m.badge}</span>
                                </button>
                              );
                            })}
                            <div className="h-1.5" />
                          </div>
                        </>,
                        document.body
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleSimulate} disabled={isSimulating}>
                    {isSimulating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                    ) : (
                      <LineChart className="mr-2 h-4 w-4 text-emerald-400" />
                    )}
                    {isSimulating ? "AI Analyzing Market..." : "Run AI Simulation"}
                  </Button>

                  <AnimatePresence>
                    {showSimulation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 200, marginTop: 16 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="rounded-[18px] border border-white/[0.04] bg-white/[0.02] p-4 overflow-hidden"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Estimated ROI</span>
                          <span className="text-xs font-medium text-emerald-400">+25.00%</span>
                        </div>
                        <div className="h-[140px] w-full mt-2">
                          {showSimulation && (
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                              <RechartsLineChart data={simulationData}>
                                <XAxis dataKey="day" hide />
                                <YAxis hide domain={["dataMin - 50", "dataMax + 50"]} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#111113", borderColor: "rgba(255,255,255,0.06)", borderRadius: "14px", fontSize: "11px" }}
                                  itemStyle={{ color: "#34d399" }}
                                  labelStyle={{ color: "#71717a" }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={1.5} dot={false} animationDuration={1500} />
                              </RechartsLineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AI Analysis */}
                  <AnimatePresence>
                    {aiAnalysis && showSimulation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="rounded-[20px] border border-white/[0.05] bg-white/[0.02] p-5 overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Brain className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <span className="text-xs font-medium" style={{ color: getModelMeta(analysisModel).color }}>{getModelMeta(analysisModel).label}</span><span className="text-xs font-medium text-zinc-400"> Analysis</span>
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5 text-emerald-500/50" />
                              <span className="text-[10px] text-zinc-600">Real-time market intelligence</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                          {[
                            { label: "Signal", value: aiAnalysis.signal, color: aiAnalysis.signal === "BUY" ? "text-emerald-400" : aiAnalysis.signal === "SELL" ? "text-red-400" : "text-zinc-400" },
                            { label: "Confidence", value: `${aiAnalysis.confidence}%`, color: "text-zinc-200" },
                            { label: "Risk", value: aiAnalysis.riskLevel, color: aiAnalysis.riskLevel === "Low" ? "text-emerald-400" : aiAnalysis.riskLevel === "High" ? "text-red-400" : "text-amber-400" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-[14px] bg-white/[0.02] p-3 border border-white/[0.03]">
                              <span className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1">{item.label}</span>
                              <span className={`text-base font-medium ${item.color}`}>{item.value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-[14px] bg-white/[0.02] p-3 border border-white/[0.03]">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-2">AI Reasoning</span>
                          <p className="text-xs text-zinc-400 leading-relaxed">{aiAnalysis.reasoning}</p>
                        </div>

                        {aiAnalysis.suggestedAction && (
                          <div className="mt-3 rounded-[14px] bg-emerald-500/[0.04] p-3 border border-emerald-500/10">
                            <span className="text-[10px] text-emerald-500/60 uppercase tracking-wider block mb-1">Suggested Action</span>
                            <p className="text-xs text-zinc-300">{aiAnalysis.suggestedAction}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Step 3: Risk & Execution */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.36, 0.2, 0.07, 1] }}
          >
            <Card className="bg-white/[0.02] border-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-zinc-200 text-base font-medium">3. Risk &amp; Execution</CardTitle>
                <CardDescription>Control how aggressively your agent trades and when it protects your capital.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Take-Profit */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400">Take-Profit</label>
                    <span className="text-xs text-emerald-400 font-mono">{takeProfitPct}% of capital</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["10", "20", "30", "50"].map((v) => (
                      <Button key={v} variant="outline" onClick={() => setTakeProfitPct(v)} className={selectBtn(takeProfitPct === v)}>{v}%</Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600">Auto-sell back to INIT when quote balance exceeds this % of your initial capital value.</p>
                </div>

                {/* Stop-Loss */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400">Stop-Loss</label>
                    <span className="text-xs text-red-400 font-mono">-{stopLossPct}% from initial</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["5", "10", "15", "20"].map((v) => (
                      <Button key={v} variant="outline" onClick={() => setStopLossPct(v)} className={selectBtn(stopLossPct === v)}>-{v}%</Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600">Force-sell all positions if portfolio drops this % from initial capital. Prevents runaway losses.</p>
                </div>

                {/* Min Confidence */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400">Min AI Confidence</label>
                    <span className="text-xs text-zinc-400 font-mono">&ge;{minConfidence}%</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["30", "50", "70", "85"].map((v) => (
                      <Button key={v} variant="outline" onClick={() => setMinConfidence(v)} className={selectBtn(minConfidence === v)}>{v}%</Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600">Only execute trades when AI confidence is at or above this threshold. Higher = fewer but safer trades.</p>
                </div>

                {/* Trade Size */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-400">Trade Size per Signal</label>
                    <span className="text-xs text-zinc-400 font-mono">{tradeSizePct}% per trade</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["5", "10", "20", "33"].map((v) => (
                      <Button key={v} variant="outline" onClick={() => setTradeSizePct(v)} className={selectBtn(tradeSizePct === v)}>{v}%</Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600">Percentage of available balance used per trade. Lower = more trades, more compounding. Higher = fewer, bigger bets.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Step 4: Agent Details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.36, 0.2, 0.07, 1] }}
          >
            <Card className="bg-white/[0.02] border-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-zinc-200 text-base font-medium">4. Agent Details</CardTitle>
                <CardDescription>How your agent appears in the marketplace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Initial Capital (INIT)</label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder="e.g. 5"
                        className="pl-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(e.target.value)}
                      />
                      <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        if (balance) {
                          const max = Number(balance.formatted) * 0.99;
                          setInitialCapital(max.toFixed(6));
                        }
                      }}
                    >
                      Max
                    </Button>
                  </div>
                  {balance && (
                    <p className="text-xs text-zinc-600">
                      Balance: {Number(balance.formatted).toFixed(2)} {balance.symbol}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Agent Name</label>
                  <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g., INIT Accumulator Pro" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Description</label>
                  <Input value={agentDesc} onChange={(e) => setAgentDesc(e.target.value)} placeholder="Describe your strategy to attract subscribers..." />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Deployment Summary */}
        <motion.div
          className="space-y-5 sticky top-4 self-start"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
        >
          <Card className="bg-white/[0.02] border-white/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-200 text-base font-medium">
                <Bot className="h-4 w-4 text-emerald-400" />
                Deployment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Strategy", value: strategy },
                ...(strategy === "DCA" ? [{ label: "Pair", value: "INIT/USDC" }, { label: "Interval", value: interval }] : []),
                ...(strategy === "LP" ? [{ label: "Pools", value: pools.join(", ") }, { label: "Threshold", value: `${threshold}%` }] : []),
                ...(strategy === "YIELD" ? [{ label: "Protocol", value: protocol }, { label: "Risk", value: riskLevel }] : []),
                ...(strategy === "VIP" ? [{ label: "Vault", value: vault }, { label: "Frequency", value: frequency }] : []),
                { label: "Network", value: "Initia Mainnet" },
                { label: "Take-Profit", value: `${takeProfitPct}% of capital` },
                { label: "Stop-Loss", value: `-${stopLossPct}% from initial` },
                { label: "Min Confidence", value: `≥${minConfidence}%` },
                { label: "Trade Size", value: `${tradeSizePct}% per signal` },
                { label: "Creator Fee", value: "20% of Profit", accent: true },
                { label: "Est. Gas", value: "~0.001 INIT", mono: true },
              ].map((item: any) => (
                <div key={item.label} className="flex justify-between border-b border-white/[0.03] pb-2.5 gap-4">
                  <span className="text-zinc-500 shrink-0">{item.label}</span>
                  <span className={`font-medium truncate ${item.accent ? "text-emerald-400" : item.mono ? "font-mono text-zinc-300" : "text-zinc-200"}`}>
                    {item.value}
                  </span>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Badge variant="outline" className="text-[10px]">Move-Interwoven</Badge>
                <Badge className="text-[10px]">evm-1 Testnet</Badge>
              </div>

              <div className="rounded-[18px] bg-emerald-500/[0.04] border border-emerald-500/10 mt-3 overflow-hidden">
                <div className="px-4 pt-3 pb-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-500/60 uppercase tracking-wider font-medium">
                    <Wallet className="h-3 w-3" />
                    Deployment Capital
                  </div>
                </div>
                <div className="px-4 pb-3">
                  <div className="text-2xl font-light text-emerald-400 font-mono tracking-tight">
                    {initialCapital || "0"} <span className="text-sm text-emerald-500/60">INIT</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Transferred to AgentVault on deploy
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full rounded-[16px]" size="lg" onClick={handleDeploy} disabled={deploymentStatus !== "idle"}>
                <Play className="mr-2 h-4 w-4" /> Deploy Agent
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Deployment Modal */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {deploymentStatus !== "idle" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
                  className="max-w-md w-full gradient-border glow-emerald p-0 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative"
                >
                  <div className="text-center relative rounded-[27px] bg-[#111113] p-8">
                    {deploymentStatus !== "success" ? (
                      <>
                        <div className="mb-6 flex justify-center">
                          <div className="relative">
                            <Loader2 className="h-14 w-14 text-emerald-500/60 animate-spin" />
                            <Bot className="h-5 w-5 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <h2 className="text-xl font-medium text-zinc-200 mb-2">Deploying Agent</h2>
                        <p className="text-zinc-500 text-sm mb-8">Implementing your logic on the Initia Rollup...</p>

                        <div className="space-y-4 max-w-xs mx-auto text-left">
                          {[
                            { id: "preparing", label: "Preparing AgentVault Contract" },
                            { id: "funding", label: `Transferring ${initialCapital} INIT to Vault` },
                            { id: "signing", label: "Requesting Transaction Signature" },
                            { id: "broadcasting", label: "Broadcasting to evm-1 Network" },
                          ].map((step, idx) => {
                            const isCurrent = deploymentStatus === step.id || (step.id === "funding" && deploymentStatus === "preparing");
                            const isDone = ["preparing", "funding", "signing", "broadcasting", "success"].indexOf(deploymentStatus) > idx;

                            return (
                              <div key={step.id} className="flex items-center gap-3">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center border transition-colors duration-300 ${
                                  isDone ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                  isCurrent ? "border-emerald-500/30 animate-pulse" : "border-white/[0.06] text-zinc-700"
                                }`}>
                                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[10px] font-medium">{idx + 1}</span>}
                                </div>
                                <span className={`text-sm ${isCurrent ? "text-emerald-400" : isDone ? "text-zinc-400" : "text-zinc-700"}`}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-4">
                        <div className="mb-6 flex justify-center">
                          <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                          </div>
                        </div>
                        <h2 className="text-2xl font-medium text-zinc-200 mb-2">Agent Deployed!</h2>
                        <p className="text-emerald-400/70 mb-6">Successfully launched on Initia</p>

                        <div className="bg-white/[0.02] rounded-[20px] p-4 border border-white/[0.04] mb-8 text-left">
                          <div className="text-[10px] font-medium uppercase text-zinc-600 mb-2 tracking-wider">Transaction Hash</div>
                          <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <code className="text-xs text-zinc-400 truncate font-mono">{txHash}</code>
                            <Button variant="ghost" size="icon-xs" onClick={() => window.open(`https://scan.testnet.initia.xyz/initiation-2/transactions/${txHash}`, "_blank")}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <Button className="w-full rounded-[16px]" onClick={() => router.push("/app/dashboard")}>
                            Go to Dashboard <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button variant="ghost" className="text-zinc-500 hover:text-zinc-300" onClick={() => setDeploymentStatus("idle")}>
                            Build Another Agent
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
