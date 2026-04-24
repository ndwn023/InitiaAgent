# AgentRegistry

**Address:** `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D`

The central directory of all trading agents in the InitiaAgent system.

## Purpose

AgentRegistry tracks every registered agent, including its creator, vault address, subscriber count, trading volume, and active status. It serves as the single source of truth that other contracts reference to validate agent existence and authorization.

## Constructor

```solidity
constructor(address owner)
```

Extends `Ownable2Step` for two-step ownership transfer.

## State

```solidity
struct AgentInfo {
    address creator;
    address vaultAddress;
    uint256 createdAt;
    bool isActive;
    uint256 totalSubscribers;
    uint256 totalVolumeTraded;
    string name;
    string strategyType;
}

uint256 public agentCount;
address public executorAddress;
```

## Write Functions

| Function | Access | Description |
|---|---|---|
| `registerAgent(name, strategyType, vaultAddress)` | Anyone | Register a new agent. Returns `agentId`. Reverts if vault already registered. |
| `deactivateAgent(agentId)` | Creator or Owner | Stop agent from accepting new trades. |
| `reactivateAgent(agentId)` | Creator or Owner | Re-enable a deactivated agent. |
| `updateSubscriberCount(agentId, increment)` | Vault or Executor | Increment/decrement subscriber count. |
| `updateVolumeTraded(agentId, volume)` | Executor | Add to cumulative volume traded. |
| `setExecutor(executor_)` | Owner | Set the executor address for volume tracking authorization. |

## Read Functions

| Function | Returns |
|---|---|
| `getAgent(agentId)` | Full `AgentInfo` struct |
| `getAgentByVault(vaultAddress)` | `agentId` for a given vault |
| `getCreatorAgents(creator)` | Array of `agentId`s created by an address |
| `isActive(agentId)` | Boolean active status |
| `getActiveAgentsPaginated(offset, limit)` | Paginated list of active agents |

## Events

| Event | Parameters |
|---|---|
| `AgentRegistered` | agentId, creator, vaultAddress, name, strategyType |
| `AgentDeactivated` | agentId |
| `AgentReactivated` | agentId |
| `SubscriberCountUpdated` | agentId, newCount |

## Errors

`EmptyName`, `EmptyStrategyType`, `InvalidVaultAddress`, `VaultAlreadyRegistered`, `AgentNotFound`, `NotCreator`, `AgentNotActive`, `AgentAlreadyActive`, `Unauthorized`
