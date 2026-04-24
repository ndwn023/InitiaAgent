"use client";

import { useUsernameQuery } from "@initia/interwovenkit-react";
import { useReadContract } from "wagmi";
import { AgentRegistryABI } from "@/lib/abis/AgentRegistry";
import { CONTRACTS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Wallet, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { DeployedAgent } from "@/lib/hooks/use-agents";

const INITIA_CHAIN_ID = 2124225178762456;

function isFullAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

interface AgentCardProps {
  agent: DeployedAgent;
  index: number;
  connectedAddress?: string;
  onSubscribe: (agent: DeployedAgent) => void;
}

export function AgentCard({ agent, index, connectedAddress, onSubscribe }: AgentCardProps) {
  const router = useRouter();

  const { data: creatorUsername } = useUsernameQuery(agent.creatorAddress);

  const { data: onChainInfo } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgentByVault",
    args: isFullAddress(agent.contractAddress)
      ? [agent.contractAddress as `0x${string}`]
      : undefined,
    chainId: INITIA_CHAIN_ID,
    query: { enabled: isFullAddress(agent.contractAddress), staleTime: 30_000 },
  });

  const subscribers = onChainInfo ? Number((onChainInfo as any).totalSubscribers) : 0;

  const isOwn =
    !!connectedAddress &&
    !!agent.creatorAddress &&
    agent.creatorAddress.toLowerCase() === connectedAddress.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 * (index + 1), ease: [0.36, 0.2, 0.07, 1] }}
      className="h-full"
    >
      <div className="h-full rounded-[28px] bg-white/[0.02] border border-white/[0.04] p-[6px] transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] hover:border-white/[0.07] group">
        <div className="h-full rounded-[22px] bg-white/[0.02] border border-white/[0.03] flex flex-col overflow-hidden">
          <div className="p-6 flex-1">
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors duration-300 truncate">
                  {agent.name}
                </h3>
                {agent.roi && (
                  <span className="shrink-0 text-[10px] font-mono font-medium text-emerald-400 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    {agent.roi}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs truncate">
                {creatorUsername ? (
                  <span className="text-emerald-500/70 font-medium">{creatorUsername}</span>
                ) : (
                  <span className="text-zinc-600">{agent.contractAddress.substring(0, 10)}...</span>
                )}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <Badge>{agent.strategy}</Badge>
              {isOwn ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Your Agent
                </Badge>
              ) : (
                <Badge variant="outline">Managed</Badge>
              )}
              {index === 0 && !isOwn && (
                <Badge className="bg-amber-500/8 text-amber-400 border-amber-500/12">
                  Newest
                </Badge>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 rounded-[18px] bg-white/[0.02] p-4 border border-white/[0.03]">
              <div className="flex flex-col gap-1">
                <span className="flex items-center text-[11px] text-zinc-600">
                  <TrendingUp className="mr-1 h-3 w-3" /> Capital
                </span>
                <span className="font-mono text-base font-light text-emerald-400">
                  {agent.initialCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })} INIT
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center text-[11px] text-zinc-600">
                  <Wallet className="mr-1 h-3 w-3" /> Est. TVL
                </span>
                <span className="font-mono text-base font-light text-zinc-300">
                  ${(agent.initialCapital * 1.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center text-[11px] text-zinc-600">
                  <Users className="mr-1 h-3 w-3" /> Subscribers
                </span>
                <span className="font-mono text-base font-light text-zinc-300">
                  {subscribers}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center text-[11px] text-zinc-600">
                  <Activity className="mr-1 h-3 w-3" /> Status
                </span>
                <span className="font-mono text-sm text-emerald-400/70">
                  {agent.status}
                </span>
              </div>
            </div>
          </div>

          {/* Footer button */}
          <div className="p-6 pt-0">
            {isOwn ? (
              <Button
                variant="outline"
                className="w-full rounded-[16px] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/[0.06]"
                onClick={() => router.push("/app/dashboard")}
              >
                Manage Agent
              </Button>
            ) : (
              <Button
                className="w-full rounded-[16px]"
                onClick={() => onSubscribe(agent)}
              >
                Subscribe Agent
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
