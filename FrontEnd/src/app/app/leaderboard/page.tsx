"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useReadContract } from "wagmi";
import { useUsernameQuery } from "@initia/interwovenkit-react";
import { AgentRegistryABI } from "@/lib/abis/AgentRegistry";
import { CONTRACTS } from "@/lib/constants";
import type { DeployedAgent } from "@/lib/hooks/use-agents";

const INITIA_CHAIN_ID = 2124225178762456;

function isFullAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

const RANK_STYLES = [
  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "text-zinc-300 bg-zinc-500/10 border-zinc-500/20",
  "text-orange-400 bg-orange-500/10 border-orange-500/20",
];
const RANK_EMOJI = ["🥇", "🥈", "🥉"];

function LeaderboardRow({ agent, rank }: { agent: DeployedAgent; rank: number }) {
  const { data: creatorUsername } = useUsernameQuery(agent.creatorAddress);

  const { data: onChainInfo } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgentByVault",
    args: isFullAddress(agent.contractAddress)
      ? [agent.contractAddress as `0x${string}`]
      : undefined,
    chainId: INITIA_CHAIN_ID,
    query: { enabled: isFullAddress(agent.contractAddress) && !agent.isDemo, staleTime: 30_000 },
  });

  const subscribers = onChainInfo ? Number((onChainInfo as any).totalSubscribers) : 0;
  const isTop3 = rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.06 * rank, ease: [0.36, 0.2, 0.07, 1] }}
      className={`rounded-[20px] border p-4 flex items-center gap-4 transition-all duration-300 hover:border-white/[0.08] ${
        isTop3
          ? "bg-white/[0.03] border-white/[0.06]"
          : "bg-white/[0.01] border-white/[0.03]"
      }`}
    >
      {/* Rank badge */}
      <div
        className={`shrink-0 w-10 h-10 rounded-[12px] border flex items-center justify-center text-sm font-bold ${
          isTop3
            ? RANK_STYLES[rank - 1]
            : "text-zinc-600 bg-white/[0.02] border-white/[0.04]"
        }`}
      >
        {isTop3 ? RANK_EMOJI[rank - 1] : `#${rank}`}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-zinc-200 truncate">{agent.name}</span>
          <Badge className="text-[9px] py-0 shrink-0">{agent.strategy}</Badge>
          {agent.isDemo && (
            <Badge className="text-[9px] py-0 shrink-0 bg-violet-500/10 text-violet-400 border-violet-500/20">
              Featured
            </Badge>
          )}
        </div>
        <p className="text-xs truncate">
          {creatorUsername ? (
            <span className="text-emerald-500/70 font-medium">{creatorUsername}</span>
          ) : (
            <span className="text-zinc-600 font-mono">{agent.creatorAddress?.substring(0, 14)}...</span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">ROI</div>
          <div className={`text-sm font-mono font-medium ${
            (agent.roi ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            {agent.roi != null ? `+${agent.roi.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">Win Rate</div>
          <div className="text-sm font-mono text-zinc-300">
            {agent.winRate != null ? `${agent.winRate}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">Trades</div>
          <div className="text-sm font-mono text-zinc-300">
            {agent.totalTrades ?? (agent.isDemo ? "—" : subscribers)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">Status</div>
          <div className="text-[11px] font-medium text-emerald-400/80">{agent.status}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DeployedAgent[]) => {
        const sorted = data
          .filter((a) => !a.isSubscription && !a.agentClosed)
          .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
        setAgents(sorted);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const { data: onChainCount } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "agentCount",
    chainId: INITIA_CHAIN_ID,
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="relative mb-8">
        <div className="absolute -top-20 left-1/3 w-[400px] h-[250px] radial-glow pointer-events-none opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
          className="relative flex items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-light tracking-tight text-zinc-200 sm:text-3xl">
              Agent <span className="text-gradient font-bold">Leaderboard</span>
            </h1>
            <p className="mt-2 text-zinc-600 text-sm">
              Top agents ranked by ROI performance on Initia evm-1.
            </p>
          </div>
          {onChainCount !== undefined && (
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">On-chain</div>
              <div className="text-lg font-mono text-zinc-300">
                {Number(onChainCount)}{" "}
                <span className="text-xs text-zinc-600">agents</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Column headers */}
      {!isLoading && agents.length > 0 && (
        <div className="flex items-center gap-4 px-4 mb-3">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-[10px] text-zinc-700 uppercase tracking-wider">Agent</div>
          <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
            <div className="w-14 text-[10px] text-zinc-700 uppercase tracking-wider">ROI</div>
            <div className="w-16 text-[10px] text-zinc-700 uppercase tracking-wider">Win Rate</div>
            <div className="w-12 text-[10px] text-zinc-700 uppercase tracking-wider">Trades</div>
            <div className="w-12 text-[10px] text-zinc-700 uppercase tracking-wider">Status</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[72px] rounded-[20px] bg-white/[0.02] border border-white/[0.03] animate-pulse"
            />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/[0.06] p-12 text-center">
          <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-600 text-sm">
            No agents deployed yet. Be the first to claim{" "}
            <span className="text-amber-400">🥇</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, i) => (
            <LeaderboardRow key={agent.id} agent={agent} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
