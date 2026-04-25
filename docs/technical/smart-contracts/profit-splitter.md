# ProfitSplitter

**Address:** `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F`

Handles epoch-based profit distribution between the protocol, creators, and subscribers.

## Purpose

ProfitSplitter automates the fair distribution of trading profits. It snapshots vault values at epoch boundaries and distributes gains according to fixed ratios, without requiring any privileged caller.

## Constructor

```solidity
constructor(
    address registry,           // AgentRegistry address
    address asset,              // ERC-20 asset token
    address treasury,           // Protocol treasury address
    uint256 protocolFeeBps,     // Protocol fee (max 1000 = 10%)
    uint256 creatorShareBps,    // Creator share (max 5000 = 50%)
    uint256 epochDuration       // Seconds between distributions
)
```

## Constants

| Constant | Value | Description |
|---|---|---|
| `BPS_DENOMINATOR` | 10,000 | Basis points denominator |
| `MAX_PROTOCOL_FEE_BPS` | 1,000 | Hard cap: 10% protocol fee |
| `MAX_CREATOR_SHARE_BPS` | 5,000 | Hard cap: 50% creator share |

## Core Functions

### Vault Registration

```solidity
function registerVault(uint256 agentId, address vault) external
```

- Registers a vault for profit tracking
- Takes an initial snapshot of vault value
- Calls `vault.setSplitter(address(this))` to lock itself in
- **One-time per agent** — reverts with `AlreadyRegistered` on second call

### Profit Distribution

```solidity
function distributeProfit(uint256 agentId) external
    returns (uint256 protocolFee, uint256 creatorShare, uint256 subscriberShare)
```

**Access:** Anyone (permissionless)

**Logic:**

1. Check `block.timestamp >= lastEpochTs + epochDuration` — reverts with `EpochNotElapsed` if too early
2. Snapshot current vault value via `vault.snapshotValue()`
3. Compute `grossProfit = currentValue - lastSnapshot`
4. If no profit, revert with `NoProfit`
5. Calculate splits:
   ```
   protocolFee    = grossProfit * protocolFeeBps / 10000
   netProfit      = grossProfit - protocolFee
   creatorShare   = netProfit * creatorShareBps / 10000
   subscriberShare = grossProfit - protocolFee - creatorShare
   ```
6. Withdraw `protocolFee` from vault → treasury
7. Withdraw `creatorShare` from vault → creator
8. Reconcile vault assets
9. Update snapshot and timestamp

### Query

| Function | Returns |
|---|---|
| `canDistribute(agentId)` | `(bool ok, uint256 secondsRemaining)` — whether distribution is available |

### Admin (Owner)

| Function | Description |
|---|---|
| `setProtocolFee(bps)` | Update protocol fee (max 10%) |
| `setCreatorShare(bps)` | Update creator share (max 50%) |
| `setTreasury(address)` | Update treasury address |
| `setEpochDuration(seconds)` | Update epoch duration |

## Events

| Event | Parameters |
|---|---|
| `ProfitDistributed` | agentId, protocolFee, creatorShare, subscriberShare |
| `SnapshotTaken` | agentId, value |
| `VaultRegisteredInSplitter` | agentId, vault |
| `ProtocolFeeUpdated` | oldBps, newBps |
| `CreatorShareUpdated` | oldBps, newBps |
| `TreasuryUpdated` | oldTreasury, newTreasury |

## Errors

`EpochNotElapsed`, `NoProfit`, `VaultNotRegistered`, `InvalidProtocolFeeBps`, `InvalidCreatorShareBps`, `ZeroRegistry`, `ZeroAsset`, `ZeroTreasury`, `InvalidEpochDuration`, `AlreadyRegistered`, `Unauthorized`
