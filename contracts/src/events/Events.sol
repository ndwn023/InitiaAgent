// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── AgentRegistry ──────────────────────────────────────────────────────
event AgentRegistered(
    uint256 indexed agentId,
    address indexed creator,
    address indexed vaultAddress,
    string  name,
    string  strategyType
);
event AgentDeactivated(uint256 indexed agentId, address indexed by);
event AgentReactivated(uint256 indexed agentId, address indexed by);
event SubscriberCountUpdated(uint256 indexed agentId, uint256 newCount);

// ── AgentVault ─────────────────────────────────────────────────────────
event Deposited(
    uint256 indexed agentId,
    address indexed subscriber,
    uint256 assets,
    uint256 shares
);
event Withdrawn(
    uint256 indexed agentId,
    address indexed subscriber,
    uint256 assets,
    uint256 shares
);
event TradeApproved(
    uint256 indexed agentId,
    address indexed token,
    uint256 amount,
    uint256 timestamp
);
event TotalAssetsReconciled(uint256 indexed agentId, uint256 newTotal);
event VaultPaused(uint256 indexed agentId);
event VaultUnpaused(uint256 indexed agentId);
event DepositCapUpdated(uint256 indexed agentId, uint256 newCap);
event ExecutorUpdated(uint256 indexed agentId, address newExecutor);
event SplitterSet(uint256 indexed agentId, address splitter);
event SplitterWithdrawal(
    uint256 indexed agentId,
    address indexed to,
    uint256 amount
);

// ── AgentExecutor ──────────────────────────────────────────────────────
event SwapExecuted(
    uint256 indexed agentId,
    address indexed runner,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
);
event RunnerAuthorized(uint256 indexed agentId, address indexed runner);
event RunnerRevoked(uint256 indexed agentId, address indexed runner);
event DEXUpdated(address oldDex, address newDex);

// ── ProfitSplitter ─────────────────────────────────────────────────────
event ProfitDistributed(
    uint256 indexed agentId,
    uint256 grossProfit,
    uint256 protocolFee,
    uint256 creatorShare,
    uint256 subscriberShare,
    uint256 epochTimestamp
);
event SnapshotTaken(uint256 indexed agentId, uint256 value, uint256 ts);
event VaultRegisteredInSplitter(uint256 indexed agentId, address vault);
event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);
event CreatorShareUpdated(uint256 oldBps, uint256 newBps);
event TreasuryUpdated(address oldTreasury, address newTreasury);
