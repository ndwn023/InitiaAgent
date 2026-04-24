# Contract Addresses

All contracts are deployed on the **Initia evm-1 testnet**.

## Network Details

| Parameter | Value |
|---|---|
| Network | evm-1 (Initia MiniEVM L2 testnet) |
| Chain ID | `2124225178762456` |
| JSON-RPC | `https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz` |
| Block Explorer | `https://scan.testnet.initia.xyz/evm-1` |
| Deployer | `0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE` |

## Core Contracts

| Contract | Address | Explorer |
|---|---|---|
| AgentRegistry | `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D) |
| AgentExecutor | `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x0777CA550E0dFB9c64deb88A871a3ad867c2e014) |
| ProfitSplitter | `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F) |
| AgentVault (Agent #1) | `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6) |

## Mock Contracts (Testnet Only)

| Contract | Address | Explorer |
|---|---|---|
| MockERC20 (INIT) | `0x2A3888Bd6865D2C360D11F284FE773379fb98E30` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x2A3888Bd6865D2C360D11F284FE773379fb98E30) |
| MockERC20 (USDC) | `0x44cB6c715b9Aba693f87e1660B1728b7aD083620` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x44cB6c715b9Aba693f87e1660B1728b7aD083620) |
| MockInitiaDEX | `0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9) |

## Native Tokens

| Token | Address | Note |
|---|---|---|
| INIT (Native ERC-20) | `0x2eE7007DF876084d4C74685e90bB7f4cd7c86e22` | Real INIT on evm-1 |

## Precompiles

| Precompile | Address |
|---|---|
| ICosmos | `0x00000000000000000000000000000000000000f1` |

## Verification

Automated contract verification (Sourcify/Etherscan) is not supported for chain ID `2124225178762456`. Flattened source files for manual verification are available in `SmartContract/flattened/`.

| Contract | Flattened Source |
|---|---|
| AgentRegistry | `flattened/AgentRegistry.flat.sol` |
| AgentVault | `flattened/AgentVault.flat.sol` |
| AgentExecutor | `flattened/AgentExecutor.flat.sol` |
| ProfitSplitter | `flattened/ProfitSplitter.flat.sol` |
| MockERC20 | `flattened/MockERC20.flat.sol` |
| MockInitiaDEX | `flattened/MockInitiaDEX.flat.sol` |
