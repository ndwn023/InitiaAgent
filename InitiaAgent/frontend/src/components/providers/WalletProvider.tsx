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

const evm1Wagmi = defineChain({
  id: 2124225178762456,
  name: "Initia evm-1",
  nativeCurrency: {
    name: "INIT",
    symbol: "INIT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz"],
    },
    public: { http: ["https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Initia Scan",
      url: "https://scan.testnet.initia.xyz/evm-1",
    },
  },
  testnet: true,
});

const wagmiConfig = createConfig({
  chains: [evm1Wagmi],
  connectors: [injected()],
  transports: {
    [evm1Wagmi.id]: http(),
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

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
          defaultChainId="evm-1"
          usernamesModuleAddress="0x42cd8467b1c86e59bf319e5664a09b6b5840bb3fac64f5ce690b5041c530565a"
          lockStakeModuleAddress="0x81c3ea419d2fd3a27971021d9dd3cc708def05e5d6a09d39b2f1f9ba18312264"
          enableAutoSign={{
            "evm-1": [
              "/minievm.evm.v1.MsgCall",
              "/cosmos.bank.v1beta1.MsgSend",
            ],
            "2124225178762456": [
              "/minievm.evm.v1.MsgCall",
              "/cosmos.bank.v1beta1.MsgSend",
            ],
          }}
        >
          {children}
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
