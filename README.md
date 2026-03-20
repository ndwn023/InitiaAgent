# InitiaAgent

A non-custodial AI trading agent marketplace built on Initia EVM (evm-1 MiniEVM L2 rollup). Agent creators deploy automated trading strategies that execute on behalf of subscribers, with profits distributed automatically each epoch. The core security guarantee — creators can never access subscriber principal — is enforced entirely at the smart contract level.

**Hackathon:** INITIATE Season 1 by Initia x DoraHacks
**Deadline:** April 16, 2026
**Network:** Initia evm-1 (MiniEVM L2 testnet)

---

## Deployed Contracts (evm-1 Testnet)

| Contract | Address | Explorer |
|---|---|---|
| AgentRegistry | `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D) |
| AgentExecutor | `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x0777CA550E0dFB9c64deb88A871a3ad867c2e014) |
| ProfitSplitter | `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F) |
| AgentVault (Agent #1) | `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6) |
| MockERC20 (INIT) | `0x2A3888Bd6865D2C360D11F284FE773379fb98E30` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x2A3888Bd6865D2C360D11F284FE773379fb98E30) |
| MockERC20 (USDC) | `0x44cB6c715b9Aba693f87e1660B1728b7aD083620` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0x44cB6c715b9Aba693f87e1660B1728b7aD083620) |
| MockInitiaDEX | `0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9` | [View](https://scan.testnet.initia.xyz/evm-1/accounts/0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9) |

**Deployer:** `0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE`
**Block Explorer:** https://scan.testnet.initia.xyz/evm-1

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution](#2-solution)
3. [Architecture](#3-architecture)
4. [Contract Roles and Security](#4-contract-roles-and-security)
5. [Workflow](#5-workflow)
6. [Repository Structure](#6-repository-structure)
7. [Local Development](#7-local-development)
8. [Deploy to Initia evm-1 Testnet](#8-deploy-to-initia-evm-1-testnet)
9. [Post-Deploy Steps](#9-post-deploy-steps)
10. [Run the Smoke Test](#10-run-the-smoke-test)
11. [Contract Verification](#11-contract-verification)
12. [Test Suite](#12-test-suite)
13. [Known Limitations](#13-known-limitations)
14. [References](#14-references)

---

## 1. Problem Statement

Automated trading strategies — bots that execute dollar-cost averaging, liquidity rebalancing, or yield optimization — have become a dominant force in on-chain markets. However, the infrastructure for deploying these strategies on behalf of other users remains either fully custodial (the agent operator holds user funds) or limited to a single vault owner (no marketplace, no composability).

This creates two well-documented problems:

**Principal-Agent Problem in DeFi.**
When a subscriber delegates trading authority to an agent creator, the creator gains informational and operational advantages over the subscriber. Jensen and Meckling (1976) formalized this misalignment: the agent (creator) may act in their own interest at the expense of the principal (subscriber). In DeFi, this manifests as rug pulls, excessive fee extraction, or unauthorized fund movement — problems that cannot be solved by reputation alone [1].

**Custodial Risk in Automated Fund Management.**
Academic work on DeFi security consistently identifies custody as the highest-risk surface. Schär (2021) notes that "the degree of decentralization and the associated risks and opportunities depend critically on which layers of the stack remain centralized" [2]. Werner et al. (2022) further document that the majority of DeFi exploits exploit centralized control points — admin keys, upgradeable proxies, and fund custodians [3]. Existing solutions such as copy-trading platforms and yield aggregators typically rely on off-chain escrow or multisig arrangements that reintroduce the same custodial risk they claim to eliminate.

**Lack of a Non-Custodial Agent Marketplace.**
No production system today allows an arbitrary agent creator to publish a strategy, attract subscribers into a permissionless vault, execute trades through that vault, and distribute profits — all without ever touching subscriber funds directly. The gap between what is technically possible with smart contracts and what is commercially deployed represents the problem this project addresses.

---

## 2. Solution

InitiaAgent is a four-contract system that separates concerns cleanly:

- **Subscribers** deposit tokens and receive shares. They can withdraw at any time, even when the vault is paused.
- **Creators** define strategy parameters (trade size limit, cooldown interval, allowed tokens) but are structurally blocked from withdrawing subscriber funds.
- **Runners** (off-chain bots or AI agents) submit signed swap commands. Each command is validated by the executor before any fund movement occurs.
- **The protocol** takes a fixed basis-point fee per epoch, distributed automatically without requiring any privileged call.

The Initia evm-1 MiniEVM chain is the natural deployment target because the `ICosmos` precompile (`0x...f1`) enables direct interaction with the Initia DEX module from Solidity, removing the need for a wrapped DEX contract and enabling atomic cross-layer swaps within a single EVM transaction.

---

## 3. Architecture

```
                        Off-chain runner / AI agent
                                    |
                                    | executeSwap()
                                    v
Subscriber --> deposit() --> AgentVault <----> AgentExecutor <----> InitiaDEX
Subscriber <-- withdraw()        |                  |             (Cosmos precompile)
                                 |                  |
                            snapshotValue()    updateVolumeTraded()
                                 |                  |
                                 v                  v
                          ProfitSplitter <--> AgentRegistry
                                 |
                    +-----------+----------+
                    |           |          |
              protocolFee  creatorShare  subscriberShare
              (treasury)   (creator)    (stays in vault)
```

**Contract responsibilities:**

| Contract | Role |
|---|---|
| `AgentRegistry` | Directory of all agents. Tracks subscriber counts, volume traded, and active status. Authorizes the executor to update volume. |
| `AgentVault` | Holds subscriber funds. Issues proportional shares on deposit. Gates all trade approvals through size and cooldown checks. The only fund outflow paths are `withdraw` (subscriber) and `withdrawForSplitter` (splitter contract only). |
| `AgentExecutor` | Validates runner authorization, checks agent activity, enforces deadlines, pulls funds from vault, dispatches swap to DEX, then reconciles vault accounting. |
| `ProfitSplitter` | Snapshots vault value at epoch boundaries. On `distributeProfit`, computes gross profit, deducts protocol fee and creator share, and leaves subscriber share in the vault. |

**Additional files:**

| File | Purpose |
|---|---|
| `src/interfaces/ICosmos.sol` | Interface for the Initia Cosmos precompile at `0x00000000000000000000000000000000000000f1` |
| `src/adapters/InitiaDEXAdapter.sol` | Production swap adapter implementing `IInitiaDEX` via `ICosmos.execute_cosmos` |
| `src/mocks/MockInitiaDEX.sol` | Test-only DEX with configurable exchange rates and slippage bypass |

---

## 4. Contract Roles and Security

### Access control matrix

| Action | Creator | Subscriber | Runner | Executor | Splitter | Owner |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `deposit` | | Yes | | | | |
| `withdraw` | | Yes | | | | |
| `approveForTrade` | | | | Yes | | |
| `executeSwap` | | | Yes | | | |
| `withdrawForSplitter` | | | | | Yes | |
| `distributeProfit` | | | | | | |
| `pauseVault` | Yes | | | | | |
| `unpauseVault` | Yes | | | | | |
| `setExecutor` (registry) | | | | | | Yes |
| `updateDEX` | | | | | | Yes |

Note: `distributeProfit` is permissionless — anyone can call it once an epoch has elapsed.

### Security invariants

- **Creator cannot steal funds.** Creators control strategy parameters (trade size, cooldown, allowed tokens) but have no path to call `withdraw` on subscriber shares, and `withdrawForSplitter` is only callable by the locked splitter address.
- **Splitter is set once.** `setSplitter` reverts with `SplitterAlreadySet` on any second call, preventing splitter replacement after registration.
- **Withdrawal always available.** `withdraw` has no `whenNotPaused` guard. Subscribers can exit regardless of creator or protocol actions.
- **Trade size is capped.** `maxTradeBps` (default 10%, hard cap 30%) limits how much of the vault can be moved per trade. Adjustable by creator within the hard cap.
- **Cooldown between trades.** `intervalSeconds` (default 15 minutes, minimum 60 seconds) enforces a minimum gap between consecutive trade approvals.
- **Volume tracking is reliable.** `AgentRegistry.setExecutor` links the executor to the registry, allowing `updateVolumeTraded` to be called from the executor directly rather than relying on the vault address check alone.

---

## 5. Workflow

### For a new agent creator

```
1. Deploy AgentVault
   - Set asset token, agentId (= registry.agentCount() + 1), creator address,
     registry address, executor address, interval, maxTradeBps, depositCap,
     and allowed token list.

2. Call registry.registerAgent(name, strategyType, vaultAddress)
   - Returns agentId. Must match the agentId passed to the vault constructor.

3. Call splitter.registerVault(agentId, vaultAddress)
   - Takes an initial snapshot of vault value. Locks the splitter into the vault.

4. Call executor.authorizeRunner(agentId, runnerAddress)
   - Grants the off-chain runner permission to call executeSwap for this agent.
```

### For a subscriber

```
1. Approve the vault to spend your asset token:
   token.approve(vaultAddress, amount)

2. Deposit:
   vault.deposit(amount)
   -> Receives proportional shares.
   -> Subscriber count in registry increments automatically.

3. To exit at any time (no lock-up):
   vault.withdraw(sharesToRedeem)
   -> Assets returned proportional to shares.
```

### For a runner (off-chain bot or AI agent)

```
1. Ensure runner is authorized for the target agentId via executor.authorizeRunner.

2. Call executor.executeSwap(agentId, tokenIn, tokenOut, amountIn, minAmountOut, deadline)
   -> Executor validates: runner auth, agent active, deadline, same-token guard, min output.
   -> Vault approves executor for amountIn (checks cooldown and trade size).
   -> Executor pulls tokenIn from vault.
   -> Executor calls dex.swap, output sent directly to vault.
   -> Vault reconciles totalAssets.
   -> Registry volume updated.
```

### For profit distribution (permissionless, callable by anyone)

```
1. Wait for epochDuration to elapse since last distribution.

2. Call splitter.distributeProfit(agentId)
   -> Checks epoch elapsed.
   -> Snapshots current vault value.
   -> If currentValue > lastSnapshot:
        protocolFee  = grossProfit * protocolFeeBps / 10000  -> treasury
        creatorShare = (grossProfit - protocolFee) * creatorShareBps / 10000  -> creator
        subscriberShare = remainder stays in vault (increases share value)
   -> Updates snapshot. Emits ProfitDistributed.
```

---

## 6. Repository Structure

```
src/
  AgentRegistry.sol       # Agent directory
  AgentVault.sol          # Subscriber fund custody and share accounting
  AgentExecutor.sol       # Trade gatekeeper and DEX dispatcher
  ProfitSplitter.sol      # Epoch-based profit distribution
  adapters/
    InitiaDEXAdapter.sol  # Production DEX adapter via ICosmos precompile
  interfaces/
    IAgentRegistry.sol
    IAgentVault.sol
    IAgentExecutor.sol
    IProfitSplitter.sol
    IInitiaDEX.sol
    ICosmos.sol           # Initia Cosmos precompile interface
  mocks/
    MockERC20.sol
    MockInitiaDEX.sol
  errors/
    Errors.sol
  events/
    Events.sol

script/
  Deploy.s.sol            # Production deploy (requires existing tokens and DEX)
  DeployLocal.s.sol       # Full deploy with mock tokens and mock DEX
  Interactions.s.sol      # Post-deploy smoke test

test/
  unit/
    AgentRegistry.t.sol
    AgentVault.t.sol
    AgentExecutor.t.sol
    ProfitSplitter.t.sol
  invariant/
    AgentVault.invariant.t.sol
  helpers/
    TestSetup.sol
```

---

## 7. Local Development

**Requirements:** Foundry (forge, cast, anvil)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Clone and install dependencies
git clone <repo-url>
cd initiateHacksUKDW
forge install

# Build
forge build

# Run all tests
forge test -vv

# Run with gas report
forge test --gas-report

# Coverage
forge coverage --report summary
```

**Expected test output:** 71 tests pass across 4 unit suites and 1 invariant suite.

---

## 8. Deploy to Initia evm-1 Testnet

### Network details

| Parameter | Value |
|---|---|
| Network name | evm-1 (Initia MiniEVM L2 testnet) |
| EVM Chain ID | `2124225178762456` |
| JSON-RPC | `https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz` |
| Block explorer | `https://scan.testnet.initia.xyz/evm-1` |
| INIT token (ERC-20) | `0x2eE7007DF876084d4C74685e90bB7f4cd7c86e22` |
| Bridge (L1 to evm-1) | `https://app.testnet.initia.xyz/?openBridge=true` |
| L1 faucet | `https://faucet.testnet.initia.xyz/` |

### Prerequisites

1. **Get testnet INIT:** Visit the faucet at `https://faucet.testnet.initia.xyz/` and request INIT for your wallet address.
2. **Bridge to evm-1:** Visit `https://app.testnet.initia.xyz/?openBridge=true`, select From: Initia L1, To: evm-1, bridge at least 5 INIT.
3. **Verify L2 balance:**
   ```bash
   cast balance <YOUR_WALLET_ADDRESS> \
     --rpc-url https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz \
     --ether
   ```

### Environment setup

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
PRIVATE_KEY=0x<your_private_key>
INITIA_TESTNET_RPC=https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz
INIT_TOKEN_ADDRESS=0x2eE7007DF876084d4C74685e90bB7f4cd7c86e22
PROTOCOL_TREASURY=0x<your_wallet_address>
PROTOCOL_FEE_BPS=200
CREATOR_SHARE_BPS=2000
EPOCH_DURATION_SECONDS=604800
```

### Run deploy

`DeployLocal.s.sol` deploys the full stack including mock USDC and mock DEX. Use this for testnet.

```bash
source .env

forge script script/DeployLocal.s.sol \
  --rpc-url https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz \
  --broadcast \
  --chain-id 2124225178762456 \
  --private-key $PRIVATE_KEY
```

The console output will print all deployed addresses:

```
=== InitiaAgent Local Deploy ===
INIT Token:    0x...
USDC Token:    0x...
DEX:           0x...
Registry:      0x...
Executor:      0x...
Splitter:      0x...
Vault:         0x...
AgentId:       1
```

Copy these into your `.env`:

```env
USDC_TOKEN_ADDRESS=0x<USDC Token from output>
DEX_ADDRESS=0x<DEX from output>
REGISTRY_ADDRESS=0x<Registry from output>
EXECUTOR_ADDRESS=0x<Executor from output>
SPLITTER_ADDRESS=0x<Splitter from output>
```

---

## 9. Post-Deploy Steps

After deploy, link the executor to the registry so volume tracking works correctly:

```bash
source .env

cast send $REGISTRY_ADDRESS \
  "setExecutor(address)" $EXECUTOR_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz
```

---

## 10. Run the Smoke Test

The `Interactions.s.sol` script performs a full end-to-end flow: deposit, swap, check balances.

```bash
source .env

forge script script/Interactions.s.sol \
  --rpc-url https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz \
  --broadcast \
  --chain-id 2124225178762456 \
  --private-key $PRIVATE_KEY
```

Expected output:

```
[1] Vault deployed: 0x...
[2] Agent registered, id: 2
[3] Vault registered in splitter
[4] Deposited: 1000000000000000000000
    Vault totalAssets: 1000000000000000000000
    Depositor shares:  1000000000000000000000
[5] Runner authorized
[5] Swap executed, amountOut: 200000000000000000000
    Vault totalAssets after swap: 1100000000000000000000
=== Smoke test complete ===
```

---

## 11. Contract Verification

The Initia evm-1 testnet uses Celatone as its block explorer. Automated CLI verification via Sourcify or Etherscan is not supported for this chain ID (`2124225178762456`) as it is not yet registered in those services.

**Manual verification via Initia Scan UI:**

1. Open the contract page on the explorer, for example:
   `https://scan.testnet.initia.xyz/evm-1/accounts/0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D`

2. Use the flattened source files in the `flattened/` directory of this repository. Each file contains the full contract source with all imports resolved.

3. If the explorer provides a "Verify Contract" button, submit:
   - Compiler: `solc 0.8.24`
   - Optimization: enabled, 200 runs
   - IR compilation: `via-ir: true`
   - Source: contents of the corresponding `.flat.sol` file

**Flattened source files (for manual submission):**

| Contract | Flattened File |
|---|---|
| AgentRegistry | `flattened/AgentRegistry.flat.sol` |
| AgentVault | `flattened/AgentVault.flat.sol` |
| AgentExecutor | `flattened/AgentExecutor.flat.sol` |
| ProfitSplitter | `flattened/ProfitSplitter.flat.sol` |
| MockERC20 (INIT & USDC) | `flattened/MockERC20.flat.sol` |
| MockInitiaDEX | `flattened/MockInitiaDEX.flat.sol` |

**Constructor arguments (ABI-encoded):**

```bash
# AgentRegistry
cast abi-encode "constructor(address)" 0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE

# AgentExecutor
cast abi-encode "constructor(address,address,address)" \
  0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D \
  0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9 \
  0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE

# ProfitSplitter
cast abi-encode "constructor(address,address,address,uint256,uint256,uint256)" \
  0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D \
  0x2A3888Bd6865D2C360D11F284FE773379fb98E30 \
  0xf86205FD1017dEEBfEB9Fe62e470B7fAfFF74DAE \
  200 2000 604800
```

View all contracts on the explorer: `https://scan.testnet.initia.xyz/evm-1`

---

## 12. Test Suite

| Suite | Tests | Coverage area |
|---|---|---|
| `AgentRegistry.t.sol` | 13 | Registration, deactivation, pagination, auth |
| `AgentVault.t.sol` | 27 | Deposit, withdraw, trade approval, cooldown, cap |
| `AgentExecutor.t.sol` | 19 | Runner auth, swap flow, slippage, DEX update |
| `ProfitSplitter.t.sol` | 12 | Epoch logic, distribution math, fee caps |
| `AgentVault.invariant.t.sol` | 3 | `totalAssets >= sum(shares)` never breaks |

```bash
# Run all tests
forge test -vv

# Run a specific suite
forge test --match-contract AgentVaultTest -vv

# Run a specific test
forge test --match-test test_deposit_mintsCorrectShares -vv

# Fuzz with more runs
forge test --match-contract AgentVaultInvariantTest --fuzz-runs 5000
```

---

## 13. Known Limitations

The following issues are documented but out of scope for v1:

**Trade size unit mismatch.** `approveForTrade` compares `amount` against `totalAssets * maxTradeBps` in base-asset units regardless of which token is being traded. If `tokenIn` is not the base asset, the check may allow or reject trades at unexpected sizes. Fixing this requires an on-chain oracle price feed. Acceptable for v1 where `tokenIn` is typically the base asset.

**Share dilution on multi-token reconciliation.** `reconcileAssets` only counts the base asset balance. If a swap returns a non-base token and that token is not immediately swapped back, `totalAssets` may undercount vault value until the next reconciliation. A full fix requires multi-token accounting. A `tradingActive` flag that prevents new deposits during open positions is a viable future mitigation.

**`getAmountOut` in InitiaDEXAdapter returns 0.** AMM price quotes on Initia require an off-chain RPC call to the Cosmos query layer. On-chain quote computation is not supported by the ICosmos precompile. Runners should use off-chain price feeds to compute `minAmountOut` before submitting swap commands.

---

## 14. References

[1] Jensen, M. C., & Meckling, W. H. (1976). Theory of the firm: Managerial behavior, agency costs and ownership structure. *Journal of Financial Economics*, 3(4), 305-360.
https://doi.org/10.1016/0304-405X(76)90026-X

[2] Schär, F. (2021). Decentralized finance: On blockchain- and smart contract-based financial markets. *Federal Reserve Bank of St. Louis Review*, 103(2), 153-174.
https://doi.org/10.20955/r.103.153-74

[3] Werner, S. M., Perez, D., Gudgeon, L., Klages-Mundt, A., Harz, D., & Knottenbelt, W. J. (2022). SoK: Decentralized finance (DeFi). *Proceedings of the 4th ACM Conference on Advances in Financial Technologies*, 30-46.
https://doi.org/10.1145/3558535.3559780

[4] Daian, P., Goldfeder, S., Kell, T., Li, Y., Zhao, X., Bentov, I., Breidenbach, L., & Juels, A. (2020). Flash boys 2.0: Frontrunning in decentralized exchanges, miner extractable value, and consensus instability. *2020 IEEE Symposium on Security and Privacy*, 910-927.
https://doi.org/10.1109/SP40000.2020.00040

[5] Adams, H., Zinsmeister, N., Salem, M., Keefer, R., & Robinson, D. (2021). Uniswap v3 core. *Uniswap Whitepaper*.
https://uniswap.org/whitepaper-v3.pdf
