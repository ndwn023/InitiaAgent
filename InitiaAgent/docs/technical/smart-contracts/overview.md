# Smart Contracts Overview

## Contract System

```mermaid
graph LR
    subgraph Roles
        Sub["Subscriber"]
        Cre["Creator"]
        Run["Runner"]
    end

    Sub -->|"deposit / withdraw"| V["AgentVault"]
    Cre -->|"set params / pause"| V
    Cre -->|"authorizeRunner"| E["AgentExecutor"]
    Run -->|"executeSwap"| E

    E -->|"approveForTrade"| V
    E -->|"swap"| DEX["InitiaDEX"]
    DEX -->|"returns"| V
    E -->|"updateVolume"| R["AgentRegistry"]

    PS["ProfitSplitter"] -->|"snapshot / withdraw"| V
    PS -->|"fee"| T["Treasury"]
    PS -->|"share"| Cre

    style V fill:#1a4d2e,stroke:#22c55e,color:#fff
    style E fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style R fill:#1a4d4d,stroke:#06b6d4,color:#fff
    style PS fill:#5c1a1a,stroke:#ef4444,color:#fff
    style DEX fill:#5c3d1a,stroke:#f59e0b,color:#fff
```

InitiaAgent consists of four core contracts deployed on Initia evm-1 (Solidity 0.8.24):

| Contract | Responsibility |
|---|---|
| [AgentRegistry](./agent-registry.md) | Central directory of all agents. Tracks subscribers, volume, and status. |
| [AgentVault](./agent-vault.md) | Holds subscriber funds. Issues shares. Gates trade approvals. |
| [AgentExecutor](./agent-executor.md) | Validates runner authorization. Dispatches swaps to DEX. |
| [ProfitSplitter](./profit-splitter.md) | Epoch-based profit distribution to protocol, creator, and subscribers. |

## Supporting Contracts

| Contract | Purpose |
|---|---|
| `InitiaDEXAdapter` | Production swap adapter via ICosmos precompile |
| `MockInitiaDEX` | Test DEX with configurable exchange rates |
| `MockERC20` | Test tokens (INIT, USDC) with public mint |
| `ICosmos` | Interface for Initia Cosmos precompile at `0x...f1` |

## Access Control Matrix

| Action | Creator | Subscriber | Runner | Executor | Splitter | Owner |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `deposit` | | Yes | | | | |
| `withdraw` | | Yes | | | | |
| `approveForTrade` | | | | Yes | | |
| `executeSwap` | | | Yes | | | |
| `withdrawForSplitter` | | | | | Yes | |
| `distributeProfit` | Anyone | Anyone | Anyone | Anyone | Anyone | Anyone |
| `pauseVault` | Yes | | | | | |
| `setExecutor` (registry) | | | | | | Yes |
| `updateDEX` | | | | | | Yes |

## Security Invariants

1. **Creator cannot steal funds** — no path to call `withdraw` or access subscriber shares
2. **Splitter is set once** — `setSplitter` reverts on second call (`SplitterAlreadySet`)
3. **Withdrawal always available** — no `whenNotPaused` guard on `withdraw`
4. **Trade size is capped** — `maxTradeBps` hard cap at 30% (3,000 bps)
5. **Cooldown enforced** — minimum 60 seconds between trades
6. **Volume tracking is reliable** — executor is linked to registry via `setExecutor`

## Compiler Settings

| Setting | Value |
|---|---|
| Solidity | 0.8.24 |
| Optimizer | Enabled, 200 runs |
| Via IR | `true` |

## Error and Event Organization

All custom errors are defined in `src/errors/Errors.sol` and all events in `src/events/Events.sol`, organized by contract. Contracts inherit from these shared definitions.
