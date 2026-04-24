"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { encodeFunctionData, type Abi, type Hex, parseUnits } from "viem";

// StdFee inline type (from @cosmjs/amino, available transitively)
type StdFee = { amount: Array<{ denom: string; amount: string }>; gas: string };

const EVM_CHAIN_ID = "evm-1";

// ── Contract addresses ───────────────────────────────────────────────────────
const MOCK_DEX  = "0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9" as const;
const MOCK_INIT = "0x2A3888Bd6865D2C360D11F284FE773379fb98E30" as const;
const MOCK_USDC = "0x44cB6c715b9Aba693f87e1660B1728b7aD083620" as const;

const TOKEN_MAP: Record<string, `0x${string}`> = {
  INIT: MOCK_INIT,
  USDC: MOCK_USDC,
};

// ── Minimal ABIs ─────────────────────────────────────────────────────────────
const DEX_ABI = [
  {
    type: "function", name: "setRate",
    inputs: [
      { name: "tokenIn",  type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "rate18",   type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "swap",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "tokenIn",          type: "address" },
        { name: "tokenOut",         type: "address" },
        { name: "amountIn",         type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
        { name: "recipient",        type: "address" },
        { name: "deadline",         type: "uint256" },
      ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function", name: "mint",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

type WriteContractParams = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/**
 * Convert Initia Cosmos address (init1...) to EVM address (0x...).
 * Both encodings represent the same 20 bytes:
 *   Cosmos = bech32("init", bytes20)
 *   EVM    = "0x" + hex(bytes20)
 */
function initiaToEvmAddress(initiaAddr: string): `0x${string}` {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const sepIdx = initiaAddr.lastIndexOf("1");
  if (sepIdx < 0) return "0x0000000000000000000000000000000000000000";
  // Data without 6-char checksum suffix
  const dataStr = initiaAddr.slice(sepIdx + 1, -6);
  // Decode 5-bit groups → 8-bit bytes
  const values = Array.from(dataStr).map(c => CHARSET.indexOf(c));
  let bits = 0, acc = 0;
  const bytes: number[] = [];
  for (const val of values) {
    if (val < 0) return "0x0000000000000000000000000000000000000000";
    acc = (acc << 5) | val;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  const hex = bytes.slice(0, 20).map(b => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as `0x${string}`;
}

export function useInterwovenEvm() {
  const { initiaAddress, requestTxBlock, submitTxBlock, estimateGas, autoSign, isConnected, openConnect } = useInterwovenKit();

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

  const batchWriteContracts = async (calls: WriteContractParams[]): Promise<string> => {
    const sender = initiaAddress;

    if (!isConnected || !sender) {
      openConnect();
      throw new Error("Wallet not connected");
    }

    const messages = calls.map(({ address, abi, functionName, args = [], value = 0n }) => ({
      typeUrl: "/minievm.evm.v1.MsgCall",
      value: {
        sender,
        contractAddr: address,
        input: encodeFunctionData({ abi, functionName, args }),
        value: value.toString(),
        accessList: [],
        authList: [],
      },
    }));

    const result = await requestTxBlock({ chainId: EVM_CHAIN_ID, messages });
    return result.transactionHash as Hex;
  };

  /**
   * Execute a mock DEX swap via InterwovenKit in a single batch tx:
   *   1. setRate (tokenIn → tokenOut)
   *   2. setRate (tokenOut → tokenIn)
   *   3. mint(walletEvmAddr, amountIn)   ← get test tokens
   *   4. approve(MockDEX, amountIn)
   *   5. swap(params)
   *
   * No AgentExecutor / runner auth required — MockDEX is fully open.
   */
  const mockDexSwap = async (params: {
    fromToken: string;   // "INIT" | "USDC"
    toToken: string;     // "INIT" | "USDC"
    amountIn: number;    // human-readable amount
    fromPriceUsd: number;
    toPriceUsd: number;
  }): Promise<{ txHash: string; amountOut: number }> => {
    const sender = initiaAddress;
    if (!isConnected || !sender) {
      openConnect();
      throw new Error("Wallet not connected");
    }

    const tokenInAddr  = TOKEN_MAP[params.fromToken];
    const tokenOutAddr = TOKEN_MAP[params.toToken];
    if (!tokenInAddr || !tokenOutAddr) {
      throw new Error(`Token ${params.fromToken} or ${params.toToken} not configured`);
    }

    // Derive EVM address from Cosmos address (same 20 bytes, different encoding)
    const evmRecipient = initiaToEvmAddress(sender);

    // Rates scaled by 1e18
    const rate18In  = BigInt(Math.floor((params.fromPriceUsd / params.toPriceUsd) * 1e15)) * 1000n;
    const rate18Out = BigInt(Math.floor((params.toPriceUsd / params.fromPriceUsd) * 1e15)) * 1000n;

    const amountInWei  = parseUnits(params.amountIn.toString(), 18);
    const deadline     = BigInt(Math.floor(Date.now() / 1000) + 300);
    const amountOutRaw = Number(amountInWei) * Number(rate18In) / 1e18;
    const amountOut    = amountOutRaw / 1e18; // convert from wei

    const messages = [
      // 1. Set rate tokenIn → tokenOut
      {
        typeUrl: "/minievm.evm.v1.MsgCall",
        value: {
          sender,
          contractAddr: MOCK_DEX,
          input: encodeFunctionData({ abi: DEX_ABI as Abi, functionName: "setRate", args: [tokenInAddr, tokenOutAddr, rate18In] }),
          value: "0",
          accessList: [],
          authList: [],
        },
      },
      // 2. Set rate tokenOut → tokenIn (inverse)
      {
        typeUrl: "/minievm.evm.v1.MsgCall",
        value: {
          sender,
          contractAddr: MOCK_DEX,
          input: encodeFunctionData({ abi: DEX_ABI as Abi, functionName: "setRate", args: [tokenOutAddr, tokenInAddr, rate18Out] }),
          value: "0",
          accessList: [],
          authList: [],
        },
      },
      // 3. Mint tokenIn to wallet (MockERC20 is open)
      {
        typeUrl: "/minievm.evm.v1.MsgCall",
        value: {
          sender,
          contractAddr: tokenInAddr,
          input: encodeFunctionData({ abi: ERC20_ABI as Abi, functionName: "mint", args: [evmRecipient, amountInWei] }),
          value: "0",
          accessList: [],
          authList: [],
        },
      },
      // 4. Approve MockDEX to spend tokenIn
      {
        typeUrl: "/minievm.evm.v1.MsgCall",
        value: {
          sender,
          contractAddr: tokenInAddr,
          input: encodeFunctionData({ abi: ERC20_ABI as Abi, functionName: "approve", args: [MOCK_DEX, amountInWei] }),
          value: "0",
          accessList: [],
          authList: [],
        },
      },
      // 5. Execute swap
      {
        typeUrl: "/minievm.evm.v1.MsgCall",
        value: {
          sender,
          contractAddr: MOCK_DEX,
          input: encodeFunctionData({
            abi: DEX_ABI as Abi,
            functionName: "swap",
            args: [{
              tokenIn:          tokenInAddr,
              tokenOut:         tokenOutAddr,
              amountIn:         amountInWei,
              amountOutMinimum: 1n,
              recipient:        evmRecipient,
              deadline,
            }],
          }),
          value: "0",
          accessList: [],
          authList: [],
        },
      },
    ];

    // Use submitTxBlock (no UI popup) when auto-sign session is active,
    // otherwise fall back to requestTxBlock (shows approval UI once for session setup).
    let result;
    const isAutoSignActive = autoSign?.isEnabledByChain?.[EVM_CHAIN_ID];
    if (isAutoSignActive) {
      // Estimate gas then submit silently
      const gasEstimate = await estimateGas({ messages, chainId: EVM_CHAIN_ID }).catch(() => 3_000_000);
      const gasLimit = Math.ceil(gasEstimate * 1.4); // 40% buffer
      const fee: StdFee = {
        amount: [{ denom: "uinit", amount: String(Math.ceil(gasLimit * 0.015)) }],
        gas: String(gasLimit),
      };
      result = await submitTxBlock({ messages, chainId: EVM_CHAIN_ID, fee });
    } else {
      // First time or session expired → shows one-time approval UI to set up session
      result = await requestTxBlock({ chainId: EVM_CHAIN_ID, messages });
    }

    return {
      txHash: result.transactionHash as string,
      amountOut,
    };
  };

  return { writeContract, batchWriteContracts, mockDexSwap };
}
