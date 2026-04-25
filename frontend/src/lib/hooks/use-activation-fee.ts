"use client";

import { useAccount, useBalance, useSendTransaction, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
import {
  ACTIVATION_FEE_INIT,
  CONTRACTS,
  INITIA_EVM_CHAIN_ID,
  SUBSCRIPTION_FEE_INIT,
  type EvmHash,
} from "@initia-agent/shared";

export type FeeKind = "activation" | "subscription";

export interface FeeReceipt {
  kind: FeeKind;
  amountInit: number;
  txHash: EvmHash;
}

export function useActivationFee() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
    chainId: INITIA_EVM_CHAIN_ID,
  });

  const walletInit = Number(balance?.formatted ?? 0);

  const chargeFee = async (kind: FeeKind): Promise<FeeReceipt> => {
    if (!address) throw new Error("Connect a wallet to pay the activation fee");

    const amountInit = kind === "activation" ? ACTIVATION_FEE_INIT : SUBSCRIPTION_FEE_INIT;

    if (walletInit < amountInit) {
      throw new Error(
        `Need ${amountInit} INIT in your wallet to ${kind === "activation" ? "deploy" : "subscribe"}. ` +
        `You have ${walletInit.toFixed(4)} INIT.`
      );
    }

    if (chainId !== INITIA_EVM_CHAIN_ID) {
      await switchChainAsync({ chainId: INITIA_EVM_CHAIN_ID });
    }

    const txHash = await sendTransactionAsync({
      to: CONTRACTS.TREASURY,
      value: parseUnits(amountInit.toString(), 18),
    });

    await refetchBalance();

    return { kind, amountInit, txHash };
  };

  return {
    chargeFee,
    activationFeeInit: ACTIVATION_FEE_INIT,
    subscriptionFeeInit: SUBSCRIPTION_FEE_INIT,
    walletInit,
    treasuryAddress: CONTRACTS.TREASURY,
  };
}
