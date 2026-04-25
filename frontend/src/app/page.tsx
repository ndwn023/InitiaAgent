"use client";

import Link from "next/link";
import {
  ArrowRight, Bot, ShieldCheck, Zap, TrendingUp,
  Layers, Sparkles, ChevronRight
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { motion, useScroll, useTransform, useMotionValueEvent, useInView } from "framer-motion";
import { AutoSigningNavbar } from "@/components/AutoSigningNavbar";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { fetchAgentsList } from "@/lib/agents/api";
import { getOpenCreatorAgents } from "@initia-agent/shared";

// ─── Animated Counter ────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    if (target === 0) return;
    const t = target;
    const increment = t / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= t) { setCount(t); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, duration, target]);

  return { count, ref };
}

// ─── Strategy Marquee Items ───────────────────────────────────────────────────
const MARQUEE = [
  "DCA Strategy", "Yield Farming", "LP Rebalancing", "Auto-Compound",
  "Smart DCA", "VIP Maximizer", "Cross-chain Swap", "Risk Management",
  "AI Signal Trading", "Portfolio Optimizer", "Liquidity Mining", "Flash Loan Arb",
];

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    icon: Layers,
    title: "Choose Strategy",
    desc: "Pick from DCA, LP Rebalancing, Yield Optimizer, or VIP — each tuned for different risk profiles.",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "AI Market Analysis",
    desc: "Our AI engine analyzes on-chain signals, liquidity depth, and volatility before you commit a single token.",
  },
  {
    num: "03",
    icon: TrendingUp,
    title: "Deploy & Earn 24/7",
    desc: "Fund your vault, set limits, and let the agent execute autonomously — zero-friction, fully non-custodial.",
  },
];

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Non-Custodial",
    desc: "Agents operate within strict parameters. Your keys, your funds, always.",
    color: "rgba(201,103,232,0.15)",
  },
  {
    icon: Bot,
    title: "Autonomous AI",
    desc: "Deploy agents that execute your strategy 24/7, powered by Claude & Gemini.",
    color: "rgba(250,147,250,0.12)",
  },
  {
    icon: Zap,
    title: "Interwoven Economy",
    desc: "Seamlessly interact with the full Initia ecosystem through a single interface.",
    color: "rgba(152,58,214,0.15)",
  },
];

// ─── Trust Partners ────────────────────────────────────────────────────────────
const PARTNERS = ["Initia", "Gemini AI", "Move VM", "EVM Layer", "Interwoven Kit"];

// ─── Mini chart data (static, no re-computation) ──────────────────────────────
const MINI_CHART = [35, 50, 42, 58, 48, 65, 60, 75, 70, 82, 76, 90];

