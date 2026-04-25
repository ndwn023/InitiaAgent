"use client";

import React, { useState, useEffect, useRef } from "react";
import type { MarketAnalysis } from "@initia-agent/shared";
import { getModelMeta } from "@/lib/model-labels";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Play,
  LineChart,
  Activity,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Wallet,
  Brain,
  Sparkles,
} from "lucide-react";
import { useAgents } from "@/lib/hooks/use-agents";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CONTRACTS,
  INITIA_EVM_CHAIN_ID,
  SUPPORTED_AGENT_INTERVALS as AGENT_INTERVAL_OPTIONS,
  explorerEvmTxUrl,
} from "@initia-agent/shared";
import { useAccount, useSwitchChain, useBalance } from "wagmi";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";
import { useActivationFee } from "@/lib/hooks/use-activation-fee";
import { useMockWallet } from "@/lib/hooks/use-mock-wallet";

const AI_ANALYSIS_MODELS = [
  { id: "claude-haiku-4-5",  badge: "Fast",  provider: "anthropic" },
  { id: "claude-sonnet-4-6", badge: "Best",  provider: "anthropic" },
  { id: "claude-opus-4-6",   badge: "Pro",   provider: "anthropic" },
  { id: "claude-cli",        badge: "Local", provider: "anthropic" },
  { id: "gemini-2.5-flash",  badge: "Fast",  provider: "gemini" },
  { id: "gemini-3-flash",    badge: "Fast",  provider: "gemini" },
  { id: "gemini-3.1-pro",    badge: "Smart", provider: "gemini" },
];

const BUILDER_INTERVAL_OPTIONS = AGENT_INTERVAL_OPTIONS.filter(
  (interval) => interval !== "30 Seconds" && interval !== "1 Minute" && interval !== "8 Hours"
);

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
    skills: ["Dip Entry Detector", "Accumulation Engine", "Cost Basis Tracker", "DCA Interval Optimizer", "Market Breadth Filter"],
    indicators: ["RSI < 35 oversold", "EMA 20/50 crossover", "Volume spike +2σ", "24h momentum score", "Breadth > 45%"],
    bgColor: "bg-blue-500/10", iconColor: "text-blue-400", dotColor: "bg-blue-400/60", badgeColor: "border-blue-500/20 text-blue-400",
  },
  LP: {
    label: "LP Auto-Rebalancing",
    tagline: "Maximize fee income while guarding against IL",
    skills: ["IL Protection Guard", "Fee APR Optimizer", "Pool Rebalance Trigger", "Depth Scanner", "Volatility Regime Router"],
    indicators: ["Pool ratio deviation >5%", "Volume/TVL ratio", "Fee 24h APR", "Price range delta", "Intraday volatility %"],
    bgColor: "bg-purple-500/10", iconColor: "text-purple-400", dotColor: "bg-purple-400/60", badgeColor: "border-purple-500/20 text-purple-400",
  },
  YIELD: {
    label: "Yield Optimizer",
    tagline: "Chase highest APY — rotate protocols on decay",
    skills: ["APY Scanner", "Protocol Rotation Engine", "Harvest Timer", "Compound Frequency Optimizer", "Cross-Asset Leader Scanner"],
    indicators: ["APY delta 7d", "Emissions decay rate", "Utilization ratio", "Reward token trend", "Leader momentum map"],
    bgColor: "bg-amber-500/10", iconColor: "text-amber-400", dotColor: "bg-amber-400/60", badgeColor: "border-amber-500/20 text-amber-400",
  },
  VIP: {
    label: "VIP Maximizer",
    tagline: "Retain tier status — compound esINIT automatically",
    skills: ["Tier Retention Monitor", "esINIT Compounder", "Epoch Timing Tracker", "Volume Threshold Manager", "Breakout Sniper"],
    indicators: ["esINIT APR", "VIP tier threshold", "Epoch progress %", "Loyalty multiplier", "Risk-on regime + leader confirmation"],
    bgColor: "bg-rose-500/10", iconColor: "text-rose-400", dotColor: "bg-rose-400/60", badgeColor: "border-rose-500/20 text-rose-400",
  },
};

