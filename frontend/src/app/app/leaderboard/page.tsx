"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { useUsernameQuery } from "@initia/interwovenkit-react";
import { AgentRegistryABI } from "@/lib/abis/AgentRegistry";
import {
  CONTRACTS,
  INITIA_EVM_CHAIN_ID,
  getOpenCreatorAgents,
  type DeployedAgent,
} from "@initia-agent/shared";
import { fetchAgentsList } from "@/lib/agents/api";
import { MedalIcon } from "@/components/leaderboard/MedalIcon";

// ─── Podium theme (fallback colors + per-rank design tokens) ──────────────────

const PODIUM_THEMES = [
  {
    rank: 1 as const,
    label: "1st",
    accent: "#fbbf24",
    accentSoft: "rgba(251,191,36,0.18)",
    ring: "rgba(251,191,36,0.35)",
    glow: "0 20px 60px -20px rgba(251,191,36,0.45)",
    numberColor: "#5a3500",
    numberShadow: "0 1px 0 rgba(255,240,180,0.65), 0 2px 3px rgba(122,74,0,0.4)",
    offsetClass: "md:-translate-y-3",
  },
  {
    rank: 2 as const,
    label: "2nd",
    accent: "#e2e8f0",
    accentSoft: "rgba(226,232,240,0.15)",
    ring: "rgba(226,232,240,0.22)",
    glow: "0 16px 40px -18px rgba(226,232,240,0.25)",
    numberColor: "#3a4250",
    numberShadow: "0 1px 0 rgba(255,255,255,0.7), 0 2px 3px rgba(74,85,104,0.35)",
    offsetClass: "md:translate-y-3",
  },
  {
    rank: 3 as const,
    label: "3rd",
    accent: "#fb923c",
    accentSoft: "rgba(251,146,60,0.15)",
    ring: "rgba(251,146,60,0.22)",
    glow: "0 16px 40px -18px rgba(251,146,60,0.28)",
    numberColor: "#4a1f00",
    numberShadow: "0 1px 0 rgba(255,210,160,0.6), 0 2px 3px rgba(91,40,0,0.4)",
    offsetClass: "md:translate-y-5",
  },
] as const;

// Order used for the centered podium layout: 2nd · 1st · 3rd.
const PODIUM_LAYOUT = [PODIUM_THEMES[1], PODIUM_THEMES[0], PODIUM_THEMES[2]];

function isFullAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  agent,
  theme,
  index,
}: {
  agent: DeployedAgent;
  theme: (typeof PODIUM_THEMES)[number];
  index: number;
}) {
  const isFirst = theme.rank === 1;
  const medalSize = isFirst ? 88 : 76;

  return (
    // Outer wrapper holds the entrance animation + podium offset.
    // Keep transform on the SINGLE inner motion div so hover scales medal and
    // card together as one unit — no more mis-aligned cut on hover.
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.08 + index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`relative ${theme.offsetClass}`}
    >
      <Link
        href={`/app/marketplace#agent-${agent.id}`}
        className="block"
        prefetch={false}
      >
        <motion.div
          whileHover={{ y: -6, scale: 1.035 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="relative transform-gpu will-change-transform"
        >
          {/* Medal — rendered above the card. `z-10` is essential: the card
              body is a later DOM sibling, so without a stacking boost the
              card paints over the bottom portion of the disc (which is where
              our negative marginBottom makes the medal overlap the card).
              No overflow:hidden on any ancestor up to the scaling motion.div,
              so shadows and hover scale are never clipped. */}
          <div
            className="relative z-10 flex justify-center pointer-events-none"
            style={{ marginBottom: -medalSize / 3 }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.2 + index * 0.1,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="relative flex items-center justify-center"
              style={{
                width: medalSize,
                height: medalSize,
              }}
            >
              {/* Soft halo so the medal reads well against any background */}
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: theme.accentSoft }}
              />
              {/* SVG medal — ribbon + gradient disc + orbiting sparkles */}
              <MedalIcon rank={theme.rank} />
              {/* Rank numeral — engraved on the medal face. Positioned above
                  the SVG via absolute, non-interactive so the Link still
                  receives clicks. The SVG viewBox is centered on the disc,
                  so inset-0 centering lands the digit exactly on the disc. */}
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none font-black"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: isFirst ? 40 : 34,
                  color: theme.numberColor,
                  textShadow: theme.numberShadow,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {theme.rank}
              </span>
            </motion.div>
          </div>

          {/* Card body. Only this inner element clips its own radial glow —
              nothing above it is inside an overflow:hidden scope, so the
              medal hovers freely. */}
          <div
            className="relative rounded-[22px] pb-5 px-4 text-center overflow-hidden"
            style={{
              paddingTop: medalSize / 2 + 6,
              background: `linear-gradient(180deg, ${theme.accentSoft} 0%, rgba(255,255,255,0.03) 70%)`,
              backdropFilter: "blur(24px)",
              border: `1px solid ${theme.ring}`,
              boxShadow: theme.glow,
            }}
          >
            {/* Ambient glow pulse — only for #1 */}
            {isFirst && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.22), transparent 60%)",
                }}
              />
            )}

            {/* Shimmer sweep — only for #1 */}
            {isFirst && (
              <motion.div
                className="absolute inset-y-0 w-[40%] pointer-events-none"
                initial={{ x: "-120%" }}
                animate={{ x: "320%" }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                }}
              />
            )}

            <div className="relative">
              <p
                className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-1"
                style={{ color: theme.accent, fontFamily: "var(--font-manrope)" }}
              >
                {theme.label} place
              </p>
              <p
                className="text-white font-bold truncate"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: isFirst ? "15px" : "13px",
                }}
                title={agent.name}
              >
                {agent.name}
              </p>
              <p
                className="text-[11px] mt-1 font-mono"
                style={{ color: theme.accent, opacity: 0.9 }}
              >
                {agent.initialCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })} INIT
              </p>
              <span
                className="mt-3 inline-block text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                style={{
                  background: "rgba(123,57,252,0.18)",
                  border: "1px solid rgba(123,57,252,0.28)",
                  color: "#c4b5fd",
                  fontFamily: "var(--font-cabin)",
                }}
              >
                {agent.strategy}
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── List row (rank 4+) ───────────────────────────────────────────────────────

