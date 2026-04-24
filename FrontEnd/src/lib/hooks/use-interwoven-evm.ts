"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { encodeFunctionData, type Abi, type Hex } from "viem";

const EVM_CHAIN_ID = "evm-1";

type WriteContractParams = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

export function useInterwovenEvm() {
  const { initiaAddress, requestTxBlock, isConnected, openConnect } = useInterwovenKit();

  const writeContract = async ({
    address,
    abi,
    functionName,
    args = [],
    value = 0n,
  }: WriteContractParams): Promise<string> => {
    const sender = initiaAddress;

    if (!isConnected || !sender) {
      openConnect();
      throw new Error("Wallet not connected");
    }

    const input = encodeFunctionData({
      abi,
      functionName,
      args,
    });

    const result = await requestTxBlock({
      chainId: EVM_CHAIN_ID,
      messages: [
        {
          typeUrl: "/minievm.evm.v1.MsgCall",
          value: {
            sender,
            contractAddr: address,
            input,
            value: value.toString(),
            accessList: [],
            authList: [],
          },
        },
      ],
    });

    return result.transactionHash as Hex;
  };

  return { writeContract };
}
