# AgentVault

**Address (Agent #1):** `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6`

The non-custodial fund manager. Holds subscriber deposits, issues proportional shares, and gates all trade approvals through strict validation.

## Purpose

AgentVault is the financial core of each agent. It ensures that subscriber funds are never directly accessible to the creator, while allowing authorized executors to trade within defined bounds.

## Constructor

```solidity
constructor(
    address asset,          // ERC-20 token used for deposits
    uint256 agentId,        // Must match registry assignment
    address creator,        // Strategy creator address
    address registry,       // AgentRegistry address
    address executor,       // AgentExecutor address
    uint256 intervalSeconds,// Cooldown between trades (min 60s)
    uint256 maxTradeBps,    // Max trade size in bps (max 3000 = 30%)
    uint256 depositCap,     // Maximum total deposits (0 = unlimited)
    address[] allowedTokens // Whitelisted tokens for trading
)
```

## Constants

| Constant | Value | Description |
|---|---|---|
| `BPS_DENOMINATOR` | 10,000 | Basis points denominator |
| `MAX_TRADE_BPS` | 3,000 | Hard cap: 30% per trade |
| `MIN_INTERVAL` | 60 | Hard floor: 60 seconds between trades |

## Core Functions

### Deposit & Withdraw

| Function | Access | Description |
|---|---|---|
| `deposit(assets)` | Anyone (not paused) | Deposit tokens, receive proportional shares. First deposit is 1:1. |
| `withdraw(sharesToRedeem)` | Shareholder | Redeem shares for assets. **Always available**, even when paused. |

### Trade Approval

| Function | Access | Description |
|---|---|---|
| `approveForTrade(token, amount)` | Executor only | Approve executor to pull tokens. Validates cooldown, size, and whitelist. |

### Accounting

| Function | Access | Description |
|---|---|---|
| `reconcileAssets()` | Executor or Splitter | Sync `totalAssets` with actual token balance. |
| `snapshotValue()` | Splitter only | Return current `totalAssets` for profit calculation. |
| `withdrawForSplitter(to, amount)` | Splitter only | Transfer assets for profit distribution. |

### Admin (Creator)

| Function | Access | Description |
|---|---|---|
| `pauseVault()` | Creator | Pause new deposits. Does **not** block withdrawals. |
| `unpauseVault()` | Creator | Resume deposits. |
| `updateDepositCap(newCap)` | Creator | Change the deposit cap. |
| `updateExecutor()` | Creator | Update executor address. |
| `setSplitter(splitter)` | Splitter (self-register) | Set splitter address. **One-time only.** |

## View Functions

| Function | Returns |
|---|---|
| `previewDeposit(assets)` | Expected shares for a given deposit amount |
| `previewWithdraw(shares)` | Expected assets for a given share redemption |
| `getSubscriberAssets(subscriber)` | Asset value of a subscriber's shares |

## Trade Validation Pipeline

When `approveForTrade` is called, the vault checks:

1. **Token whitelist** — `allowedTokens[token]` must be true
2. **Cooldown** — `block.timestamp - lastExecutionTs >= intervalSeconds`
3. **Trade size** — `amount <= totalAssets * maxTradeBps / 10000`

If all checks pass, the vault approves the executor to pull the specified amount.

## Events

`Deposited`, `Withdrawn`, `TradeApproved`, `TotalAssetsReconciled`, `VaultPaused`, `VaultUnpaused`, `DepositCapUpdated`, `ExecutorUpdated`, `SplitterSet`, `SplitterWithdrawal`

## Errors

`ZeroAmount`, `ZeroShares`, `InsufficientShares`, `InsufficientAssets`, `DepositCapExceeded`, `TokenNotWhitelisted`, `ExceedsMaxTradePercent`, `CooldownNotElapsed`, `NotExecutor`, `NotCreator`, `NotSplitter`, `VaultPaused`, `SplitterAlreadySet`, `InvalidParam`, `MaxTradePercentOutOfRange`, `IntervalTooShort`, `UnauthorizedReconciler`