export default function BuilderPage() {
  const router = useRouter();
  const { addAgent } = useAgents();
  const { signMockAction } = useInterwovenEvm();
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletInitBalance } = useBalance({
    address,
    chainId: INITIA_EVM_CHAIN_ID,
  });
  const { initBalance, formattedInit, spendInit } = useMockWallet(address, Number(walletInitBalance?.formatted ?? 0));
  const { chargeFee, activationFeeInit } = useActivationFee();

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

  const [takeProfitPct, setTakeProfitPct] = useState("20");
  const [stopLossPct, setStopLossPct] = useState("10");
  const [minConfidence, setMinConfidence] = useState("50");
  const [tradeSizePct, setTradeSizePct] = useState("10");
  const [wizardStep, setWizardStep] = useState(1);

  useEffect(() => {
    fetch("/api/agent/strategy-skills")
      .then(r => r.json())
      .then(d => {
        if (d?.apiKeys) {
          setApiKeyStatus(d.apiKeys);
          setAnalysisModel((currentModel) => {
            if (!d.apiKeys.anthropic && currentModel.startsWith("claude") && currentModel !== "claude-cli") {
              return "gemini-2.5-flash";
            }
            if (!d.apiKeys.gemini && currentModel.startsWith("gemini")) {
              return "claude-cli";
            }
            return currentModel;
          });
        }
      })
      .catch(() => {});
  }, []);

  const [deploymentStatus, setDeploymentStatus] = useState<
    "idle" | "preparing" | "funding" | "signing" | "broadcasting" | "approving" | "deploying" | "success" | "failed"
  >("idle");
  const [txHash, setTxHash] = useState("");
  const [deploymentError, setDeploymentError] = useState("");

  const capitalVal = parseFloat(initialCapital) || 0;

  // Projection varies by interval — shorter intervals = more trades but slippage-heavy, longer = fewer but bigger moves
  const intervalProjection: Record<string, number[]> = {
    "30 Seconds": [1, 1.005, 1.003, 1.007, 1.006, 1.004, 1.008],
    "5 Minutes":  [1, 1.01,  1.008, 1.015, 1.012, 1.011, 1.02],
    "15 Minutes": [1, 1.02,  1.015, 1.03,  1.027, 1.025, 1.04],
    "30 Minutes": [1, 1.03,  1.025, 1.05,  1.045, 1.04,  1.07],
    "1 Hour":     [1, 1.04,  1.02,  1.07,  1.09,  1.08,  1.12],
    "4 Hours":    [1, 1.05,  1.02,  1.10,  1.15,  1.13,  1.20],
    "12 Hours":   [1, 1.06,  1.03,  1.12,  1.17,  1.14,  1.22],
    "24 Hours":   [1, 1.05,  1.02,  1.10,  1.15,  1.13,  1.25],
  };
  const proj = intervalProjection[interval] ?? intervalProjection["1 Hour"];

  const simulationData = [
    { day: "1",  value: capitalVal * proj[0] },
    { day: "5",  value: capitalVal * proj[1] },
    { day: "10", value: capitalVal * proj[2] },
    { day: "15", value: capitalVal * proj[3] },
    { day: "20", value: capitalVal * proj[4] },
    { day: "25", value: capitalVal * proj[5] },
    { day: "30", value: capitalVal * proj[6] },
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
    setStrategy("VIP");
    setTargetTokens(["USDC"]);
    setPools(["INIT/USDC"]);
    setIntervalVal("30 Minutes");
    // Tighter take-profit (20%) realises gains more frequently than 30%.
    // Smaller stop-loss (8%) exits quickly before drawdowns compound.
    // Lower min-confidence (45%) lets the aggressive VIP engine enter early on momentum.
    // 20% trade size: large enough to move the needle, not so large that one bad trade wipes out gains.
    setTakeProfitPct("20");
    setStopLossPct("8");
    setMinConfidence("45");
    setTradeSizePct("20");
    setRiskLevel("High");
    setProtocol("InitiaLend");
    setVault("Main Vault");
    setFrequency("Daily");
    setShowSimulation(false);
    setAiAnalysis(null);
    if (!agentName.trim()) setAgentName("INIT Breakout VIP");
    if (!agentDesc.trim()) setAgentDesc("Aggressive INIT/USDC setup that presses momentum in risk-on regime and de-risks fast when momentum fades.");
    toast.success("Recommendation applied", { description: "Builder set to profit-optimised VIP config: 20% size · 8% SL · 20% TP · 45% min-conf." });
  };

  const handleDeploy = async () => {
    if (!agentName) {
      toast.error("Validation Error", { description: "Please enter an Agent Name to proceed with deployment." });
      return;
    }
    const deployCapital = Number(initialCapital);
    if (!Number.isFinite(deployCapital) || deployCapital <= 0) {
      toast.error("Validation Error", { description: "Initial capital must be greater than 0." });
      return;
    }
    if (deployCapital > initBalance) {
      toast.error("Insufficient Mock INIT", { description: "Top up Mock INIT in wallet panel or lower the capital amount." });
      return;
    }
    if (chainId !== INITIA_EVM_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID });
      } catch {
        toast.error("Network Error", { description: "Please switch to Initia evm-1 in your wallet." });
        return;
      }
    }
    setTxHash("");
    setDeploymentError("");
    setDeploymentStatus("preparing");
    const vaultAddress = CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`;
    let deployTxHash = "";
    try {
      setDeploymentStatus("signing");
      const receipt = await chargeFee("activation");
      toast.success("Activation fee paid", {
        description: `${activationFeeInit} INIT → treasury (${receipt.txHash.slice(0, 10)}…)`,
      });

      deployTxHash = await signMockAction();
      if (!spendInit(deployCapital)) {
        throw new Error("Insufficient Mock INIT balance");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("Deployment failed:", err);
      setDeploymentError(message);
      setDeploymentStatus("failed");
      toast.error("Deploy failed", { description: message.slice(0, 160) || "Transaction failed or was rejected." });
      return;
    }
    setTxHash(deployTxHash);
    setDeploymentStatus("broadcasting");
    try {
      await addAgent({
        id: Math.random().toString(36).substr(2, 9),
        name: agentName, strategy, target: targetTokens[0] || "USDC", pool: pools.join(", "), protocol, vault,
        status: "Active", deployedAt: new Date().toISOString(), txHash: deployTxHash,
        contractAddress: vaultAddress, initialCapital: deployCapital,
        creatorAddress: address || "", interval, isSubscription: false,
        takeProfitPct: parseFloat(takeProfitPct) || 20, stopLossPct: parseFloat(stopLossPct) || 10,
        minConfidence: parseFloat(minConfidence) || 50, tradeSizePct: parseFloat(tradeSizePct) || 10,
        onChainAgentId: "1",
      });
      setDeploymentStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("Persisting deployed agent failed:", err);
      setDeploymentError(message);
      setDeploymentStatus("failed");
      toast.error("Deploy saved failed", { description: message.slice(0, 160) || "On-chain success, but failed to save agent data." });
    }
  };

  const selectBtn = (active: boolean) =>
    `flex-1 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] ${
      active
        ? "border-purple-500/20 bg-purple-500/[0.06] text-purple-400"
        : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
    }`;

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-4rem)] lg:overflow-hidden">

      {/* ── TOP HEADER BAR ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 md:px-8 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="shrink-0">
          <h1 className="text-[1.3rem] text-white leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Agent <span className="text-gradient">Builder</span>
          </h1>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-[12px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {[{ id: 1, label: "Strategy & Config" }, { id: 2, label: "Risk & Deploy" }].map((s) => {
            const isActive = wizardStep === s.id;
            const isDone = wizardStep > s.id;
            return (
              <button key={s.id} onClick={() => { if (isDone || isActive) setWizardStep(s.id); }}
                className="flex items-center gap-2 px-3 md:px-4 h-8 rounded-[8px] text-[12px] font-medium transition-all duration-200"
                style={{ background: isActive ? "#7b39fc" : "transparent", color: isActive ? "white" : isDone ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)", fontFamily: "var(--font-cabin)" }}>
                <span className="h-4 w-4 rounded-full text-[9px] flex items-center justify-center font-bold shrink-0"
                  style={{ background: isActive ? "rgba(255,255,255,0.25)" : isDone ? "rgba(123,57,252,0.4)" : "rgba(255,255,255,0.08)", color: isActive || isDone ? "white" : "rgba(255,255,255,0.3)" }}>
                  {isDone ? "✓" : s.id}
                </span>
                <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>
        <button onClick={applyRecommendation}
          className="shrink-0 flex items-center gap-2 px-3 h-9 rounded-[10px] text-white text-[12px] font-medium hover:opacity-90 transition-all"
          style={{ background: "#2b2344", border: "1px solid rgba(123,57,252,0.3)", fontFamily: "var(--font-cabin)" }}>
          <Sparkles className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
          <span className="hidden sm:inline">Best Config</span>
        </button>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait">

          {/* STEP 1: Strategy + Configure */}
          {wizardStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.36, 0.2, 0.07, 1] }}
              className="absolute inset-0 overflow-y-auto scrollbar-hide px-5 md:px-8 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5 lg:h-full pb-4">

                {/* Row 1: Strategy (positions 1,2) */}
                <div className="flex flex-col gap-3 lg:col-span-2">
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ fontFamily: "var(--font-manrope)" }}>Choose Strategy</p>
                  <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1">
                    {[
                      { id: "DCA", name: "Dollar Cost Averaging", desc: "Regular intervals with AI timing", icon: "⟳", accent: "rgba(99,102,241,0.2)", border: "rgba(99,102,241,0.4)" },
                      { id: "LP",  name: "LP Auto-Rebalancing",   desc: "Maximize fee income vs IL",        icon: "⇌", accent: "rgba(123,57,252,0.2)", border: "rgba(123,57,252,0.4)" },
                      { id: "YIELD", name: "Yield Optimizer",     desc: "Chase highest APY dynamically",   icon: "◈", accent: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)" },
                      { id: "VIP",  name: "VIP Maximizer",        desc: "Retain tier, compound rewards",   icon: "★", accent: "rgba(244,63,94,0.15)",  border: "rgba(244,63,94,0.3)" },
                    ].map(s => {
                      const isSelected = strategy === s.id;
                      return (
                        <div key={s.id} onClick={() => {
                            setStrategy(s.id);
                            setShowSimulation(false);
                            setAiAnalysis(null);
                            // Set profit-optimized defaults per strategy
                            if (s.id === "DCA") {
                              setIntervalVal("4 Hours");
                              setTradeSizePct("6");
                              setTakeProfitPct("15");
                              setStopLossPct("15");
                              setMinConfidence("45");
                            } else if (s.id === "LP") {
                              setIntervalVal("1 Hour");
                              setTradeSizePct("10");
                              setTakeProfitPct("20");
                              setStopLossPct("10");
                              setMinConfidence("50");
                            } else if (s.id === "YIELD") {
                              setIntervalVal("4 Hours");
                              setTradeSizePct("12");
                              setTakeProfitPct("10");
                              setStopLossPct("12");
                              setMinConfidence("55");
                            } else if (s.id === "VIP") {
                              setIntervalVal("30 Minutes");
                              setTradeSizePct("20");
                              setTakeProfitPct("20");
                              setStopLossPct("8");
                              setMinConfidence("45");
                            }
                          }}
                          className="cursor-pointer rounded-[18px] p-4 flex flex-col gap-2 transition-all duration-300 hover:scale-[1.02] h-full"
                          style={{
                            background: isSelected ? s.accent : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isSelected ? s.border : "rgba(255,255,255,0.08)"}`,
                            backdropFilter: "blur(20px)",
                            boxShadow: isSelected ? `0 0 20px -8px ${s.border}` : "none",
                          }}>
                          <div className="flex justify-between items-start">
                            <span className="text-2xl opacity-70">{s.icon}</span>
                            {isSelected && <div className="h-2 w-2 rounded-full" style={{ background: "#7b39fc" }} />}
                          </div>
                          <div className="mt-auto">
                            <p className="text-[13px] font-semibold text-white/90 leading-snug" style={{ fontFamily: "var(--font-manrope)" }}>{s.name}</p>
                            <p className="text-[11px] text-white/40 mt-0.5">{s.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Row 2: Configure (positions 3,4) */}
                <div className="flex flex-col gap-3 lg:col-span-2">
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ fontFamily: "var(--font-manrope)" }}>Configure {strategy}</p>
                  <div className="rounded-[18px] p-5 flex flex-col gap-4 flex-1" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <AnimatePresence mode="wait">
                      {strategy === "DCA" && (
                        <motion.div key="dca" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[13px] font-medium text-white/60">Trading Pair</label>
                              <span className="text-[10px] text-white/30">Fixed: INIT/USDC</span>
                            </div>
                            <Button variant="outline" className={selectBtn(true)}>INIT / USDC</Button>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Buy Interval</label>
                            <div className="flex gap-2 flex-wrap">
                              {BUILDER_INTERVAL_OPTIONS.map(i => (
                                <Button key={i} variant="outline" onClick={() => setIntervalVal(i)} className={selectBtn(interval === i)}>{i}</Button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {strategy === "LP" && (
                        <motion.div key="lp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[13px] font-medium text-white/60">Target Pools</label>
                              <span className="text-[10px] text-white/30">{pools.length} selected</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {["INIT/USDC"].map(p => (
                                <Button key={p} variant="outline" onClick={() => setPools(prev => prev.includes(p) ? prev.length > 1 ? prev.filter(x => x !== p) : prev : [...prev, p])} className={selectBtn(pools.includes(p))}>{p}</Button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Rebalance Threshold</label>
                            <div className="flex gap-2">
                              {["1","5","10","20"].map(t => <Button key={t} variant="outline" onClick={() => setThreshold(t)} className={selectBtn(threshold === t)}>{t}%</Button>)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Rebalance Interval</label>
                            <div className="flex gap-2 flex-wrap">
                              {BUILDER_INTERVAL_OPTIONS.map(i => (
                                <Button key={i} variant="outline" onClick={() => setIntervalVal(i)} className={selectBtn(interval === i)}>{i}</Button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {strategy === "YIELD" && (
                        <motion.div key="yield" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Target Protocol</label>
                            <div className="flex gap-2">
                              {["InitiaLend","LiquidSwap","Minitia"].map(p => <Button key={p} variant="outline" onClick={() => setProtocol(p)} className={selectBtn(protocol === p)}>{p}</Button>)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Risk Profile</label>
                            <div className="flex gap-2">
                              {["Low","Medium","High"].map(r => <Button key={r} variant="outline" onClick={() => setRiskLevel(r)} className={selectBtn(riskLevel === r)}>{r}</Button>)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Scan Interval</label>
                            <div className="flex gap-2 flex-wrap">
                              {BUILDER_INTERVAL_OPTIONS.map(i => (
                                <Button key={i} variant="outline" onClick={() => setIntervalVal(i)} className={selectBtn(interval === i)}>{i}</Button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {strategy === "VIP" && (
                        <motion.div key="vip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Target Vault</label>
                            <div className="flex gap-2">
                              {["Main Vault","Alpha Vault","Beta Vault"].map(v => <Button key={v} variant="outline" onClick={() => setVault(v)} className={selectBtn(vault === v)}>{v}</Button>)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Claim Frequency</label>
                            <div className="flex gap-2">
                              {["Daily","Weekly","Bi-Weekly"].map(f => <Button key={f} variant="outline" onClick={() => setFrequency(f)} className={selectBtn(frequency === f)}>{f}</Button>)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[13px] font-medium text-white/60">Check Interval</label>
                            <div className="flex gap-2 flex-wrap">
                              {BUILDER_INTERVAL_OPTIONS.map(i => (
                                <Button key={i} variant="outline" onClick={() => setIntervalVal(i)} className={selectBtn(interval === i)}>{i}</Button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Initial Capital */}
                    <div className="space-y-1.5 mt-auto pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-medium text-white/60">Initial Capital (INIT)</label>
                        <span className="text-[10px] text-white/30">Mock Balance: {formattedInit}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input type="number" placeholder="e.g. 5" value={initialCapital} onChange={e => setInitialCapital(e.target.value)}
                            className="pl-9 bg-white/[0.05] border-white/[0.1] text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                          <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                        </div>
                        <Button variant="outline" className="shrink-0 border-white/[0.1] text-white/50 hover:text-white text-[12px]"
                          onClick={() => setInitialCapital((initBalance * 0.99).toFixed(6))}>Max</Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column: AI Skills + Analysis (spans both rows) */}
                <AnimatePresence mode="wait">
                  <motion.div key={strategy} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex flex-col gap-3 lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full">
                    <div className="flex items-center justify-between shrink-0">
                      <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-manrope)" }}>AI Skills & Analysis</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.25)", color: "#a78bfa", fontFamily: "var(--font-cabin)" }}>
                          {STRATEGY_SKILLS[strategy]?.skills.length ?? 0} modules
                        </span>
                        <div className="relative">
                          <button ref={analysisModelBtnRef}
                            onClick={() => {
                              if (!analysisModelMenuOpen && analysisModelBtnRef.current) {
                                const r = analysisModelBtnRef.current.getBoundingClientRect();
                                setAnalysisMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
                              }
                              setAnalysisModelMenuOpen(v => !v);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[10px] font-medium text-white/40 hover:text-white/70 transition-all"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <Sparkles className="h-2.5 w-2.5" style={{ color: "#7b39fc" }} />
                            <span style={{ color: getModelMeta(analysisModel).color }}>{getModelMeta(analysisModel).label}</span>
                          </button>
                          {analysisModelMenuOpen && typeof document !== "undefined" && createPortal(
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setAnalysisModelMenuOpen(false)} />
                              <div className="fixed z-50 w-[220px] rounded-[14px] overflow-hidden shadow-2xl"
                                style={{ top: analysisMenuPos.top, right: analysisMenuPos.right, background: "rgba(10,6,24,0.95)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                {AI_ANALYSIS_MODELS.map(m => {
                                  const meta = getModelMeta(m.id);
                                  const isSelected = analysisModel === m.id;
                                  const warn = m.id !== "claude-cli" && (m.provider === "anthropic" ? !apiKeyStatus.anthropic : !apiKeyStatus.gemini);
                                  return (
                                    <button key={m.id} disabled={warn}
                                      onClick={() => { if (!warn) { setAnalysisModel(m.id); setAnalysisModelMenuOpen(false); } }}
                                      className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] transition-all ${warn ? "opacity-30 cursor-not-allowed" : isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.04] cursor-pointer"}`}>
                                      <span className="font-semibold" style={{ color: isSelected ? meta.color : warn ? "#52525b" : meta.color + "CC" }}>{meta.label}</span>
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{m.badge}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[18px] p-4 flex flex-col gap-3 lg:flex-1" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${STRATEGY_SKILLS[strategy]?.bgColor ?? "bg-zinc-500/10"}`}>
                          <Brain className={`h-4 w-4 ${STRATEGY_SKILLS[strategy]?.iconColor ?? "text-zinc-400"}`} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-white/90">{STRATEGY_SKILLS[strategy]?.label}</p>
                          <p className="text-[10px] text-white/40">{STRATEGY_SKILLS[strategy]?.tagline}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(STRATEGY_SKILLS[strategy]?.skills ?? []).map(skill => (
                          <div key={skill} className="flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${STRATEGY_SKILLS[strategy]?.dotColor ?? "bg-zinc-400/60"}`} />
                            <span className="text-[11px] text-white/60">{skill}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/[0.06] pt-3 flex flex-col gap-2.5">
                        <button onClick={handleSimulate} disabled={isSimulating}
                          className="w-full h-9 rounded-[10px] flex items-center justify-center gap-2 text-[12px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
                          style={{ background: isSimulating ? "rgba(123,57,252,0.3)" : "#7b39fc", fontFamily: "var(--font-cabin)" }}>
                          {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LineChart className="h-3.5 w-3.5" />}
                          {isSimulating ? "AI Analyzing..." : "Run AI Analysis"}
                        </button>
                        <AnimatePresence>
                          {showSimulation && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                              <div className="rounded-[12px] p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-[10px] text-white/40">Est. ROI — 30d</span>
                                  <span className="text-[11px] font-medium" style={{ color: "#a78bfa" }}>+{(((proj[6] ?? 1.25) - 1) * 100).toFixed(2)}%</span>
                                </div>
                                <div className="h-[70px]">
                                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <RechartsLineChart data={simulationData}>
                                      <XAxis dataKey="day" hide />
                                      <YAxis hide domain={["dataMin - 50", "dataMax + 50"]} />
                                      <Tooltip contentStyle={{ backgroundColor: "#0a0612", borderColor: "rgba(123,57,252,0.3)", borderRadius: "10px", fontSize: "11px" }} />
                                      <Line type="monotone" dataKey="value" stroke="#7b39fc" strokeWidth={2} dot={false} animationDuration={1200} />
                                    </RechartsLineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                              {aiAnalysis && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[12px] p-3 space-y-2" style={{ background: "rgba(123,57,252,0.08)", border: "1px solid rgba(123,57,252,0.2)" }}>
                                  <div className="flex items-center gap-1.5">
                                    <Brain className="h-3 w-3" style={{ color: "#a78bfa" }} />
                                    <span className="text-[10px] font-medium" style={{ color: getModelMeta(analysisModel).color }}>{getModelMeta(analysisModel).label}</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[
                                      { label: "Signal", value: aiAnalysis.signal, color: aiAnalysis.signal === "BUY" ? "#a78bfa" : aiAnalysis.signal === "SELL" ? "#f87171" : "rgba(255,255,255,0.5)" },
                                      { label: "Conf.", value: `${aiAnalysis.confidence}%`, color: "rgba(255,255,255,0.8)" },
                                      { label: "Risk", value: aiAnalysis.riskLevel, color: aiAnalysis.riskLevel === "Low" ? "#a78bfa" : aiAnalysis.riskLevel === "High" ? "#f87171" : "#fbbf24" },
                                    ].map(item => (
                                      <div key={item.label} className="rounded-[8px] p-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                        <span className="text-[9px] text-white/30 uppercase tracking-wider block mb-0.5">{item.label}</span>
                                        <span className="text-[12px] font-semibold" style={{ color: item.color }}>{item.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-white/40 leading-relaxed">{aiAnalysis.reasoning}</p>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {!showSimulation && !isSimulating && (
                          <div className="flex items-center justify-center py-3 text-center">
                            <div>
                              <Activity className="h-5 w-5 mx-auto mb-1.5 text-white/10" />
                              <p className="text-[10px] text-white/25">Run analysis to preview</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

              </div>
            </motion.div>
          )}

          {/* STEP 2: Risk + Deploy */}
          {wizardStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.36, 0.2, 0.07, 1] }}
              className="absolute inset-0 overflow-y-auto scrollbar-hide px-5 md:px-8 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-full pb-4">

                {/* Left: Risk Controls */}
                <div className="flex flex-col gap-3 lg:h-full">
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ fontFamily: "var(--font-manrope)" }}>Risk & Execution Controls</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:flex-1 lg:grid-rows-2">
                    {[
                      { key: "tp", label: "Take-Profit",       desc: "Auto-sell when quote exceeds % of capital",   value: takeProfitPct, suffix: "%",  set: setTakeProfitPct, options: ["10","20","30","50"],  valueColor: "#a78bfa",               hint: "Auto-sell back to INIT when quote balance exceeds this % of initial capital." },
                      { key: "sl", label: "Stop-Loss",         desc: "Force-exit if portfolio drops this much",     value: stopLossPct,   suffix: "%",  set: setStopLossPct,   options: ["5","10","15","20"],   valueColor: "#f87171",  prefix: "-", hint: "Force-sell all positions if portfolio drops this % from initial capital." },
                      { key: "mc", label: "Min AI Confidence", desc: "Only execute above this confidence level",    value: minConfidence, suffix: "%",  set: setMinConfidence, options: ["30","50","70","85"],  valueColor: "rgba(255,255,255,0.7)", prefix: "≥", hint: "Higher = fewer but more confident trades." },
                      { key: "ts", label: "Trade Size/Signal", desc: "% of available balance used per trade",      value: tradeSizePct,  suffix: "%",  set: setTradeSizePct,  options: ["5","10","20","30"],   valueColor: "rgba(255,255,255,0.7)", hint: "Capped at 30% per vault policy (docs). Higher = fewer, larger bets." },
                    ].map(ctrl => (
                      <div key={ctrl.key} className="rounded-[18px] p-4 flex flex-col gap-3 h-full" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-white/80" style={{ fontFamily: "var(--font-manrope)" }}>{ctrl.label}</p>
                            <p className="text-[11px] text-white/30 mt-0.5">{ctrl.desc}</p>
                          </div>
                          <span className="text-[15px] font-bold font-mono shrink-0 ml-2" style={{ color: ctrl.valueColor }}>{ctrl.prefix ?? ""}{ctrl.value}{ctrl.suffix}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {ctrl.options.map(v => (
                            <button key={v} onClick={() => ctrl.set(v)}
                              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all"
                              style={{ background: ctrl.value === v ? "#7b39fc" : "rgba(255,255,255,0.05)", border: `1px solid ${ctrl.value === v ? "#7b39fc" : "rgba(255,255,255,0.08)"}`, color: ctrl.value === v ? "white" : "rgba(255,255,255,0.4)", fontFamily: "var(--font-cabin)" }}>
                              {ctrl.prefix ?? ""}{v}{ctrl.suffix}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-white/20 leading-relaxed mt-auto">{ctrl.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Agent Identity + Deployment Summary */}
                <div className="flex flex-col gap-3 lg:h-full">
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ fontFamily: "var(--font-manrope)" }}>Agent Identity & Deploy</p>
                  <div className="flex flex-col gap-3 lg:flex-1">
                    <div className="rounded-[18px] p-5 flex flex-col gap-4" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-white/50" style={{ fontFamily: "var(--font-manrope)" }}>Agent Name</label>
                        <Input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g., INIT Accumulator Pro" className="bg-white/[0.05] border-white/[0.1] text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-white/50" style={{ fontFamily: "var(--font-manrope)" }}>Description</label>
                        <Input value={agentDesc} onChange={e => setAgentDesc(e.target.value)} placeholder="Describe your strategy..." className="bg-white/[0.05] border-white/[0.1] text-white" />
                      </div>
                      <div className="rounded-[12px] p-3" style={{ background: "rgba(123,57,252,0.08)", border: "1px solid rgba(123,57,252,0.18)" }}>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          Your agent appears in the marketplace. You earn <span style={{ color: "#a78bfa" }}>18% of subscriber profits</span> as creator fee.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[18px] p-5 flex flex-col gap-2.5 lg:flex-1" style={{ background: "rgba(123,57,252,0.1)", backdropFilter: "blur(20px)", border: "1px solid rgba(123,57,252,0.25)" }}>
                      <div className="flex items-center gap-3 mb-1">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(123,57,252,0.25)", border: "1px solid rgba(123,57,252,0.4)" }}>
                          <Bot className="h-4 w-4" style={{ color: "#a78bfa" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white/90 truncate">{agentName || "Unnamed Agent"}</p>
                          <p className="text-[11px] text-white/40">{strategy} · evm-1 Testnet</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {([
                          { label: "Strategy", value: strategy },
                          { label: "Take-Profit", value: `${takeProfitPct}%` },
                          { label: "Stop-Loss", value: `-${stopLossPct}%` },
                          { label: "Min Confidence", value: `≥${minConfidence}%` },
                          { label: "Trade Size", value: `${tradeSizePct}% / signal` },
                          { label: "Creator Fee", value: "18% of Profit", accent: true },
                        ] as Array<{ label: string; value: string; accent?: boolean }>).map((item) => (
                          <div key={item.label} className="flex justify-between items-center pb-1.5 border-b border-white/[0.06] gap-4">
                            <span className="text-[11px] text-white/40">{item.label}</span>
                            <span className={`text-[11px] font-medium ${item.accent ? "" : "text-white/70"}`} style={item.accent ? { color: "#a78bfa" } : {}}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-[14px] p-4 mt-auto" style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.3)" }}>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-manrope)" }}>Capital to Deploy</p>
                        <p className="text-[24px] font-light font-mono" style={{ color: "#a78bfa" }}>{initialCapital || "0"} <span className="text-[14px] text-white/40">INIT</span></p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── BOTTOM NAVIGATION ── */}
      <div className="shrink-0 flex items-center justify-between px-5 md:px-8 py-4 border-t border-white/[0.06]">
        <button
          onClick={() => setWizardStep(s => Math.max(1, s - 1))}
          disabled={wizardStep === 1}
          className="flex items-center gap-2 px-5 h-10 rounded-[10px] text-[13px] font-medium text-white/60 hover:text-white disabled:opacity-30 transition-all"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontFamily: "var(--font-cabin)" }}>
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          {[1, 2].map(i => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: wizardStep === i ? "20px" : "6px", background: wizardStep >= i ? "#7b39fc" : "rgba(255,255,255,0.1)" }} />
          ))}
        </div>
        {wizardStep < 2 ? (
          <button
            onClick={() => setWizardStep(2)}
            className="flex items-center gap-2 px-5 h-10 rounded-[10px] text-[13px] font-medium text-white hover:opacity-90 transition-all"
            style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={deploymentStatus !== "idle" || !agentName}
            className="flex items-center gap-2 px-5 h-10 rounded-[10px] text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
            {deploymentStatus !== "idle" && deploymentStatus !== "success" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Deploy Agent
          </button>
        )}
      </div>

      {/* ── DEPLOYMENT MODAL ── */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {deploymentStatus !== "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md rounded-[24px] p-8 text-center relative"
                style={{ background: "rgba(10,6,24,0.97)", border: "1px solid rgba(123,57,252,0.3)" }}>
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[24px]" style={{ background: "linear-gradient(90deg, transparent, #7b39fc, transparent)" }} />
                {deploymentStatus === "approving" && (
                  <div className="space-y-4">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.3)" }}>
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#7b39fc" }} />
                    </div>
                    <div>
                      <h3 className="text-[20px] text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Approving INIT</h3>
                      <p className="text-white/40 text-[13px] mt-1">Confirm the approval transaction in your wallet</p>
                    </div>
                  </div>
                )}
                {deploymentStatus === "deploying" && (
                  <div className="space-y-4">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.3)" }}>
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#7b39fc" }} />
                    </div>
                    <div>
                      <h3 className="text-[20px] text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Deploying Agent</h3>
                      <p className="text-white/40 text-[13px] mt-1">Registering your agent on-chain</p>
                    </div>
                  </div>
                )}
                {(deploymentStatus === "preparing" || deploymentStatus === "funding" || deploymentStatus === "signing" || deploymentStatus === "broadcasting") && (
                  <div className="space-y-4">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.3)" }}>
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#7b39fc" }} />
                    </div>
                    <div>
                      <h3 className="text-[20px] text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Processing</h3>
                      <p className="text-white/40 text-[13px] mt-1 capitalize">{deploymentStatus}...</p>
                    </div>
                  </div>
                )}
                {deploymentStatus === "success" && (
                  <div className="space-y-5">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(123,57,252,0.2)", border: "1px solid rgba(123,57,252,0.4)" }}>
                      <CheckCircle2 className="h-8 w-8" style={{ color: "#a78bfa" }} />
                    </div>
                    <div>
                      <h3 className="text-[22px] text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Agent Deployed!</h3>
                      <p className="text-white/40 text-[13px] mt-1">Successfully launched on Initia</p>
                    </div>
                    {txHash && (
                      <div className="rounded-[14px] p-3 text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Transaction Hash</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[11px] text-white/60 truncate font-mono">{txHash}</code>
                          <Button variant="ghost" size="icon-xs" onClick={() => window.open(explorerEvmTxUrl(txHash), "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <button onClick={() => router.push("/app/dashboard")}
                        className="w-full h-11 rounded-[12px] text-white text-[14px] font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
                        Go to Dashboard <ChevronRight className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setDeploymentStatus("idle"); setWizardStep(1); }}
                        className="w-full h-10 rounded-[12px] text-white/40 text-[13px] hover:text-white/70 transition-all"
                        style={{ fontFamily: "var(--font-cabin)" }}>
                        Build Another Agent
                      </button>
                    </div>
                  </div>
                )}
                {deploymentStatus === "failed" && (
                  <div className="space-y-5">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)" }}>
                      <span className="text-2xl text-rose-300">!</span>
                    </div>
                    <div>
                      <h3 className="text-[22px] text-white font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Deploy Interrupted</h3>
                      <p className="text-white/50 text-[13px] mt-1">The deploy flow stopped before completion.</p>
                    </div>
                    <div className="rounded-[14px] p-3 text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Reason</p>
                      <p className="text-[12px] text-white/70 break-words">{deploymentError || "Unknown error from wallet or RPC."}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setDeploymentStatus("idle"); setDeploymentError(""); }}
                        className="w-full h-11 rounded-[12px] text-white text-[14px] font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
                        Try Again <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
