# AgentExecutor

**Address:** `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014`

The gateway for trade execution. Validates runner authorization, enforces safety checks, and dispatches swaps to the DEX.

## Purpose

AgentExecutor sits between off-chain runners and on-chain vaults. It ensures that only authorized runners can trigger trades, and that every trade passes a comprehensive validation pipeline before any funds are moved.

## Constructor

```solidity
constructor(
    address registry,  // AgentRegistry address
    address dex,       // DEX address (InitiaDEXAdapter or MockInitiaDEX)
    address owner      // Contract owner
)
```

## Core Functions

### Runner Management

| Function | Access | Description |
|---|---|---|
| `authorizeRunner(agentId, runner)` | Creator | Grant a runner permission to execute trades for an agent. Caches the vault address. |
| `revokeRunner(agentId, runner)` | Creator | Remove a runner's authorization. |
| `isRunnerAuthorized(agentId, runner)` | View | Check if a runner is authorized. |

### Trade Execution

```solidity
function executeSwap(
    uint256 agentId,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external returns (uint256 amountOut)
```

**Access:** Authorized runner only

**Validation pipeline:**

| Step | Check | Error on Failure |
|---|---|---|
| 1 | Runner is authorized for `agentId` | `NotAuthorizedRunner` |
| 2 | Agent is active in registry | `AgentNotActive` |
| 3 | `block.timestamp <= deadline` | `DeadlineExpired` |
| 4 | `tokenIn != tokenOut` | `SameToken` |
| 5 | `minAmountOut > 0` | `ZeroMinOutput` |

**Execution flow:**

1. Call `vault.approveForTrade(tokenIn, amountIn)` — vault validates cooldown + size
2. Pull `tokenIn` from vault to executor
3. Approve DEX to spend `tokenIn`
4. Call `dex.swap(params)` — output sent directly to vault
5. Verify `amountOut >= minAmountOut` — reverts with `SlippageExceeded` if not
6. Call `vault.reconcileAssets()` — update vault accounting
7. Call `registry.updateVolumeTraded(agentId, amountIn)` — track volume

### DEX Management

| Function | Access | Description |
|---|---|---|
| `updateDEX(newDex)` | Owner | Update the DEX address. Reverts with `InvalidDEX` if zero address. |

## Events

| Event | Parameters |
|---|---|
| `SwapExecuted` | agentId, tokenIn, tokenOut, amountIn, amountOut |
| `RunnerAuthorized` | agentId, runner |
| `RunnerRevoked` | agentId, runner |
| `DEXUpdated` | oldDex, newDex |

## Errors

`NotAuthorizedRunner`, `AgentNotActive`, `DeadlineExpired`, `SameToken`, `ZeroMinOutput`, `SlippageExceeded`, `InvalidDEX`, `InvalidRegistry`, `SwapFailed`, `NotCreator`, `RunnerAlreadyAuthorized`, `RunnerNotAuthorized`
