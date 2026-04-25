"use client";

import { memo, useRef } from "react";
import { useUsernameQuery } from "@initia/interwovenkit-react";
import { useReadContract } from "wagmi";
import { AgentRegistryABI } from "@/lib/abis/AgentRegistry";
import {
  CONTRACTS,
  INITIA_EVM_CHAIN_ID,
  type DeployedAgent,
} from "@initia-agent/shared";
import { Button } from "@/components/ui/button";
import { Users, Wallet, Activity } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function isFullAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

interface AgentCardProps {
  agent: DeployedAgent;
  index: number;
  connectedAddress?: string;
  onSubscribe: (agent: DeployedAgent) => void;
}

interface OnChainAgentInfo {
  totalSubscribers?: number | bigint;
}

const STRATEGY_DOT: Record<string, string> = {
  DCA: "bg-purple-400/60",
  LP: "bg-pink-400/60",
  YIELD: "bg-amber-400/60",
  VIP: "bg-rose-400/60",
};

const STRATEGY_BADGE: Record<string, string> = {
  DCA: "text-purple-400 border-purple-500/20 bg-purple-500/[0.08]",
  LP: "text-pink-400 border-pink-500/20 bg-pink-500/[0.08]",
  YIELD: "text-amber-400 border-amber-500/20 bg-amber-500/[0.08]",
  VIP: "text-rose-400 border-rose-500/20 bg-rose-500/[0.08]",
};

function AgentCardComponent({ agent, index, connectedAddress, onSubscribe }: AgentCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isCardVisible = useInView(cardRef, { once: true, margin: "200px 0px" });
  const { data: creatorUsername } = useUsernameQuery(agent.creatorAddress);

  const { data: onChainInfo } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgentByVault",
    args: isFullAddress(agent.contractAddress)
      ? [agent.contractAddress as `0x${string}`]
      : undefined,
    chainId: INITIA_EVM_CHAIN_ID,
    query: { enabled: isCardVisible && isFullAddress(agent.contractAddress), staleTime: 60_000 },
  });

  const isOwn =
    !!connectedAddress &&
    !!agent.creatorAddress &&
    agent.creatorAddress.toLowerCase() === connectedAddress.toLowerCase();

  const parsedOnChain = (onChainInfo ?? null) as OnChainAgentInfo | null;
  // Creator counts as 1 depositor in the shared vault (auto-deposits on activation).
  // For the marketplace display, "subscribers" means OTHER people who subscribed,
  // so we always subtract the creator regardless of viewer identity.
  const rawSubscribers = parsedOnChain?.totalSubscribers != null ? Number(parsedOnChain.totalSubscribers) : 0;
  const subscribers = Math.max(0, rawSubscribers - 1);

  const dotColor = STRATEGY_DOT[agent.strategy] || STRATEGY_DOT.DCA;
  const badgeColor = STRATEGY_BADGE[agent.strategy] || STRATEGY_BADGE.DCA;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * (index + 1), ease: [0.36, 0.2, 0.07, 1] }}
      className="h-full"
    >
      <div className="h-full rounded-[18px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-300 flex flex-col overflow-hidden group">
        {/* Top bar */}
        <div className="px-4 pt-3.5 pb-0 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border ${badgeColor}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            {agent.strategy}
          </span>
          {isOwn && (
            <span className="text-[9px] font-medium text-purple-400/70 bg-purple-500/[0.07] border border-purple-500/15 px-1.5 py-0.5 rounded-full">
              Yours
            </span>
          )}
          {!isOwn && index === 0 && (
            <span className="text-[9px] font-medium text-amber-400/70 bg-amber-500/[0.07] border border-amber-500/15 px-1.5 py-0.5 rounded-full">
              New
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex-1">
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-zinc-100 leading-snug text-balance truncate">
              {agent.name}
            </h3>
            {creatorUsername && (
              <p className="text-[11px] truncate mt-0.5">
                <span className="text-purple-400/60 font-medium">{creatorUsername}</span>
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Capital", value: `${agent.initialCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Wallet, accent: true },
              { label: "Subs", value: String(subscribers), icon: Users },
              { label: "Status", value: agent.status, icon: Activity, dot: true },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[12px] bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] px-2 py-1.5">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wide block mb-0.5">{stat.label}</span>
                <span className={cn("text-[11px] font-mono font-semibold flex items-center gap-1", stat.accent ? "text-gradient" : "text-zinc-300")}>
                  {stat.dot && <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />}
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-3.5">
          {isOwn ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-[10px] text-[12px] h-8 text-purple-300 border-purple-500/20 hover:opacity-90" style={{ background: "#2b2344", fontFamily: "var(--font-cabin)" }}
              onClick={() => router.push("/app/dashboard")}
            >
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full rounded-[10px] text-[12px] h-8 text-white border-0 hover:opacity-90" style={{ background: "#7b39fc", fontFamily: "var(--font-cabin)" }}
              onClick={() => onSubscribe(agent)}
            >
              Subscribe
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const AgentCard = memo(
  AgentCardComponent,
  (prev, next) =>
    prev.index === next.index &&
    prev.connectedAddress === next.connectedAddress &&
    prev.onSubscribe === next.onSubscribe &&
    prev.agent.id === next.agent.id &&
    prev.agent.name === next.agent.name &&
    prev.agent.strategy === next.agent.strategy &&
    prev.agent.status === next.agent.status &&
    prev.agent.initialCapital === next.agent.initialCapital &&
    prev.agent.contractAddress === next.agent.contractAddress &&
    prev.agent.creatorAddress === next.agent.creatorAddress
);


