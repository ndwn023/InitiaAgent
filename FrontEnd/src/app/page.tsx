"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, ShieldCheck, Zap, TrendingUp, Users, Layers, Cpu, BarChart3, Lock, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { TypewriterHeadline } from "@/components/ui/typewriter-headline";
import { motion, useScroll, useTransform, useMotionValueEvent, useInView } from "framer-motion";
import { AutoSigningNavbar } from "@/components/AutoSigningNavbar";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useRef, useState, useEffect } from "react";

// Animated counter hook (Cap pattern)
function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return { count, ref };
}

// Marquee items (Kite pattern)
const MARQUEE_ITEMS = [
  "DCA Strategy", "Yield Farming", "LP Rebalancing", "Auto-Compound",
  "Smart DCA", "VIP Maximizer", "Cross-chain Swap", "Risk Management",
  "AI Signal Trading", "Portfolio Optimizer", "Liquidity Mining", "Flash Loan Arb",
];

export default function LandingPage() {
  const { isConnected, openConnect } = useInterwovenKit();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.97]);
  const heroY = useTransform(scrollY, [0, 400], [0, 40]);
  const gridOpacity = useTransform(scrollY, [0, 300], [0.6, 0]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
  });

  // Live stats from API
  const [liveStats, setLiveStats] = useState({ deposited: 0, agents: 0 });
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : []))
      .then((agents: any[]) => {
        const creators = agents.filter((a: any) => !a.isSubscription && !a.agentClosed);
        const total = Math.round(creators.reduce((s: number, a: any) => s + (a.initialCapital || 0), 0));
        setLiveStats({ deposited: total, agents: creators.length });
      })
      .catch(() => {});
  }, []);

  // Stats counters (Ethena/Cap pattern)
  const stat1 = useCountUp(liveStats.deposited, 2000);
  const stat2 = useCountUp(liveStats.agents, 1500);
  const stat3 = useCountUp(4, 1200);
  const stat4 = useCountUp(99, 1800);

  const handleLaunchApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isConnected) {
      openConnect();
    } else {
      router.push("/app/marketplace");
    }
  };

  return (
    <div ref={containerRef} className="relative flex min-h-screen flex-col bg-[#08080a] text-zinc-50 overflow-hidden">
      <AnimatedBackground />

      {/* Floating Rounded Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
        className={`fixed top-4 left-4 right-4 z-50 flex h-14 items-center justify-between px-5 md:px-6 backdrop-blur-xl transition-all duration-300 [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] rounded-[20px] ${
          scrolled
            ? "bg-[#08080a]/80 border border-white/[0.06] shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_48px_-12px_rgba(0,0,0,0.2)]"
            : "bg-transparent border border-transparent"
        }`}
      >
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 text-emerald-400">
            <Bot className="h-5 w-5" />
          </div>
          <span className="text-zinc-200 hidden sm:inline-block font-medium tracking-tight">
            InitiaAgent
          </span>
        </div>

        <nav className="flex items-center gap-2 md:gap-5">
          {isConnected && (
            <>
              <Link href="/app/marketplace" className="hidden md:block text-[13px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors duration-200">
                Marketplace
              </Link>
              <Link href="/app/builder" className="hidden md:block text-[13px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors duration-200">
                Create Agent
              </Link>
            </>
          )}
          <AutoSigningNavbar />
          <Button onClick={handleLaunchApp} className="rounded-full px-5 md:px-6 text-[13px] h-9 md:h-10 font-medium">
            {!isConnected ? (
              <span className="flex items-center gap-2"><Zap size={14} /> Connect Wallet</span>
            ) : "Enter App"}
          </Button>
        </nav>
      </motion.header>

      <main className="relative z-10 flex-1 pt-16">
        {/* === HERO === */}
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="flex flex-col items-center justify-center px-4 py-24 text-center md:py-36 relative overflow-hidden"
        >
          {/* Perspective Grid Background (Convergence) */}
          <motion.div
            style={{ opacity: gridOpacity }}
            className="absolute top-0 left-0 right-0 h-[500px] perspective-grid pointer-events-none"
          />

          {/* Radial Glow (Cap/Para) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] radial-glow pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
            className="relative inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium tracking-wide text-zinc-500 mb-8 md:mb-12 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse" />
            Live on Initia evm-1
          </motion.div>

          <div className="relative">
            <TypewriterHeadline />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5, duration: 0.8, ease: [0.36, 0.2, 0.07, 1] }}
            className="mt-8 max-w-xl text-base md:text-lg text-zinc-500 px-4 leading-relaxed font-light"
          >
            Deploy autonomous AI agents to manage your DeFi strategies. From
            auto-compounding to smart DCA, let AI optimize your yield on the
            Interwoven Economy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.8, duration: 0.8, ease: [0.36, 0.2, 0.07, 1] }}
            className="mt-12 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-6"
          >
            <Button onClick={handleLaunchApp} size="lg" className="h-13 md:h-14 w-full sm:w-auto rounded-[20px] px-8 text-sm md:text-[15px] font-medium">
              Explore Agents <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={handleLaunchApp} size="lg" variant="outline" className="h-13 md:h-14 w-full sm:w-auto rounded-[20px] px-8 text-sm md:text-[15px] font-medium">
              Build an Agent
            </Button>
          </motion.div>
        </motion.section>

        {/* === STATS ROW (Ethena/Cap pattern) === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
          className="px-4 md:px-6 pb-20"
        >
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[28px] bg-white/[0.02] border border-white/[0.04] p-[6px]">
              <div className="rounded-[22px] bg-white/[0.02] border border-white/[0.03] grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.04]">
                {[
                  { label: "Total Deposited", value: stat1.count, prefix: "", suffix: " INIT", ref: stat1.ref, icon: BarChart3 },
                  { label: "Agents Deployed", value: stat2.count, prefix: "", suffix: "", ref: stat2.ref, icon: Cpu },
                  { label: "Strategies", value: stat3.count, prefix: "", suffix: " Types", ref: stat3.ref, icon: Layers },
                  { label: "Uptime", value: stat4.count, prefix: "", suffix: "%", ref: stat4.ref, icon: Lock },
                ].map((stat, i) => (
                  <div key={i} ref={stat.ref} className="px-6 py-6 text-center group">
                    <stat.icon className="h-4 w-4 text-zinc-700 mx-auto mb-3 group-hover:text-emerald-400 transition-colors duration-300" />
                    <div className="text-2xl md:text-3xl font-light text-zinc-200 font-mono tracking-tight mb-1">
                      {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
                    </div>
                    <div className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* === STRATEGY MARQUEE TICKER (Kite) === */}
        <div className="relative py-6 border-y border-white/[0.03] overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#08080a] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#08080a] to-transparent z-10 pointer-events-none" />
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="marquee-content" aria-hidden={copy === 1}>
                {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
                  <span key={`${copy}-${i}`} className="inline-flex items-center gap-2.5 text-[13px] text-zinc-600 font-medium whitespace-nowrap">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/40 shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* === FEATURES (with gradient border on hover) === */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="px-4 md:px-6 py-24 md:py-36 relative"
        >
          <div className="mx-auto max-w-5xl relative z-10">
            <div className="text-center mb-20">
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-4"
              >
                Ecosystem
              </motion.p>
              <h2 className="text-3xl md:text-5xl font-light tracking-tight text-zinc-200 mb-5">
                Powerful <span className="text-gradient font-bold">Core</span> Features
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-base font-light">
                Everything you need to automate your DeFi journey on the Interwoven Economy.
              </p>
            </div>

            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.15 } }
              }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3"
            >
              {[
                {
                  icon: ShieldCheck,
                  title: "Trustless & Secure",
                  desc: "Agents operate within strict, user-defined parameters. Your funds never leave your control.",
                  gradient: "from-emerald-500/20 via-transparent to-transparent",
                },
                {
                  icon: Bot,
                  title: "Automated Strategies",
                  desc: "From simple DCA to complex yield farming, deploy agents that execute your strategy 24/7.",
                  gradient: "from-cyan-500/20 via-transparent to-transparent",
                },
                {
                  icon: Zap,
                  title: "Interwoven Economy",
                  desc: "Seamlessly interact with dApps across the entire Initia ecosystem through a single interface.",
                  gradient: "from-teal-500/20 via-transparent to-transparent",
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.36, 0.2, 0.07, 1] } }
                  }}
                  className="group relative"
                >
                  {/* Gradient border card (Spectral pattern) */}
                  <div className="gradient-border transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] hover:bg-white/[0.03]">
                    <div className="relative rounded-[27px] p-8 md:p-10 flex flex-col items-center text-center overflow-hidden">
                      {/* Hover gradient overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-b ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

                      <div className="relative mb-7 flex h-14 w-14 items-center justify-center rounded-[16px] bg-white/[0.04] text-zinc-400 transition-all duration-300 group-hover:text-emerald-400 group-hover:bg-emerald-500/[0.08] group-hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.2)]">
                        <feature.icon className="h-7 w-7" />
                      </div>
                      <h3 className="relative mb-3 text-lg font-medium text-zinc-200 tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="relative text-sm text-zinc-500 leading-relaxed font-light">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* === INTERACTIVE AGENT PREVIEW (Usual pattern) === */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.36, 0.2, 0.07, 1] }}
          className="px-4 md:px-6 pb-24 md:pb-36"
        >
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-4">How it works</p>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-zinc-200 mb-5">
                Deploy in <span className="text-gradient font-bold">minutes</span>, not days
              </h2>
            </div>

            {/* Agent Preview Card */}
            <div className="gradient-border gradient-border-animated glow-emerald">
              <div className="rounded-[27px] p-8 md:p-10 relative overflow-hidden">
                {/* Subtle noise */}
                <div className="absolute inset-0 noise-overlay pointer-events-none opacity-30" />

                <div className="relative grid md:grid-cols-2 gap-8 items-center">
                  {/* Left: steps */}
                  <div className="space-y-6">
                    {[
                      { step: "01", title: "Choose Strategy", desc: "Select from DCA, LP Rebalancing, Yield Optimizer, or custom logic.", icon: Layers },
                      { step: "02", title: "Configure & Simulate", desc: "Set parameters and run AI-powered market simulation before deploying.", icon: Sparkles },
                      { step: "03", title: "Deploy & Earn", desc: "Fund your vault and let the agent execute 24/7 with zero-friction signing.", icon: TrendingUp },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -15 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 * i, duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
                        className="flex gap-4 group/step"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-[12px] bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-600 font-mono text-xs group-hover/step:bg-emerald-500/[0.08] group-hover/step:text-emerald-400 group-hover/step:border-emerald-500/15 transition-all duration-300">
                          {item.step}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-zinc-200 mb-1">{item.title}</h4>
                          <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Right: mock agent card */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
                    className="animate-float"
                  >
                    <div className="rounded-[22px] bg-white/[0.03] border border-white/[0.05] p-6 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-[12px] bg-emerald-500/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-200">INIT Accumulator</div>
                            <div className="text-[11px] text-zinc-600">DCA Strategy</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] text-emerald-400 font-medium">Live</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="rounded-[14px] bg-white/[0.02] border border-white/[0.03] p-3">
                          <div className="text-[10px] text-zinc-600 mb-1">Capital</div>
                          <div className="text-sm font-mono text-zinc-200">500 INIT</div>
                        </div>
                        <div className="rounded-[14px] bg-white/[0.02] border border-white/[0.03] p-3">
                          <div className="text-[10px] text-zinc-600 mb-1">Profit</div>
                          <div className="text-sm font-mono text-emerald-400">+12.4%</div>
                        </div>
                      </div>

                      {/* Mini chart bars */}
                      <div className="flex items-end gap-1 h-12">
                        {[40, 55, 45, 60, 50, 70, 65, 80, 75, 85, 78, 90].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            whileInView={{ height: `${h}%` }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 + i * 0.05, duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
                            className="flex-1 rounded-[3px] bg-gradient-to-t from-emerald-500/20 to-emerald-500/40"
                          />
                        ))}
                      </div>

                      <div className="mt-4 flex justify-between items-center text-[10px] text-zinc-600">
                        <span className="font-mono">Interval: 4h</span>
                        <span className="font-mono">Next: 2h 15m</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* === TRUST BADGES (Usual pattern) === */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="px-4 md:px-6 pb-20"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-700 mb-8">
              Powered by the Interwoven Economy
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4">
              {["Initia", "Gemini AI", "Move VM", "EVM Layer", "Interwoven Kit"].map((partner) => (
                <div key={partner} className="text-zinc-600 text-sm font-medium hover:text-zinc-400 transition-colors duration-200 cursor-default">
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* === CTA SECTION (Ethena clean CTA) === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.36, 0.2, 0.07, 1] }}
          className="px-4 md:px-6 pb-24 md:pb-36"
        >
          <div className="mx-auto max-w-3xl">
            <div className="gradient-border">
              <div className="rounded-[27px] p-10 md:p-16 text-center relative overflow-hidden">
                <div className="absolute inset-0 radial-glow pointer-events-none" />
                <h2 className="relative text-2xl md:text-4xl font-light tracking-tight text-zinc-200 mb-4">
                  Start automating your <br className="hidden md:inline" />
                  <span className="text-gradient font-bold">DeFi strategy</span> today
                </h2>
                <p className="relative text-zinc-500 mb-8 max-w-md mx-auto font-light">
                  No code required. Deploy your first AI agent in under 5 minutes.
                </p>
                <div className="relative flex flex-col sm:flex-row justify-center gap-3">
                  <Button onClick={handleLaunchApp} size="lg" className="rounded-[18px] px-8 h-12 md:h-13 text-[15px]">
                    Launch App <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/docs">
                    <Button variant="outline" size="lg" className="rounded-[18px] px-8 h-12 md:h-13 text-[15px] w-full sm:w-auto">
                      Read Docs
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-400">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-zinc-400 font-medium text-sm">InitiaAgent</span>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-[13px] text-zinc-600">
              <Link href="/docs" className="hover:text-zinc-400 transition-colors duration-200">Documentation</Link>
              <Link href="#" className="hover:text-zinc-400 transition-colors duration-200">Twitter</Link>
              <Link href="#" className="hover:text-zinc-400 transition-colors duration-200">Discord</Link>
              <Link href="#" className="hover:text-zinc-400 transition-colors duration-200">Github</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-400 border-emerald-500/10">DeFi Track</Badge>
                <Badge variant="outline" className="text-[10px] bg-white/[0.03] text-zinc-500 border-white/[0.05]">AI & Tooling</Badge>
              </div>
              <div className="text-[11px] text-zinc-600">Built with ❤️ by <span className="text-zinc-400 font-medium">BCC UKDW</span></div>
              <div className="text-[10px] text-zinc-700">© 2026 InitiaAgent · INITIATE Season 1</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
