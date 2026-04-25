"use client";

import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import {
  INITIA_EVM_CHAIN,
  INITIA_EVM_CHAIN_SLUG,
  INITIA_EVM_CHAIN_ID_STR,
} from "@initia-agent/shared";

const evm1Wagmi = defineChain(INITIA_EVM_CHAIN);

const AUTO_SIGN_MESSAGES = [
  "/minievm.evm.v1.MsgCall",
  "/cosmos.bank.v1beta1.MsgSend",
];

const wagmiConfig = createConfig({
  chains: [evm1Wagmi],
  connectors: [injected()],
  transports: {
    [evm1Wagmi.id]: http(),
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  // Optimized QueryClient for production
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,        // 30s before refetch
        gcTime: 5 * 60 * 1000,       // 5min cache lifetime
        refetchOnWindowFocus: false,  // avoid unnecessary refetches
        retry: 2,                     // retry twice on failure
      },
    },
  }));

  useEffect(() => {
    try {
      injectStyles(InterwovenKitStyles);
    } catch (e) {
      console.warn("Initia styles injection failed:", e);
    }
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={INITIA_EVM_CHAIN_SLUG}
          usernamesModuleAddress="0x42cd8467b1c86e59bf319e5664a09b6b5840bb3fac64f5ce690b5041c530565a"
          lockStakeModuleAddress="0x81c3ea419d2fd3a27971021d9dd3cc708def05e5d6a09d39b2f1f9ba18312264"
          enableAutoSign={{
            [INITIA_EVM_CHAIN_SLUG]: AUTO_SIGN_MESSAGES,
            [INITIA_EVM_CHAIN_ID_STR]: AUTO_SIGN_MESSAGES,
          }}
        >
          {children}
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
