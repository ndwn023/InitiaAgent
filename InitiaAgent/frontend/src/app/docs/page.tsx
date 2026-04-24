'use client'

import { motion } from 'framer-motion'
import { Bot, ChevronLeft, ShieldCheck, Zap, Code, Layout, Terminal } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const CONTRACTS = [
  { name: 'AgentRegistry', address: '0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D', desc: 'Central directory for all trading agents' },
  { name: 'AgentExecutor', address: '0x0777CA550E0dFB9c64deb88A871a3ad867c2e014', desc: 'Gateway for trade execution and DEX swaps' },
  { name: 'ProfitSplitter', address: '0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F', desc: 'Epoch-based profit sharing and fees' },
  { name: 'AgentVault (Agent #1)', address: '0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6', desc: 'Non-custodial subscriber fund manager' },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-50 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8 -ml-3 text-zinc-500 hover:text-zinc-300 group">
            <ChevronLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Back to Home
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-[18px] bg-emerald-500/[0.06] text-emerald-400 border border-emerald-500/10">
              <Bot size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-light tracking-tight text-zinc-200">Documentation</h1>
              <p className="text-zinc-600">The technical foundation of InitiaAgent.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-12">
            <Badge>INITIATE Season 1</Badge>
            <Badge variant="outline">Rollup: evm-1</Badge>
            <Badge variant="outline">Move-Interwoven</Badge>
          </div>

          {/* Architecture */}
          <section className="mb-20">
            <h2 className="text-xl font-light text-zinc-300 mb-8 flex items-center gap-3">
              <Layout className="text-emerald-400/60" />
              Visual Architecture
            </h2>
            <div className="relative rounded-[28px] bg-white/[0.02] border border-white/[0.04] p-[6px] overflow-hidden">
              <div className="rounded-[22px] bg-white/[0.02] border border-white/[0.03] p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-[16px] bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-emerald-400">
                      <ShieldCheck size={28} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Subscriber</span>
                    <div className="text-[10px] text-zinc-600 bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.04]">Auto-signing / Ghost Wallet</div>
                  </div>

                  <div className="hidden md:block h-px w-12 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5" />

                  <div className="flex flex-col items-center gap-3 text-center scale-105">
                    <div className="w-16 h-16 rounded-[18px] bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center justify-center text-emerald-400">
                      <Bot size={32} />
                    </div>
                    <span className="text-sm font-medium uppercase tracking-wider text-emerald-400/70">Agent Executor</span>
                    <div className="text-[10px] text-emerald-500/40 bg-emerald-500/[0.04] px-2.5 py-1 rounded-full border border-emerald-500/10">Non-Custodial Move VM</div>
                  </div>

                  <div className="hidden md:block h-px w-12 bg-gradient-to-r from-emerald-500/5 to-teal-500/20" />

                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-[16px] bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-teal-400">
                      <Zap size={28} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Liquidity Pool</span>
                    <div className="text-[10px] text-zinc-600 bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.04]">Interwoven DEX Swaps</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="mb-20">
            <h2 className="text-xl font-light text-zinc-300 mb-6 flex items-center gap-3">
              <ShieldCheck className="text-emerald-400/60" />
              Security Architecture
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Zero-Access Withdrawal",
                  desc: "Agents function as message relays. They can call the `execute` function on the vault, but strictly lack the logic or authorization to initiate withdrawals. Your principal remains untouched."
                },
                {
                  title: "Bounded Autonomy",
                  desc: "Each subscription defines hard limits on trade sizes and asset pairs. Even if an agent's logic deviates, the underlying smart contract will force-reject any transaction exceeding your risk profile."
                }
              ].map((item) => (
                <div key={item.title} className="rounded-[22px] bg-white/[0.02] border border-white/[0.04] p-[5px]">
                  <div className="rounded-[17px] bg-white/[0.02] border border-white/[0.03] p-6">
                    <h3 className="text-zinc-200 font-medium mb-2">{item.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Smart Contracts */}
          <section className="mb-20">
            <h2 className="text-xl font-light text-zinc-300 mb-6 flex items-center gap-3">
              <Code className="text-emerald-400/60" />
              Smart Contracts (evm-1)
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {CONTRACTS.map((contract) => (
                <div key={contract.address} className="rounded-[22px] bg-white/[0.02] border border-white/[0.04] p-[5px] transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] hover:border-white/[0.07] group">
                  <div className="rounded-[17px] bg-white/[0.02] border border-white/[0.03] p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{contract.name}</h3>
                      <code className="text-[10px] text-emerald-400/70 bg-emerald-500/[0.06] px-2 py-0.5 rounded-full border border-emerald-500/10">VERIFIED</code>
                    </div>
                    <p className="text-sm text-zinc-300 mb-4">{contract.desc}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] font-mono bg-white/[0.02] p-2.5 rounded-[12px] border border-white/[0.04] text-emerald-400/60 truncate">
                        {contract.address}
                      </code>
                      <a
                        href={`https://scan.testnet.initia.xyz/evm-1/accounts/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="icon-sm" variant="ghost" className="rounded-[10px] border border-white/[0.04] hover:text-emerald-400">
                          <Terminal size={14} />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Initia Features */}
          <section className="mb-20">
            <h2 className="text-xl font-light text-zinc-300 mb-6 flex items-center gap-3">
              <Zap className="text-emerald-400/60" />
              Initia-Native Features
            </h2>
            <div className="rounded-[28px] bg-emerald-500/[0.02] border border-emerald-500/[0.06] p-[6px]">
              <div className="rounded-[22px] bg-white/[0.02] border border-emerald-500/[0.05] p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 text-emerald-500/[0.04]">
                  <Zap size={120} strokeWidth={1} />
                </div>
                <div className="relative z-10">
                  <Badge className="mb-4">GHOST WALLET TECHNOLOGY</Badge>
                  <h3 className="text-xl font-light text-zinc-200 mb-4 tracking-tight">Zero-Friction Execution</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl mb-6">
                    By leveraging Initia&apos;s Auto-signing / Session UX, we&apos;ve eliminated the primary bottleneck of DeFi automation.
                    Subscribers grant a time-limited, message-scoped allowance that allows InitiaAgent to execute strategies seamlessly
                    across rollup layers without requiring constant hardware wallet interactions.
                  </p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Latency</span>
                      <span className="text-lg font-mono font-light text-emerald-400">~0.01s</span>
                    </div>
                    <div className="w-px h-8 bg-white/[0.06]" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Chain Interop</span>
                      <span className="text-lg font-mono font-light text-emerald-400">Omit-MPC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="pt-10 border-t border-white/[0.04] text-center text-zinc-600 text-sm">
            Built for the Initia Ecosystem.
          </footer>
        </motion.div>
      </div>
    </div>
  )
}
