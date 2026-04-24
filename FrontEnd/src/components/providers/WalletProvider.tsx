"use client";

import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from "@initia/interwovenkit-react";
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, Component, ErrorInfo } from "react";
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

interface ErrorBoundaryState {
  hasError: boolean;
  retryKey: number;
}

class WalletErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[WalletProvider] Connection error, retrying in 5s:", error.message);
    this.retryTimer = setTimeout(() => {
      this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
    }, 5000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      // Render nothing while waiting to retry — children lose wallet context temporarily
      return null;
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function InterwovenKitWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      injectStyles(InterwovenKitStyles);
    } catch (e) {
      console.warn("Initia styles injection failed:", e);
    }
  }, []);

  return (
    <WalletErrorBoundary>
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
    </WalletErrorBoundary>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: 3000,
      },
    },
  }));

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitWrapper>{children}</InterwovenKitWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
