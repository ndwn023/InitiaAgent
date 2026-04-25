/**
 * Initia EVM chain configuration — single source of truth.
 *
 * Used by:
 *   - frontend wagmi/viem config (WalletProvider)
 *   - frontend wagmi hooks (useBalance, useSwitchChain, …)
 *   - backend viem clients (routes/execute, agent worker)
 *   - Interwoven auto-sign chain IDs (both numeric and string form)
 */

// ─── Chain identifiers ────────────────────────────────────────────────────────

/** Initia EVM testnet chain id (numeric form, for EIP-155 / wagmi / viem). */
export const INITIA_EVM_CHAIN_ID = 2124225178762456 as const;

/** Interwoven rollup chain slug (`evm-1`). Used by InterwovenKit auto-sign. */
export const INITIA_EVM_CHAIN_SLUG = "evm-1" as const;

/** String form of the numeric chain id — Interwoven accepts both. */
export const INITIA_EVM_CHAIN_ID_STR = String(INITIA_EVM_CHAIN_ID);

/** All chain identifiers InterwovenKit should auto-sign on. */
export const INITIA_AUTO_SIGN_CHAIN_IDS = [
  INITIA_EVM_CHAIN_SLUG,
  INITIA_EVM_CHAIN_ID_STR,
] as const;

// ─── RPC / Explorer endpoints ─────────────────────────────────────────────────

export const INITIA_EVM_RPC_URL =
  "https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz";

/** EVM block explorer (smart contracts, EVM tx). */
export const INITIA_EVM_EXPLORER_URL = "https://scan.testnet.initia.xyz/evm-1";

/** Cosmos layer explorer (rollup accounts, cosmos tx). */
export const INITIA_COSMOS_EXPLORER_URL =
  "https://scan.testnet.initia.xyz/initiation-2";

// ─── Native currency / address helpers ────────────────────────────────────────

/** Checksummed EVM address, aligned with viem's `Address` type. */
export type EvmAddress = `0x${string}`;

/** Transaction hash on the EVM side. */
export type EvmHash = `0x${string}`;

export const INITIA_NATIVE_CURRENCY = {
  name: "INIT",
  symbol: "INIT",
  decimals: 18,
} as const;

// ─── Explorer URL builders ────────────────────────────────────────────────────

export function explorerEvmTxUrl(hash: string): string {
  return `${INITIA_EVM_EXPLORER_URL}/transactions/${hash}`;
}

export function explorerEvmAccountUrl(address: string): string {
  return `${INITIA_EVM_EXPLORER_URL}/accounts/${address}`;
}

export function explorerCosmosAccountUrl(address: string): string {
  return `${INITIA_COSMOS_EXPLORER_URL}/accounts/${address}`;
}

// ─── viem/wagmi chain descriptor ──────────────────────────────────────────────
// Plain object that can be passed to `defineChain` from viem or consumed as-is.

export const INITIA_EVM_CHAIN = {
  id: INITIA_EVM_CHAIN_ID,
  name: "Initia evm-1",
  nativeCurrency: INITIA_NATIVE_CURRENCY,
  rpcUrls: {
    default: { http: [INITIA_EVM_RPC_URL] as const },
    public: { http: [INITIA_EVM_RPC_URL] as const },
  },
  blockExplorers: {
    default: {
      name: "Initia Scan",
      url: INITIA_EVM_EXPLORER_URL,
    },
  },
  testnet: true,
} as const;

// ─── Address validation ───────────────────────────────────────────────────────

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isEvmAddress(value: unknown): value is EvmAddress {
  return typeof value === "string" && EVM_ADDRESS_RE.test(value);
}

export function assertEvmAddress(value: unknown, label = "address"): EvmAddress {
  if (!isEvmAddress(value)) {
    throw new Error(`Invalid EVM ${label}: ${String(value)}`);
  }
  return value;
}

/** Lowercase normalisation — safe for dictionary lookups and DB storage. */
export function normalizeEvmAddress(value: string): EvmAddress {
  const lower = value.trim().toLowerCase();
  return assertEvmAddress(lower, "address");
}
