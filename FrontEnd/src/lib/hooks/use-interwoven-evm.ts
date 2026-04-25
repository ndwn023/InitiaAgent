"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import type { Abi, Hex } from "viem";
import { ensureAutoSignEnabled } from "@/lib/interwoven/auto-sign";
import { computeTradeExecution, EXECUTION_FEE_BPS } from "@initia-agent/shared";

const SUPPORTED_MOCK_TOKENS = new Set(["INIT", "USDC"]);

type WriteContractParams = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

function randomHex(numBytes: number): string {
  const bytes = new Uint8Array(numBytes);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useInterwovenEvm() {
  const { initiaAddress, autoSign, isConnected, openConnect } = useInterwovenKit();

  const ensureMockSession = async (): Promise<void> => {
    if (!isConnected || !initiaAddress) {
      openConnect();
      throw new Error("Wallet not connected");
    }
    const enabled = await ensureAutoSignEnabled(autoSign);
    if (!enabled) {
      console.warn("[InterwovenKit] Auto-sign session unavailable, proceeding in simulation mode");
    }
  };

  const signMockAction = async (): Promise<Hex> => {
    await ensureMockSession();
    return `0x${randomHex(32)}` as Hex;
  };

  const writeContract = async ({
    address: _address,
    abi: _abi,
    functionName: _functionName,
    args: _args = [],
    value: _value = 0n,
  }: WriteContractParams): Promise<string> => {
    void _address;
    void _abi;
    void _functionName;
    void _args;
    void _value;
    return signMockAction();
  };

  const batchWriteContracts = async (calls: WriteContractParams[]): Promise<string> => {
    void calls;
    return signMockAction();
  };

  const mockDexSwap = async (params: {
    fromToken: string;
    toToken: string;
    amountIn: number;
    fromPriceUsd: number;
    toPriceUsd: number;
    confidence?: number;
    strategy?: string;
  }): Promise<{ txHash: string; amountOut: number; executionFee: number }> => {
    if (!SUPPORTED_MOCK_TOKENS.has(params.fromToken) || !SUPPORTED_MOCK_TOKENS.has(params.toToken)) {
      throw new Error(`Token ${params.fromToken} or ${params.toToken} not configured`);
    }
    if (params.toPriceUsd <= 0 || params.fromPriceUsd <= 0) {
      throw new Error("Invalid token price for mock swap");
    }

    const exec = computeTradeExecution({
      amountIn: params.amountIn,
      fromPriceUsd: params.fromPriceUsd,
      toPriceUsd: params.toPriceUsd,
      confidence: params.confidence ?? 60,
      strategy: params.strategy ?? "DEFAULT",
    });

    const txHash = await signMockAction();

    return {
      txHash: txHash as string,
      amountOut: exec.amountOut,
      executionFee: exec.executionFee,
    };
  };

  return {
    writeContract,
    batchWriteContracts,
    mockDexSwap,
    ensureMockSession,
    signMockAction,
    EXECUTION_FEE_BPS,
  };
}
