"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Store, Wrench, Bot, Wallet, Trophy, Globe, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBalance } from "wagmi";
import {
  INITIA_EVM_CHAIN_ID,
  explorerCosmosAccountUrl,
} from "@initia-agent/shared";
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
import { useMockWallet } from "@/lib/hooks/use-mock-wallet";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected, username, openBridge, disconnect } = useInterwovenKit();
  const [copied, setCopied] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  const handleDisconnect = () => {
    setWalletOpen(false);
    try {
      disconnect();
      toast.success("Wallet disconnected");
      router.push("/");
    } catch {
      toast.error("Failed to disconnect wallet");
    }
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { signMockAction } = useInterwovenEvm();
  const { data: walletInitBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: INITIA_EVM_CHAIN_ID,
  });
  const { formattedInit, creditInit } = useMockWallet(address, Number(walletInitBalance?.formatted ?? 0));

  const truncate = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  type WalletInfoItem = {
    label: string;
    value: string;
    accent?: boolean;
    dot?: boolean;
  };

  const links = [
    { name: "Marketplace", href: "/app/marketplace", icon: Store },
    { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
    { name: "Builder", href: "/app/builder", icon: Wrench },
    { name: "Leaderboard", href: "/app/leaderboard", icon: Trophy },
  ];

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
      className="hidden md:flex h-full w-[220px] flex-col border-r border-white/[0.05] relative z-20"
      style={{
        background: "rgba(6,3,14,0.8)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
      }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-white/[0.04]">
        <Link href="/" className="flex items-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="InitiaAgent"
            className="h-8 w-auto transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-2.5 px-2.5">
        <p className="px-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700 mb-1.5">
          Menu
        </p>
        <nav className="grid gap-0.5">
          {links.map((link, index) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <motion.div
                key={link.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3, ease: [0.36, 0.2, 0.07, 1] }}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium transition-all duration-200 relative overflow-hidden",
                    isActive
                      ? "text-white bg-gradient-to-r from-purple-500/15 to-purple-500/5 border border-purple-500/15"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarTab"
                      className="absolute left-0 top-[20%] bottom-[20%] w-[2px] rounded-full bg-gradient-to-b from-[#FA93FA] to-[#983AD6]"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className={cn("h-[14px] w-[14px] shrink-0 transition-colors duration-200", isActive ? "text-purple-400" : "text-zinc-600")} />
                  {link.name}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="my-3 border-t border-white/[0.04]" />

        <button
          onClick={() => openBridge()}
          className="w-full flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-zinc-500 hover:text-purple-400 hover:bg-purple-500/[0.05] border border-transparent hover:border-purple-500/10 transition-all duration-200"
        >
          <Globe className="h-[14px] w-[14px] shrink-0" />
          Bridge Assets
        </button>
      </div>

      {/* Wallet card */}
      {isConnected && (
        <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
          <DialogTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35, ease: [0.36, 0.2, 0.07, 1] }}
              className="border-t border-white/[0.04] p-2.5"
            >
              <div className="flex items-center gap-2.5 rounded-[12px] bg-white/[0.02] border border-white/[0.05] p-2.5 cursor-pointer hover:bg-white/[0.04] hover:border-purple-500/15 transition-all duration-200 group">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#FA93FA] to-[#983AD6] flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-[0_0_10px_-3px_rgba(201,103,232,0.5)]">
                  {address ? address.slice(2, 4).toUpperCase() : "IA"}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-zinc-200 truncate">
                    {username || truncate(address || "")}
                    {username && (
                      <span className="ml-1 text-[9px] font-bold text-purple-400/70">.init</span>
                    )}
                  </span>
                  <span className="text-[10px] text-purple-400/70 font-mono">{formattedInit} INIT</span>
                </div>
                <Info className="h-3 w-3 text-zinc-700 group-hover:text-zinc-500 shrink-0 transition-colors" />
              </div>
            </motion.div>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md overflow-hidden" aria-describedby={undefined}>
            <div className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-transparent via-[#C967E8] to-transparent" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-purple-400" />
                Wallet
              </DialogTitle>
            </DialogHeader>

            <motion.div
              className="space-y-3 py-1"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                  },
                },
              }}
            >
              <motion.div
                className="gradient-border"
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <div className="flex items-center gap-3 p-3.5 rounded-[23px]">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FA93FA] to-[#983AD6] flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {address ? address.slice(2, 4).toUpperCase() : "IA"}
                  </div>
                  <div className="flex flex-col space-y-0.5 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Connected Wallet</span>
                    {username && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-purple-300">{username}</span>
                        <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">.init</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-500 truncate">{truncate(address || "")}</span>
                      <button onClick={handleCopy} className="p-1 hover:bg-white/[0.06] rounded-[6px] transition-all text-zinc-500 hover:text-zinc-300">
                        {copied ? <Check className="h-3 w-3 text-purple-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="grid grid-cols-2 gap-2"
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                {([
                  { label: "Network", value: "Initia evm-1" },
                  { label: "Chain ID", value: "2124225..." },
                  { label: "INIT Balance", value: formattedInit, accent: true },
                  { label: "Status", value: "Online", dot: true },
                ] satisfies WalletInfoItem[]).map((item) => (
                  <div key={item.label} className="rounded-[12px] bg-white/[0.02] border border-white/[0.04] p-2.5">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-0.5">{item.label}</span>
                    <span className={cn("text-sm font-medium tabular-nums", item.accent ? "text-gradient" : "text-zinc-300")}>
                      {item.dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />}
                      {item.value}
                    </span>
                  </div>
                ))}
              </motion.div>

              <motion.div
                className="flex flex-col gap-2"
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Button variant="outline" className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/[0.06]" size="sm"
                  onClick={async () => {
                    if (!address) return;
                    const toastId = toast.loading("Adding 10000 Mock INIT...");
                    try {
                      await signMockAction();
                      creditInit(10000);
                      toast.success("Added 10000 Mock INIT", { id: toastId });
                    } catch { toast.error("Mint failed.", { id: toastId }); }
                  }}
                >
                  <Bot className="mr-2 h-3.5 w-3.5" /> Faucet: Get 10000 INIT
                </Button>
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => window.open(explorerCosmosAccountUrl(address), "_blank")}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> View Explorer
                </Button>
                <Button variant="destructive" size="sm" className="w-full mt-1" onClick={handleDisconnect}>
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Disconnect Wallet
                </Button>
              </motion.div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}



