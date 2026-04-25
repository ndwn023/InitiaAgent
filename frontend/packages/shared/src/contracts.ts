/**
 * Deployed contract addresses on Initia EVM testnet (chain id 2124225178762456).
 *
 * Single source of truth — change here, re-build shared, everything picks it up.
 * Address are the checksummed form produced by foundry/forge.
 */

import type { EvmAddress } from "./chain";

export const CONTRACTS = {
  AGENT_REGISTRY:      "0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D",
  AGENT_EXECUTOR:      "0x0777CA550E0dFB9c64deb88A871a3ad867c2e014",
  PROFIT_SPLITTER:     "0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F",
  AGENT_VAULT_DEFAULT: "0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6",
  MOCK_INIT:           "0x2A3888Bd6865D2C360D11F284FE773379fb98E30",
  MOCK_USDC:           "0x44cB6c715b9Aba693f87e1660B1728b7aD083620",
  MOCK_DEX:            "0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9",
  INIT_NATIVE:         "0x2eE7007DF876084d4C74685e90bB7f4cd7c86e22",
  ICOSMOS_PRECOMPILE:  "0x00000000000000000000000000000000000000f1",
  /** Deployer == treasury (receives activation / subscription fees). */
  TREASURY:            "0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE",
} as const satisfies Record<string, EvmAddress>;

export type ContractName = keyof typeof CONTRACTS;

/**
 * Backwards-compatible alias — `DEPLOYER` used to live on the CONTRACTS map.
 * Same address as `TREASURY`; exported separately to ease migration.
 */
export const DEPLOYER_ADDRESS: EvmAddress = CONTRACTS.TREASURY;