function LeaderboardRow({ agent, rank }: { agent: DeployedAgent; rank: number }) {
  const { data: creatorUsername } = useUsernameQuery(agent.creatorAddress);

  const { data: onChainInfo } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY,
    abi: AgentRegistryABI,
    functionName: "getAgentByVault",
    args: isFullAddress(agent.contractAddress)
      ? [agent.contractAddress as `0x${string}`]
      : undefined,
    chainId: INITIA_EVM_CHAIN_ID,
    query: { enabled: isFullAddress(agent.contractAddress), staleTime: 30_000 },
  });

  // Creator auto-deposits on activation, counted in totalSubscribers — subtract 1.
  const rawSubscribers = onChainInfo
    ? Number((onChainInfo as { totalSubscribers?: number | bigint }).totalSubscribers ?? 0)
    : 0;
  const subscribers = Math.max(0, rawSubscribers - 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(0.02 * rank, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="relative"
    >
      <Link
        href={`/app/marketplace#agent-${agent.id}`}
        className="block rounded-[16px] transition-all duration-300
                   hover:border-white/[0.18] hover:bg-white/[0.06]
                   hover:shadow-[0_12px_32px_-16px_rgba(123,57,252,0.35)]"
        style={{
          background: "rgba(255,255,255,0.035)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="p-3.5 flex items-center gap-4">
          {/* Rank chip */}
          <div
            className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center
                       text-[12px] font-bold text-zinc-500 border border-white/[0.06]
                       transition-colors duration-300 group-hover:text-white"
            style={{ background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-cabin)" }}
          >
            #{rank}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white truncate">{agent.name}</span>
              <span
                className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: "rgba(123,57,252,0.15)",
                  border: "1px solid rgba(123,57,252,0.25)",
                  color: "#a78bfa",
                  fontFamily: "var(--font-cabin)",
                }}
              >
                {agent.strategy}
              </span>
            </div>
            <p className="text-[11px] mt-0.5 truncate">
              {creatorUsername ? (
                <span style={{ color: "#a78bfa" }} className="font-medium">
                  {creatorUsername}
                </span>
              ) : (
                <span className="text-white/30 font-mono">
                  {agent.creatorAddress?.slice(0, 12)}…
                </span>
              )}
            </p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
            <div>
              <div
                className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Capital
              </div>
              <div className="text-[12px] font-mono text-gradient font-semibold">
                {agent.initialCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div
                className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Subs
              </div>
              <div className="text-[12px] font-mono text-white/70">{subscribers}</div>
            </div>
            <div>
              <div
                className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Status
              </div>
              <div className="text-[11px] font-medium" style={{ color: "#a78bfa" }}>
                {agent.status}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const allAgents = await fetchAgentsList({
          limit: 500,
          scope: "marketplace",
          signal: controller.signal,
        });
        if (cancelled) return;

        const sorted = getOpenCreatorAgents(allAgents).sort(
          (a, b) => b.initialCapital - a.initialCapital,
        );
        setAgents(sorted);
      } catch {
        // no-op: keep empty fallback UI
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const { data: onChainCount } = useReadContract({
    address: CONTRACTS.AGENT_REGISTRY,
    abi: AgentRegistryABI,
    functionName: "agentCount",
    chainId: INITIA_EVM_CHAIN_ID,
  });

  const topThree = agents.slice(0, 3);
  const rest = agents.slice(3);

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-4rem)] lg:overflow-hidden pb-24 md:pb-0">
      {/* === HERO HEADER === */}
      <div className="shrink-0 px-5 md:px-8 pt-6 md:pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 h-8 rounded-[8px] mb-4 text-[13px] font-medium"
            style={{
              background: "rgba(123,57,252,0.15)",
              border: "1px solid rgba(123,57,252,0.3)",
              fontFamily: "var(--font-cabin)",
              color: "#a78bfa",
            }}
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </div>
          <h1
            className="text-[2rem] md:text-[2.5rem] text-white mb-1"
            style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}
          >
            Top Performing <span className="text-gradient">Agents</span>
          </h1>
          <p
            className="text-white/50 text-[14px]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Ranked by capital deployed on Initia evm-1
            {onChainCount !== undefined && (
              <span className="ml-2 text-[#a78bfa]">· {Number(onChainCount)} on-chain</span>
            )}
          </p>
        </motion.div>
      </div>

      {/* === CONTENT === */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 md:px-8 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[72px] rounded-[18px] animate-pulse"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="h-16 w-16 rounded-[20px] flex items-center justify-center"
              style={{
                background: "rgba(123,57,252,0.1)",
                border: "1px solid rgba(123,57,252,0.2)",
              }}
            >
              <Trophy className="w-8 h-8" style={{ color: "#7b39fc" }} />
            </div>
            <div className="text-center">
              <p className="text-white/60 text-[15px] font-medium">No agents yet</p>
              <p className="text-white/30 text-[13px] mt-1">Be the first to claim the podium</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Podium (Top 3) */}
            {topThree.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 md:gap-5 mb-10 pt-12 items-end">
                {PODIUM_LAYOUT.map((theme, idx) => {
                  const agent = agents[theme.rank - 1];
                  if (!agent) return <div key={theme.rank} />;
                  return (
                    <PodiumCard
                      key={agent.id}
                      agent={agent}
                      theme={theme}
                      index={idx}
                    />
                  );
                })}
              </div>
            )}

            {/* List */}
            <div className="space-y-2">
              {topThree.length >= 3
                ? rest.map((agent, i) => (
                    <LeaderboardRow key={agent.id} agent={agent} rank={i + 4} />
                  ))
                : agents.map((agent, i) => (
                    <LeaderboardRow key={agent.id} agent={agent} rank={i + 1} />
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
