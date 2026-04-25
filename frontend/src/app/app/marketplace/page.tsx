"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity, ArrowRight, Loader2, Plus, Store } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAgents } from "@/lib/hooks/use-agents";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBalance, useAccount, useSwitchChain } from "wagmi";
import { AgentCard } from "@/components/AgentCard";
import {
  INITIA_EVM_CHAIN_ID,
  filterAgentsByStrategy,
  getOpenCreatorAgents,
  type DeployedAgent,
} from "@initia-agent/shared";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";
import { useMockWallet } from "@/lib/hooks/use-mock-wallet";

export default function MarketplacePage() {
  const router = useRouter();
  const { allAgents, addAgent, isLoading } = useAgents({ scope: "marketplace", limit: 300 });
  const { signMockAction } = useInterwovenEvm();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { address } = useInterwovenKit();
  const { data: nativeInitBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: INITIA_EVM_CHAIN_ID,
  });
  const { initBalance, spendInit } = useMockWallet(address, Number(nativeInitBalance?.formatted ?? 0));

  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);

  // Rank by capital deployed, highest first — mirrors the leaderboard order
  // so users see top-performing strategies at the top of the marketplace too.
  // `slice()` copies before sort so we don't mutate the hook's cached array.
  const creatorAgents = useMemo(
    () =>
      getOpenCreatorAgents(allAgents)
        .slice()
        .sort((a, b) => b.initialCapital - a.initialCapital),
    [allAgents]
  );
  const availableAgents = useMemo(
    () => filterAgentsByStrategy(creatorAgents, filter),
    [creatorAgents, filter]
  );

  // When arriving from /app/leaderboard#agent-{id}: scroll to and briefly
  // highlight the matching agent card. Ignores filter mismatches gracefully.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoading || availableAgents.length === 0) return;

    const hash = window.location.hash;
    const match = /^#agent-(.+)$/.exec(hash);
    if (!match) return;

    const targetId = match[1];
    const exists = availableAgents.some((a) => a.id === targetId);
    if (!exists) return;

    // Wait one frame so the card is rendered, then scroll + highlight.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`agent-${targetId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedAgentId(targetId);
      // Clear the hash so a manual refresh doesn't keep re-triggering.
      history.replaceState(null, "", window.location.pathname);
    });

    const t = setTimeout(() => setHighlightedAgentId(null), 2400);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [isLoading, availableAgents]);

  const handleOpenSubscribe = useCallback((agent: DeployedAgent) => {
    setSelectedAgent(agent);
    setDepositAmount("");
    setDialogOpen(true);
  }, []);

  const handleSubscribe = async () => {
    if (!selectedAgent || !depositAmount) return;

    if (chainId !== INITIA_EVM_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID });
      } catch {
        toast.error("Network Error", { description: "Please switch to Initia evm-1." });
        return;
      }
    }

    setIsSubscribing(true);
    try {
      const parsedDeposit = Number(depositAmount);
      if (!Number.isFinite(parsedDeposit) || parsedDeposit <= 0) {
        throw new Error("Invalid deposit amount");
      }
      if (!spendInit(parsedDeposit)) {
        throw new Error("Insufficient Mock INIT balance");
      }
      const txHash = await signMockAction();

      await addAgent({
        id: Math.random().toString(36).substring(2, 9),
        name: `${selectedAgent.name} (Sub)`,
        strategy: selectedAgent.strategy,
        status: "Active",
        deployedAt: new Date().toISOString(),
        txHash,
        contractAddress: selectedAgent.contractAddress,
        initialCapital: parsedDeposit || 0,
        creatorAddress: address as string,
        isSubscription: true,
      });

      setIsSubscribing(false);
      setDialogOpen(false);
      router.push("/app/dashboard");
    } catch (error) {
      console.error(error);
      setIsSubscribing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-4rem)] lg:overflow-hidden pb-24 md:pb-0">

      {/* === HERO HEADER === */}
      <div className="shrink-0 px-5 md:px-8 pt-6 md:pt-8 pb-5">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.36,0.2,0.07,1] }}>
          <div className="inline-flex items-center gap-2 px-3 h-8 rounded-[8px] mb-4 text-[13px] font-medium"
            style={{ background: "rgba(123,57,252,0.15)", border: "1px solid rgba(123,57,252,0.3)", fontFamily: "var(--font-cabin)", color: "#a78bfa" }}>
            <Store className="h-3.5 w-3.5" /> Marketplace
          </div>
          <h1 className="text-[2rem] md:text-[2.5rem] text-white mb-2" style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
            Discover AI Agents
          </h1>
          <p className="text-white/50 text-[14px] mb-5" style={{ fontFamily: "var(--font-sans)" }}>
            Subscribe to top-performing autonomous DeFi strategies on Initia
          </p>

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {["All", "DCA", "LP", "YIELD", "VIP"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-200 hover:opacity-90"
                style={{
                  fontFamily: "var(--font-cabin)",
                  background: filter === f ? "#7b39fc" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${filter === f ? "#7b39fc" : "rgba(255,255,255,0.08)"}`,
                  color: filter === f ? "white" : "rgba(255,255,255,0.45)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* === AGENT GRID === */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 md:px-8 pb-8">
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-[220px] rounded-[20px] animate-pulse" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {/* Build Your Own CTA */}
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.36,0.2,0.07,1] }}>
              <Link href="/app/builder" className="block h-full">
                <div className="h-full min-h-[200px] rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
                  style={{ background: "rgba(123,57,252,0.08)", backdropFilter: "blur(20px)", border: "1px dashed rgba(123,57,252,0.3)" }}>
                  <div className="h-12 w-12 rounded-[14px] flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ background: "rgba(123,57,252,0.2)", border: "1px solid rgba(123,57,252,0.3)" }}>
                    <Plus className="h-6 w-6" style={{ color: "#a78bfa" }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-[14px]" style={{ fontFamily: "var(--font-manrope)" }}>Build Your Own</p>
                    <p className="text-white/40 text-[12px] mt-1">Deploy custom strategy, earn creator fees</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                    style={{ color: "#a78bfa", fontFamily: "var(--font-cabin)" }}>
                    Go to Builder <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            </motion.div>

            {availableAgents.length > 0 ? (
              availableAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  id={`agent-${agent.id}`}
                  className={`scroll-mt-24 rounded-[20px] transition-all duration-500 ${
                    highlightedAgentId === agent.id
                      ? "ring-2 ring-purple-400/70 ring-offset-2 ring-offset-[#010101] shadow-[0_0_48px_-4px_rgba(168,85,247,0.55)]"
                      : "ring-0"
                  }`}
                >
                  <AgentCard
                    agent={agent}
                    index={index}
                    connectedAddress={address}
                    onSubscribe={handleOpenSubscribe}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-[20px] flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Activity className="w-7 h-7 text-white/20" />
                </div>
                <div className="text-center">
                  <p className="text-white/60 text-[15px] font-medium">No agents yet</p>
                  <p className="text-white/30 text-[13px] mt-1">Be the first to deploy a profitable strategy</p>
                </div>
                <Link href="/app/builder">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-white text-[14px] font-medium hover:opacity-90 transition-all"
                    style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}>
                    <Plus className="h-4 w-4" /> Build Agent
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === SUBSCRIBE DIALOG === */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px] overflow-hidden border-[rgba(164,132,215,0.2)]" aria-describedby={undefined}>
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: "linear-gradient(90deg, transparent, #7b39fc, transparent)" }} />
          <DialogHeader>
            <DialogTitle className="text-white text-[16px]" style={{ fontFamily: "var(--font-heading)" }}>
              Subscribe to {selectedAgent?.name}
            </DialogTitle>
            <DialogDescription className="text-white/40 text-[13px]">
              Deposit INIT to start earning. Withdraw anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Amount input */}
              <div className="grid gap-1.5">
                <label className="text-white/50 text-[12px]" style={{ fontFamily: "var(--font-manrope)" }}>Deposit Amount (INIT)</label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" />
                  <Button variant="outline" size="sm" className="border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]" onClick={() => setDepositAmount(initBalance.toFixed(6))}>Max</Button>
                </div>
              </div>

            {/* Revenue share */}
            <div className="rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ fontFamily: "var(--font-manrope)" }}>Revenue Share</p>
              <div className="space-y-2">
                {[
                  { color: "#52525b", label: "Protocol", value: "2%" },
                  { color: "#7b39fc", label: "Creator", value: "18%" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-white/50 text-[12px]">{item.label}</span>
                    </div>
                    <span className="text-white/70 text-[12px] font-mono">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FA93FA] to-[#983AD6]" />
                    <span className="text-white text-[12px] font-semibold">Your Share</span>
                  </div>
                  <span className="text-[18px] font-bold text-gradient">80%</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing || !depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full h-11 rounded-[10px] text-white text-[15px] font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}
            >
              {isSubscribing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                : <>Confirm Deposit <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
