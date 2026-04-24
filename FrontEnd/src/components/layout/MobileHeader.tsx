"use client";

import { Bot, Globe, Copy, Check, ExternalLink, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useReadContract, useSwitchChain, useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ERC20ABI } from "@/lib/abis/ERC20";
import { CONTRACTS } from "@/lib/constants";
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

export function MobileHeader() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { address, isConnected, username, openBridge } = useInterwovenKit();
  const { chainId } = useAccount();
  const { writeContract } = useInterwovenEvm();
  const { switchChainAsync } = useSwitchChain();

  const { data: mockInitBalance, refetch: refetchMock } = useReadContract({
    address: CONTRACTS.MOCK_INIT as `0x${string}`,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const formattedMock = mockInitBalance
    ? Number(formatUnits(mockInitBalance as bigint, 18)).toFixed(2)
    : "0.00";

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
      <div className="flex h-14 items-center justify-between border-b border-white/[0.04] bg-[#08080a]/90 px-4 backdrop-blur-xl md:hidden relative z-50 shrink-0">
        {/* Logo */}
        <Link href="/app/marketplace" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-400">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-medium tracking-tight text-zinc-200">
            InitiaAgent
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Session UX */}
          <AutoSigningNavbar />

          {/* Bridge */}
          <button
            onClick={() => openBridge()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-emerald-500/[0.06] transition-all duration-200"
          >
            <Globe className="h-3.5 w-3.5" />
          </button>

          {/* Profile avatar */}
          <button
            onClick={() => isConnected && setProfileOpen(true)}
            className="relative h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[10px] font-semibold text-zinc-950 shrink-0"
          >
            {address ? address.slice(2, 4).toUpperCase() : "IA"}
            {isConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-[#08080a]" />
            )}
          </button>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-teal-500/0" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Avatar + address */}
            <div className="gradient-border">
              <div className="flex items-center gap-4 p-4 rounded-[27px]">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-lg font-semibold text-zinc-950 shrink-0 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">
                  {address ? address.slice(2, 4).toUpperCase() : "IA"}
                </div>
                <div className="flex flex-col space-y-1 min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    Connected Wallet
                  </span>
                  {username && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-emerald-300">{username}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        .init
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-zinc-500 truncate tabular-nums">
                      {truncate(address || "")}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-white/[0.06] rounded-[10px] transition-all text-zinc-500 hover:text-zinc-300"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Network", value: "Initia evm-1" },
                { label: "INIT", value: formattedMock, accent: true },
                { label: "Status", value: "Online", dot: true },
                { label: "Chain ID", value: "evm-1" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] bg-white/[0.02] border border-white/[0.04] p-[4px]"
                >
                  <div className="rounded-[14px] bg-white/[0.02] border border-white/[0.03] p-3">
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        item.accent ? "text-emerald-400" : "text-zinc-300"
                      )}
                    >
                      {item.dot && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                      )}
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
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
                    const MINT_ABI = [
                      {
                        type: "function",
                        name: "mint",
                        inputs: [
                          { name: "to", type: "address" },
                          { name: "amount", type: "uint256" },
                        ],
                        outputs: [],
                        stateMutability: "nonpayable",
                      },
                    ] as const;
                    await writeContract({
                      address: CONTRACTS.MOCK_INIT as `0x${string}`,
                      abi: MINT_ABI,
                      functionName: "mint",
                      args: [address as `0x${string}`, parseUnits("10000", 18)],
                    });
                    toast.success("Minted 10000 INIT!", { id: toastId });
                    setTimeout(() => refetchMock(), 5000);
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
                onClick={() =>
                  window.open(
                    `https://scan.testnet.initia.xyz/initiation-2/accounts/${address}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Explorer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
