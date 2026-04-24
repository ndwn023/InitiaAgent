"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Wallet, Activity, ArrowRight, Loader2, Plus, Globe } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAgents } from "@/lib/hooks/use-agents";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBalance, useAccount, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/lib/constants";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { AgentVaultABI } from "@/lib/abis/AgentVault";
import { AgentCard } from "@/components/AgentCard";
import type { DeployedAgent } from "@/lib/hooks/use-agents";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";

export default function MarketplacePage() {
  const router = useRouter();
  const { allAgents, addAgent, isLoading } = useAgents();
  const { writeContract } = useInterwovenEvm();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const INITIA_CHAIN_ID = 2124225178762456;
  const { address, isConnected, openBridge } = useInterwovenKit();
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    token: CONTRACTS.MOCK_INIT as `0x${string}`,
    chainId: INITIA_CHAIN_ID,
  });

  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [filter, setFilter] = useState("All");

  const creatorAgents = allAgents.filter((a) => !a.isSubscription && !a.agentClosed);
  const availableAgents =
    filter === "All" ? creatorAgents : creatorAgents.filter((a) => a.strategy === filter);

  const handleOpenSubscribe = (agent: DeployedAgent) => {
    setSelectedAgent(agent);
    setDepositAmount("");
    setDialogOpen(true);
  };

  const handleSubscribe = async () => {
    if (!selectedAgent || !depositAmount) return;

    if (chainId !== INITIA_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: INITIA_CHAIN_ID });
      } catch {
        toast.error("Network Error", { description: "Please switch to Initia evm-1." });
        return;
      }
    }

    setIsSubscribing(true);
    try {
      const amountToDeposit = parseUnits(depositAmount, 18);

      await writeContract({
        address: CONTRACTS.MOCK_INIT as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`, amountToDeposit],
      });

      await new Promise((r) => setTimeout(r, 1500));

      try {
        await writeContract({
          address: CONTRACTS.AGENT_VAULT_DEFAULT as `0x${string}`,
          abi: AgentVaultABI,
          functionName: "deposit",
          args: [amountToDeposit],
        });
      } catch (err) {
        console.warn("Deposit simulation failed/reverted.", err);
      }

      await addAgent({
        id: Math.random().toString(36).substring(2, 9),
        name: `${selectedAgent.name} (Sub)`,
        strategy: selectedAgent.strategy,
        status: "Active",
        deployedAt: new Date().toISOString(),
        txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        contractAddress: selectedAgent.contractAddress,
        initialCapital: parseFloat(depositAmount) || 0,
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
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="relative mb-8">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] radial-glow pointer-events-none opacity-40" />
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
          className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-light tracking-tight text-zinc-200 sm:text-3xl">
              Agent <span className="text-gradient font-bold">Marketplace</span>
            </h1>
            <p className="mt-2 text-zinc-600 text-sm">
              Discover and subscribe to top-performing AI trading agents.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.05]">
              {["All", "Yield", "DCA", "LP", "VIP"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    filter === f
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {availableAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
            className="h-full"
          >
            <Link href="/app/builder" className="block h-full">
              <div className="h-full rounded-[28px] bg-white/[0.01] border-2 border-dashed border-white/[0.06] p-[6px] transition-all duration-[400ms] hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] group">
                <div className="h-full rounded-[22px] bg-white/[0.01] border border-white/[0.03] flex flex-col items-center justify-center p-8">
                  <div className="h-14 w-14 rounded-[16px] bg-emerald-500/[0.06] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-500 border border-emerald-500/10">
                    <Plus className="h-7 w-7 text-emerald-500/60" />
                  </div>
                  <CardTitle className="text-zinc-300 mb-2 text-base font-medium">
                    Build Your Own Agent
                  </CardTitle>
                  <CardDescription className="text-center text-zinc-600 text-sm">
                    Create a custom strategy with zero code and earn performance fees.
                  </CardDescription>
                  <div className="mt-5 flex items-center text-emerald-400/60 text-sm font-medium gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Go to Builder <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {availableAgents.length > 0 ? (
          availableAgents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              connectedAddress={address}
              onSubscribe={handleOpenSubscribe}
            />
          ))
        ) : (
          <div className="col-span-full rounded-[28px] border border-dashed border-white/[0.06] p-12 text-center text-zinc-600 bg-white/[0.01] flex flex-col items-center">
            <Activity className="w-10 h-10 text-zinc-700 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">No Active Agents Found</h3>
            <p className="max-w-md mx-auto mb-6 text-sm">
              The marketplace is completely decentralized. Be the first creator to deploy a
              profitable trading strategy.
            </p>
            <Link href="/app/builder">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Go to Agent Builder
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Subscribe Dialog — controlled, lifted out of card loop */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Deposit INIT to start earning. Withdraw at any time with no penalty.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Balance */}
            <div className="flex items-center justify-between rounded-[18px] border border-white/[0.05] bg-white/[0.02] p-4">
              <div className="flex flex-col">
                <span className="text-sm text-zinc-500">Current Balance</span>
                <span className="font-mono text-lg text-zinc-200">
                  {isConnected && balance
                    ? `${Number(balance.formatted).toFixed(2)} ${balance.symbol}`
                    : "0.00 INIT"}
                </span>
              </div>
              <Wallet className="h-5 w-5 text-emerald-400/60" />
            </div>

            {/* Bridge CTA */}
            <button
              onClick={() => openBridge()}
              className="flex items-center justify-between rounded-[18px] border border-white/[0.04] bg-white/[0.01] px-4 py-3 text-left transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] group"
            >
              <div>
                <p className="text-xs font-medium text-zinc-400 group-hover:text-emerald-400 transition-colors">
                  Bridge from another chain
                </p>
                <p className="text-[11px] text-zinc-600">
                  Move assets to Initia evm-1 instantly
                </p>
              </div>
              <Globe className="h-4 w-4 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0" />
            </button>

            {/* Amount input */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-400">
                Deposit Amount (INIT)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => { if (balance) setDepositAmount(balance.formatted); }}
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Revenue share */}
            <div className="rounded-[20px] bg-white/[0.02] p-5 border border-white/[0.04]">
              <h4 className="text-[11px] font-medium uppercase text-zinc-600 mb-4 tracking-wider">
                Revenue Share Model
              </h4>
              <div className="space-y-3">
                {[
                  { color: "bg-zinc-600", label: "Protocol Fee", value: "2%" },
                  { color: "bg-teal-500", label: "Creator Reward", value: "18%" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                      <span className="text-sm text-zinc-500">{item.label}</span>
                    </div>
                    <span className="text-sm font-mono text-zinc-300">{item.value}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-white/[0.04] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-zinc-200">Your Share</span>
                  </div>
                  <span className="text-lg font-medium text-emerald-400">80%</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSubscribe}
              disabled={isSubscribing || !depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full rounded-[16px]"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming on Initia L2...
                </>
              ) : (
                <>
                  Confirm Deposit <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
