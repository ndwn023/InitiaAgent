# Smart Contract Specification

This document details the core smart contracts of the **InitiaAgent** system, deployed on the Initia `evm-1` L2 rollup.

## 1. AgentRegistry
**Address:** `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D`

The central directory of all trading agents.
- **registerAgent(name, strategyType, vaultAddress)**: Deploys a new entry in the registry.
- **setExecutor(executorAddress)**: Links the executor to allow volume tracking updates.
- **deactivateAgent(agentId)**: Stops an agent from accepting new trades (admin or creator).

## 2. AgentVault
**Address (Agent #1):** `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6`

Manages subscriber funds and shares using an ERC-4626 style vault approach.
- **deposit(amount)**: Subscriber deposits assets, receives shares.
- **withdraw(shares)**: Subscriber redeems shares for principal + profit.
- **approveForTrade(amount)**: Only callable by the `AgentExecutor`. Validates `maxTradeBps` and `intervalSeconds` (cooldown).

## 3. AgentExecutor
**Address:** `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014`

The gateway for trade execution.
- **executeSwap(agentId, tokenIn, tokenOut, amountIn, minAmountOut, deadline)**: Dispatches a swap to the `InitiaDEX` via the `ICosmos` precompile.
- **authorizeRunner(agentId, runnerAddress)**: Grants an off-chain AI runner permission to trigger trades.

## 4. ProfitSplitter
**Address:** `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F`

Handles epoch-based profit sharing.
- **distributeProfit(agentId)**: Permissionless function. Logic:
  - If current value > last snapshot:
    - 2% to Protocol Treasury
    - 20% to Creator
    - 78% stays in vault for Subscribers (accrues to share value).

---

## Security Model

| Feature | Enforcement |
|---|---|
| Principal Safety | Principal never leaves the vault except for trades via authorized Executor. |
| Role Separation | Runner triggers trades; Creator sets bounds; Protocol handles fees. |
| Invariant | `totalAssets >= sum(shares)` (strictly enforced for non-base tokens). |