export default function LandingPage() {
  const { isConnected, openConnect } = useInterwovenKit();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 350], [1, 0.97]);
  const heroY = useTransform(scrollY, [0, 350], [0, 30]);

  useMotionValueEvent(scrollY, "change", (v) => {
    const next = v > 20;
    if (next !== scrolledRef.current) {
      scrolledRef.current = next;
      setScrolled(next);
    }
  });

  const scrollToSection = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch live stats — single fetch, memoized calculation
  const [liveStats, setLiveStats] = useState({ deposited: 0, agents: 0 });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadLiveStats = async (attempt = 0) => {
      try {
        const allAgents = await fetchAgentsList({ limit: 300, scope: "marketplace", signal: controller.signal });
        if (cancelled) return;

        const creators = getOpenCreatorAgents(allAgents);
        setLiveStats({
          deposited: Math.round(creators.reduce((sum, agent) => sum + (agent.initialCapital || 0), 0)),
          agents: creators.length,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError" || cancelled) return;
        const retryMs = Math.min(2_000 * (attempt + 1), 10_000);
        retryTimer = setTimeout(() => {
          void loadLiveStats(attempt + 1);
        }, retryMs);
      }
    };

    void loadLiveStats();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const stat1 = useCountUp(liveStats.deposited, 2000);
  const stat2 = useCountUp(liveStats.agents, 1500);
  const stat3 = useCountUp(4, 1200);
  const stat4 = useCountUp(99, 1800);

  // Memoize stats array to prevent unnecessary re-renders
  const statsData = useMemo(() => [
    { label: "Total Deposited", value: stat1.count, suffix: " INIT", ref: stat1.ref },
    { label: "Agents Deployed", value: stat2.count, suffix: "", ref: stat2.ref },
    { label: "Strategy Types", value: stat3.count, suffix: "", ref: stat3.ref },
    { label: "Uptime", value: stat4.count, suffix: "%", ref: stat4.ref },
  ], [stat1.count, stat2.count, stat3.count, stat4.count, stat1.ref, stat2.ref, stat3.ref, stat4.ref]);

  const handleLaunchApp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isConnected) openConnect();
    else router.push("/app/marketplace");
  }, [isConnected, openConnect, router]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen flex-col text-zinc-50 overflow-hidden"
      style={{ background: "#010101" }}
    >
      <AnimatedBackground />

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex h-[52px] w-[calc(100%-32px)] max-w-[960px] items-center justify-between px-4 md:px-5 rounded-2xl transition-all duration-300 ${scrolled
          ? "bg-[rgba(3,1,10,0.88)] backdrop-blur-2xl border border-white/[0.10] shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5)]"
          : "bg-[rgba(3,1,10,0.50)] backdrop-blur-xl border border-white/[0.07]"
          }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="InitiaAgent"
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-7" style={{ fontFamily: "var(--font-manrope)" }}>
          <Link href="#features" onClick={(e) => scrollToSection(e, "features")} className="text-[14px] font-medium text-white/70 hover:text-white transition-colors duration-200">
            Features
          </Link>
          <Link href="#how-it-works" onClick={(e) => scrollToSection(e, "how-it-works")} className="text-[14px] font-medium text-white/70 hover:text-white transition-colors duration-200">
            How It Works
          </Link>
          {isConnected && (
            <Link href="/app/marketplace" className="text-[14px] font-medium text-white/70 hover:text-white transition-colors duration-200">
              Marketplace
            </Link>
          )}
          <a
            href="https://initiaagent-docs.gitbook.io/initiaagent-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-medium text-white/70 hover:text-white transition-colors duration-200"
          >
            Docs
          </a>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-manrope)" }}>
          <AutoSigningNavbar />
          {!isConnected ? (
            <button
              onClick={handleLaunchApp}
              className="hidden sm:flex items-center gap-2 px-4 h-9 rounded-[8px] border text-[14px] font-semibold transition-all duration-200 hover:bg-white/90"
              style={{ background: "rgba(255,255,255,0.93)", borderColor: "rgba(200,200,210,0.6)", color: "#0a0a0a" }}
            >
              Sign In
            </button>
          ) : null}
          <button
            onClick={handleLaunchApp}
            className="flex items-center gap-1.5 px-4 h-9 rounded-[8px] text-white text-[14px] font-semibold transition-all duration-200 hover:opacity-90"
            style={{ background: "#7b39fc" }}
          >
            {!isConnected ? (
              <><Zap size={13} /> Connect</>
            ) : (
              <>Enter App <ArrowRight size={13} /></>
            )}
          </button>
        </div>
      </motion.header>

      <main className="relative z-10 flex-1 pt-16">

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="relative flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-5 text-center overflow-hidden"
        >
          {/* Purple grid bg */}
          <div className="absolute top-0 left-0 right-0 h-[60%] perspective-grid pointer-events-none opacity-60" />

          {/* Radial purple glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse 55% 40% at 50% 0%, rgba(201,103,232,0.12) 0%, transparent 70%)" }}
          />

          {/* Tagline pill — glassmorphism */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
            className="flex items-center gap-2.5 h-[38px] px-3 rounded-[10px] mb-8 cursor-default"
            style={{
              background: "rgba(85,80,110,0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(164,132,215,0.5)",
              fontFamily: "var(--font-manrope)",
            }}
          >
            <span className="flex items-center justify-center px-2 h-6 rounded-[6px] text-white text-[12px] font-semibold" style={{ background: "#7b39fc" }}>
              New
            </span>
            <span className="text-white text-[14px] font-medium">
              Live on Initia evm-1 · Non-custodial AI Agents
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-purple-300 font-medium ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              Live
            </span>
          </motion.div>

          {/* Main headline — Instrument Serif */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.36, 0.2, 0.07, 1] }}
            className="relative max-w-4xl text-[clamp(44px,6.5vw,96px)] text-white mb-6"
            style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}
          >
            <span className="block">Your DeFi Vision,</span>
            <span className="block"><em>and</em> Our Digital Reality.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.36, 0.2, 0.07, 1] }}
            className="max-w-[662px] text-[18px] text-white/70 leading-relaxed mb-10"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Deploy autonomous AI agents to manage your DeFi strategies on Initia.
            From smart DCA to yield farming — let AI optimize your portfolio 24/7.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.36, 0.2, 0.07, 1] }}
            className="flex flex-col sm:flex-row items-center gap-3 mb-16"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            <button
              onClick={handleLaunchApp}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-[10px] text-white text-[16px] font-medium transition-all duration-200 hover:opacity-90 shadow-[0_4px_24px_-4px_rgba(123,57,252,0.5)]"
              style={{ background: "#7b39fc" }}
            >
              <Bot size={16} />
              Explore Agents
            </button>

            <button
              onClick={handleLaunchApp}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-[10px] text-[#f6f7f9] text-[16px] font-medium transition-all duration-200 hover:brightness-110 border border-white/[0.08]"
              style={{ background: "#2b2344" }}
            >
              <ArrowRight size={16} />
              Get Started Now
            </button>
          </motion.div>

          {/* Live stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-6 md:gap-10 text-center"
          >
            {statsData.map((s, i) => (
              <div key={i} ref={s.ref} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-gradient font-mono">
                  {s.value.toLocaleString()}{s.suffix}
                </span>
                <span className="text-[11px] text-zinc-600 uppercase tracking-wider mt-0.5">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── STRATEGY TICKER ──────────────────────────────────────────────── */}
        <div className="relative py-5 border-y border-white/[0.04] overflow-hidden bg-white/[0.01]">
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#010101] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#010101] to-transparent z-10 pointer-events-none" />
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="marquee-content" aria-hidden={copy === 1}>
                {MARQUEE.map((item, i) => (
                  <span key={`${copy}-${i}`} className="inline-flex items-center gap-2.5 text-[13px] text-zinc-600 font-medium whitespace-nowrap">
                    <span className="h-1 w-1 rounded-full bg-purple-500/40 shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS — STEP-BY-STEP ─────────────────────────────────── */}
        <motion.section
          id="how-it-works"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.36, 0.2, 0.07, 1] }}
          className="px-4 md:px-6 py-24 md:py-28"
        >
          <div className="mx-auto max-w-5xl">
            {/* Section label */}
            <div className="text-center mb-14">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-500 mb-3">
                Agent Workflow
              </p>
              <h2 className="text-3xl md:text-5xl text-white mb-4" style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
                Deploy in <span className="text-gradient">3 steps</span>
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto text-base font-light">
                From strategy selection to live execution — under 5 minutes.
              </p>
            </div>

            {/* Two-column: steps left, preview right */}
            <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-start">

              {/* Steps */}
              <div className="space-y-4">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15 * i, duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
                      className="group relative"
                    >
                      <div className="glass-card p-5 flex gap-4 hover:border-purple-500/20 transition-all duration-300">
                        <div className="shrink-0 flex flex-col items-center gap-2">
                          <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#FA93FA]/10 to-[#983AD6]/10 border border-purple-500/15 flex items-center justify-center group-hover:from-[#FA93FA]/20 group-hover:to-[#983AD6]/20 transition-all duration-300">
                            <Icon className="h-5 w-5 text-purple-400" />
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className="w-[1px] h-8 bg-gradient-to-b from-purple-500/30 to-transparent" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-purple-500/60">{step.num}</span>
                            <h3 className="text-[15px] font-semibold text-zinc-100">{step.title}</h3>
                          </div>
                          <p className="text-[13px] text-zinc-500 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* CTA under steps */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="pt-2"
                >
                  <button
                    onClick={handleLaunchApp}
                    className="flex items-center gap-2 px-8 h-12 rounded-[10px] text-white text-[16px] font-medium hover:opacity-90 transition-all duration-200 shadow-[0_4px_24px_-4px_rgba(123,57,252,0.4)]"
                    style={{ background: "#7b39fc", fontFamily: "var(--font-manrope)" }}
                  >
                    Start Building <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </motion.div>
              </div>

              {/* Live agent preview card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
                style={{ animation: "float 6s ease-in-out infinite" }}
              >
                <div className="gradient-border glow-purple">
                  <div className="relative p-6 overflow-hidden">
                    <div className="absolute inset-0 noise-overlay pointer-events-none opacity-20" />

                    {/* Card header */}
                    <div className="relative flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 px-3 rounded-[12px] bg-gradient-to-br from-[#FA93FA]/15 to-[#983AD6]/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/logo.svg" alt="InitiaAgent" className="h-5 w-auto" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-zinc-100">INIT Accumulator</div>
                          <div className="text-[11px] text-zinc-500">DCA Strategy · evm-1</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-green-500/10 border border-green-500/15">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400 font-semibold">LIVE</span>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="relative grid grid-cols-3 gap-2 mb-5">
                      {[
                        { label: "Capital", value: "500 INIT" },
                        { label: "Profit", value: "+12.4%", accent: true },
                        { label: "Next Run", value: "2h 15m" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-[12px] bg-white/[0.03] border border-white/[0.05] p-3">
                          <div className="text-[10px] text-zinc-600 mb-1">{s.label}</div>
                          <div className={`text-[13px] font-mono font-medium ${s.accent ? "text-gradient" : "text-zinc-200"}`}>
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mini chart — static bars, no motion.div per bar */}
                    <div className="relative flex items-end gap-1 h-14 mb-4">
                      {MINI_CHART.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-[3px] transition-all"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, rgba(201,103,232,${0.2 + (h / 90) * 0.4}), rgba(250,147,250,${0.1 + (h / 90) * 0.3}))`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="relative flex justify-between items-center text-[11px] text-zinc-600">
                      <span className="font-mono">Interval: 4h</span>
                      <span className="text-purple-400/60 font-medium">Powered by Claude AI</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <motion.section
          id="features"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="px-4 md:px-6 pb-24 md:pb-28"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-500 mb-3">Ecosystem</p>
              <h2 className="text-3xl md:text-5xl text-white mb-4" style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
                Powerful <span className="text-gradient">Core</span> Features
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-base font-light">
                Everything you need to automate your DeFi journey on the Interwoven Economy.
              </p>
            </div>

            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.12 } }
              }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3"
            >
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.36, 0.2, 0.07, 1] } }
                    }}
                    className="group"
                  >
                    <div className="gradient-border h-full hover:shadow-[0_0_40px_-15px_rgba(201,103,232,0.3)] transition-all duration-500">
                      <div className="relative p-6 flex flex-col items-center text-center overflow-hidden rounded-[23px]">
                        {/* Hover color wash */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[23px]"
                          style={{ background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${f.color}, transparent)` }}
                        />
                        {/* Icon */}
                        <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/[0.04] border border-white/[0.06] text-zinc-400 transition-all duration-300 group-hover:text-purple-300 group-hover:bg-purple-500/[0.08] group-hover:border-purple-500/15 group-hover:shadow-[0_0_24px_-8px_rgba(201,103,232,0.3)]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="relative mb-2 text-[15px] font-semibold text-zinc-100 tracking-tight">{f.title}</h3>
                        <p className="relative text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        {/* ── PARTNER CLOUD ─────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="px-4 md:px-6 pb-20 border-t border-white/[0.04] pt-12"
        >
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-zinc-600 whitespace-nowrap shrink-0">
                Powered by
              </p>
              <div className="hidden md:block w-[1px] h-8 bg-white/[0.06]" />
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-10 gap-y-4 flex-1">
                {PARTNERS.map((p) => (
                  <span key={p} className="text-zinc-600 text-sm font-semibold hover:text-purple-400 transition-colors duration-200 cursor-default tracking-tight">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
          className="px-4 md:px-6 pb-24 md:pb-32"
        >
          <div className="mx-auto max-w-3xl">
            <div className="purple-border">
              <div className="relative rounded-[20px] p-8 md:p-12 text-center overflow-hidden"
                style={{ background: "rgba(15,10,30,0.6)", backdropFilter: "blur(40px)" }}>
                {/* Glow */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,103,232,0.12) 0%, transparent 70%)" }}
                />
                <div className="absolute inset-0 noise-overlay pointer-events-none opacity-20" />

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-500 mb-4">Get Started</p>
                  <h2 className="text-2xl md:text-4xl text-white mb-4" style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
                    Automate your{" "}
                    <span className="text-gradient">DeFi strategy</span>
                    {" "}today
                  </h2>
                  <p className="text-zinc-400 mb-8 max-w-md mx-auto font-light text-[15px]">
                    No code required. Deploy your first AI agent in under 5 minutes.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3" style={{ fontFamily: "var(--font-manrope)" }}>
                    <button
                      onClick={handleLaunchApp}
                      className="flex items-center justify-center gap-2 px-8 h-12 rounded-[10px] text-white text-[16px] font-medium transition-all duration-200 hover:opacity-90 shadow-[0_4px_24px_-4px_rgba(123,57,252,0.5)]"
                      style={{ background: "#7b39fc" }}
                    >
                      Launch App <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                    <a
                      href="https://initiaagent-docs.gitbook.io/initiaagent-docs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-12 rounded-[10px] text-[#f6f7f9] text-[16px] font-medium border border-white/[0.08] hover:brightness-110 transition-all duration-200" style={{ background: "#2b2344" }}>
                        Read Docs
                      </button>
                    </a>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="InitiaAgent"
              className="h-8 w-auto opacity-80"
            />
            <div className="flex flex-wrap justify-center gap-8 text-[13px] text-zinc-600">
              <a
                href="https://initiaagent-docs.gitbook.io/initiaagent-docs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition-colors duration-200"
              >
                Documentation
              </a>
              <Link href="#" className="hover:text-zinc-300 transition-colors duration-200">Twitter</Link>
              <Link href="#" className="hover:text-zinc-300 transition-colors duration-200">Discord</Link>
              <Link href="#" className="hover:text-zinc-300 transition-colors duration-200">Github</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="text-[11px] text-zinc-600">Built with ❤️ by <span className="text-zinc-400 font-medium">3S DW</span></div>
              <div className="text-[10px] text-zinc-700">© 2026 InitiaAgent · INITIATE Season 1</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
