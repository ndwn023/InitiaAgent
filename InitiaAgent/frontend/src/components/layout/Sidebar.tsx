"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Store, Wrench, Bot, Wallet, Trophy, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBalance, useReadContract, useSwitchChain, useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { CONTRACTS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExternalLink, Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";

export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected, username, openBridge } = useInterwovenKit();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    chainId: 2124225178762456,
  });

  const { chainId } = useAccount();
  const { writeContract } = useInterwovenEvm();
  const { switchChainAsync } = useSwitchChain();

  const { data: mockInitBalance, refetch: refetchMock } = useReadContract({
    address: CONTRACTS.MOCK_INIT as `0x${string}`,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 }
  });

  const formattedMock = mockInitBalance ? Number(formatUnits(mockInitBalance as bigint, 18)).toFixed(2) : "0.00";

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const links = [
    { name: "Marketplace", href: "/app/marketplace", icon: Store },
    { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
    { name: "Agent Builder", href: "/app/builder", icon: Wrench },
    { name: "Leaderboard", href: "/app/leaderboard", icon: Trophy },
  ];

  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.36, 0.2, 0.07, 1] }}
      className="hidden md:flex h-full w-[260px] flex-col border-r border-white/[0.04] bg-[#08080a]/80 backdrop-blur-xl relative z-20"
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-5">
        <Link
          href="/"
          className="flex items-center gap-3 text-zinc-100 transition-colors hover:text-white"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 text-emerald-400">
            <Bot className="h-5 w-5" />
          </div>
          <span className="font-medium tracking-tight">InitiaAgent</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-3 px-3">
        <nav className="grid gap-1">
          {links.map((link, index) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <motion.div
                key={link.name}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.06, duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] relative overflow-hidden",
                    isActive
                      ? "text-emerald-400 bg-emerald-500/[0.08]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-emerald-500 rounded-full"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 35,
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] transition-colors duration-300",
                      isActive ? "text-emerald-400" : "text-zinc-600",
                    )}
                  />
                  {link.name}
                </Link>
              </motion.div>
            );
          })}
        </nav>
      </div>

      {/* Bridge button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => openBridge()}
          className="w-full flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/[0.06] border border-transparent hover:border-emerald-500/10 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)]"
        >
          <Globe className="h-[18px] w-[18px] shrink-0" />
          Bridge Assets
        </button>
      </div>

      {/* Wallet Info */}
      {isConnected && (
        <Dialog>
          <DialogTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
              className="border-t border-white/[0.04] p-3"
            >
              <div className="flex items-center gap-3 rounded-[16px] bg-white/[0.02] border border-white/[0.04] p-3 cursor-pointer transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] hover:bg-white/[0.04] hover:border-white/[0.06]">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[10px] font-semibold text-zinc-950 shrink-0">
                  {address ? address.slice(2, 4).toUpperCase() : "IA"}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-medium text-zinc-300 truncate">
                      {username || truncateAddress(address || "")}
                    </span>
                    {username && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">.init</span>
                    )}
                  </div>
                  <span className="text-xs text-emerald-500/80 font-medium">
                    {formattedMock} INIT
                  </span>
                </div>
                <Info className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              </div>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-hidden" aria-describedby={undefined}>
            {/* Gradient accent line at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-teal-500/0" />

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <Wallet className="h-5 w-5 text-emerald-400" />
                Wallet Information
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Profile - gradient border */}
              <div className="gradient-border">
                <div className="flex items-center gap-4 p-4 rounded-[27px]">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-lg font-semibold text-zinc-950 shrink-0 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">
                    {address ? address.slice(2, 4).toUpperCase() : "IA"}
                  </div>
                  <div className="flex flex-col space-y-1 min-w-0">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Connected Wallet</span>
                    {username && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-emerald-300">{username}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">.init</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-500 truncate tabular-nums">{truncateAddress(address || "")}</span>
                      <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-white/[0.06] rounded-[10px] transition-all duration-200 text-zinc-500 hover:text-zinc-300"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Grid - double-layer */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Network", value: "Initia evm-1" },
                  { label: "Chain ID", value: "2124225178..." },
                  { label: "Native Token", value: "INIT", accent: true },
                  { label: "INIT", value: formattedMock, accent: true },
                  { label: "Status", value: "Online", dot: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] bg-white/[0.02] border border-white/[0.04] p-[4px]">
                    <div className="rounded-[14px] bg-white/[0.02] border border-white/[0.03] p-3">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">{item.label}</span>
                      <span className={cn("text-sm font-medium tabular-nums", item.accent ? "text-emerald-400" : "text-zinc-300")}>
                        {item.dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <Button
                  variant="outline"
                  className="w-full border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/[0.06]"
                  onClick={async () => {
                    if (!address) return;
                    const toastId = toast.loading("Minting 10000 INIT...");
                    try {
                      if (chainId !== 2124225178762456) {
                        await switchChainAsync({ chainId: 2124225178762456 });
                      }
                      const MINT_ABI = [{ type: "function", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }] as const;
                      await writeContract({
                        address: CONTRACTS.MOCK_INIT as `0x${string}`,
                        abi: MINT_ABI,
                        functionName: "mint",
                        args: [address as `0x${string}`, parseUnits("10000", 18)],
                      });
                      toast.success("Successfully minted 10000 INIT!", { id: toastId });
                      setTimeout(() => refetchMock(), 5000);
                    } catch (err) {
                      toast.error("Mint failed.", { id: toastId });
                    }
                  }}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  Faucet: Get 10000 INIT
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(`https://scan.testnet.initia.xyz/initiation-2/accounts/${address}`, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Explorer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
