"use client";

import { Globe, Copy, Check, ExternalLink, Wallet, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBalance } from "wagmi";
import { AutoSigningNavbar } from "@/components/AutoSigningNavbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useInterwovenEvm } from "@/lib/hooks/use-interwoven-evm";
import { useMockWallet } from "@/lib/hooks/use-mock-wallet";
import {
  INITIA_EVM_CHAIN_ID,
  explorerCosmosAccountUrl,
} from "@initia-agent/shared";

export function MobileHeader() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { address, isConnected, username, openBridge, disconnect } = useInterwovenKit();
  const { signMockAction } = useInterwovenEvm();

  const handleDisconnect = () => {
    setProfileOpen(false);
    try {
      disconnect();
      toast.success("Wallet disconnected");
      router.push("/");
    } catch {
      toast.error("Failed to disconnect wallet");
    }
  };

  const { data: walletInitBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: INITIA_EVM_CHAIN_ID,
  });
  const { formattedInit, creditInit } = useMockWallet(address, Number(walletInitBalance?.formatted ?? 0));

  const truncate = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div
        className="flex h-14 items-center justify-between border-b border-white/[0.05] px-4 md:hidden relative z-50 shrink-0"
        style={{
          background: "rgba(8,4,18,0.85)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
        }}
      >
        {/* Logo */}
        <Link href="/app/marketplace" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="InitiaAgent"
            className="h-8 w-auto"
          />
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <AutoSigningNavbar />

          <button
            onClick={() => openBridge()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/[0.05] transition-all duration-200"
          >
            <Globe className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => isConnected && setProfileOpen(true)}
            className="relative h-8 w-8 rounded-full bg-gradient-to-br from-[#FA93FA] to-[#983AD6] flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-[0_0_12px_-3px_rgba(201,103,232,0.5)]"
          >
            {address ? address.slice(2, 4).toUpperCase() : "IA"}
            {isConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 border border-[#010101]" />
            )}
          </button>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden" aria-describedby={undefined}>
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-transparent via-[#C967E8] to-transparent" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <Wallet className="h-5 w-5 text-purple-400" />
              Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="gradient-border">
              <div className="flex items-center gap-4 p-4 rounded-[23px]">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#FA93FA] to-[#983AD6] flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-[0_0_20px_-5px_rgba(201,103,232,0.4)]">
                  {address ? address.slice(2, 4).toUpperCase() : "IA"}
                </div>
                <div className="flex flex-col space-y-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Connected Wallet</span>
                  {username && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-purple-300">{username}</span>
                      <span className="text-[9px] font-bold uppercase text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">.init</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-zinc-500 truncate">{truncate(address || "")}</span>
                    <button onClick={handleCopy} className="p-1.5 hover:bg-white/[0.06] rounded-[8px] transition-all text-zinc-500 hover:text-zinc-300">
                      {copied ? <Check className="h-3.5 w-3.5 text-purple-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Network", value: "Initia evm-1" },
                { label: "INIT", value: formattedInit, accent: true },
                { label: "Status", value: "Online", dot: true },
                { label: "Chain", value: "evm-1" },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] bg-white/[0.02] border border-white/[0.04] p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">{item.label}</span>
                  <span className={cn("text-sm font-medium tabular-nums", item.accent ? "text-gradient" : "text-zinc-300")}>
                    {item.dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />}
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/[0.06]"
                onClick={async () => {
                  if (!address) return;
                  const toastId = toast.loading("Adding 10000 Mock INIT...");
                  try {
                    await signMockAction();
                    creditInit(10000);
                    toast.success("Added 10000 Mock INIT", { id: toastId });
                  } catch {
                    toast.error("Mint failed.", { id: toastId });
                  }
                }}
              >
                Faucet: Get 10000 INIT
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(explorerCosmosAccountUrl(address), "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Explorer
              </Button>
              <Button
                variant="destructive"
                className="w-full mt-1"
                onClick={handleDisconnect}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect Wallet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
