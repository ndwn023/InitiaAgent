# Profit Sharing

Profit distribution in InitiaAgent is automated, permissionless, and epoch-based.

## How It Works

At the end of each epoch, anyone can trigger profit distribution by calling `ProfitSplitter.distributeProfit(agentId)`. There is no privileged caller — this is a fully permissionless operation.

### Distribution Flow

```mermaid
flowchart TD
    A["Anyone calls distributeProfit(agentId)"] --> B{Epoch elapsed?}
    B -- No --> C["Revert: EpochNotElapsed"]
    B -- Yes --> D["Snapshot current vault value"]
    D --> E{"currentValue > lastSnapshot?"}
    E -- No --> F["Revert: NoProfit"]
    E -- Yes --> G["grossProfit = current - lastSnapshot"]
    G --> H["protocolFee = grossProfit * 2%"]
    G --> I["creatorShare = netProfit * 20%"]
    G --> J["subscriberShare = remainder"]
    H --> K["Transfer to Treasury"]
    I --> L["Transfer to Creator"]
    J --> M["Stays in Vault (share value increases)"]
    K --> N["Update snapshot + timestamp"]
    L --> N
    M --> N

    style C fill:#5c1a1a,stroke:#ef4444,color:#fff
    style F fill:#5c1a1a,stroke:#ef4444,color:#fff
    style K fill:#5c3d1a,stroke:#f59e0b,color:#fff
    style L fill:#1a4d4d,stroke:#06b6d4,color:#fff
    style M fill:#1a4d2e,stroke:#22c55e,color:#fff
```

### Distribution Formula

```
grossProfit = currentVaultValue - lastSnapshotValue

protocolFee    = grossProfit * 2%      → Protocol Treasury
creatorShare   = (grossProfit - protocolFee) * 20%  → Creator Wallet
subscriberShare = remainder            → Stays in Vault
```

### Effective Split

| Recipient | Share of Gross Profit | How They Receive It |
|---|---|---|
| **Protocol** | 2% | Transferred to treasury address |
| **Creator** | ~19.6% | Transferred to creator wallet |
| **Subscribers** | ~78.4% | Remains in vault, increases share value |

Subscribers don't need to claim their share — it automatically increases the value of their vault shares.

## Epoch Timing

| Parameter | Default | Range |
|---|---|---|
| `epochDuration` | 7 days (604,800 seconds) | Configurable by protocol owner |

Distribution can only be triggered after the epoch duration has elapsed since the last distribution. The `canDistribute(agentId)` view function returns whether distribution is available and how many seconds remain.

## Fee Caps

Both the protocol fee and creator share have hard caps enforced at the contract level:

| Parameter | Hard Cap |
|---|---|
| `protocolFeeBps` | 10% (1,000 bps) |
| `creatorShareBps` | 50% (5,000 bps) |

These caps cannot be exceeded, even by the contract owner.

## No-Profit Epochs

If the vault value has not increased since the last snapshot (no profit was generated), `distributeProfit` reverts with `NoProfit`. No fees are extracted during flat or negative periods.

## Snapshot Mechanism

```mermaid
stateDiagram-v2
    [*] --> RegisterVault: registerVault()
    RegisterVault --> InitialSnapshot: Take initial snapshot
    InitialSnapshot --> WaitEpoch: Start epoch timer
    WaitEpoch --> CheckProfit: Epoch elapsed
    CheckProfit --> Distribute: Profit > 0
    CheckProfit --> WaitEpoch: No profit (revert)
    Distribute --> NewSnapshot: Update snapshot
    NewSnapshot --> WaitEpoch: Start next epoch
```

1. On vault registration, `ProfitSplitter.registerVault()` takes an initial snapshot of the vault's `totalAssets`
2. After each successful distribution, a new snapshot is taken
3. The snapshot is the baseline for computing profit in the next epoch

This ensures that profit is only calculated on **new gains** since the last distribution.
