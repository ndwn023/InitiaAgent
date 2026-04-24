// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── AgentRegistry ──────────────────────────────────────────────────────
error AgentRegistry__EmptyName();
error AgentRegistry__EmptyStrategyType();
error AgentRegistry__InvalidVaultAddress();
error AgentRegistry__VaultAlreadyRegistered(address vault);
error AgentRegistry__AgentNotFound(uint256 agentId);
error AgentRegistry__NotCreator(address caller, address expected);
error AgentRegistry__AgentNotActive(uint256 agentId);
error AgentRegistry__AgentAlreadyActive(uint256 agentId);
error AgentRegistry__Unauthorized(address caller);

// ── AgentVault ─────────────────────────────────────────────────────────
error AgentVault__ZeroAmount();
error AgentVault__ZeroShares();
error AgentVault__InsufficientShares(uint256 requested, uint256 available);
error AgentVault__InsufficientAssets(uint256 requested, uint256 available);
error AgentVault__DepositCapExceeded(uint256 attempted, uint256 cap);
error AgentVault__TokenNotWhitelisted(address token);
error AgentVault__ExceedsMaxTradePercent(uint256 bps, uint256 maxBps);
error AgentVault__CooldownNotElapsed(uint256 earliest, uint256 now_);
error AgentVault__NotExecutor(address caller);
error AgentVault__NotCreator(address caller);
error AgentVault__NotSplitter(address caller);
error AgentVault__VaultPaused();
error AgentVault__SplitterAlreadySet();
error AgentVault__InvalidParam(string param);
error AgentVault__MaxTradePercentOutOfRange(uint256 bps);
error AgentVault__IntervalTooShort(uint256 given, uint256 min);
error AgentVault__UnauthorizedReconciler(address caller);

// ── AgentExecutor ──────────────────────────────────────────────────────
error AgentExecutor__NotAuthorizedRunner(address caller, uint256 agentId);
error AgentExecutor__AgentNotActive(uint256 agentId);
error AgentExecutor__DeadlineExpired(uint256 deadline, uint256 blockTs);
error AgentExecutor__SameToken(address token);
error AgentExecutor__ZeroMinOutput();
error AgentExecutor__SlippageExceeded(uint256 received, uint256 minimum);
error AgentExecutor__InvalidDEX(address dex);
error AgentExecutor__InvalidRegistry(address registry);
error AgentExecutor__SwapFailed();
error AgentExecutor__NotCreator(address caller, uint256 agentId);
error AgentExecutor__RunnerAlreadyAuthorized(address runner, uint256 agentId);
error AgentExecutor__RunnerNotAuthorized(address runner, uint256 agentId);

// ── ProfitSplitter ─────────────────────────────────────────────────────
error ProfitSplitter__EpochNotElapsed(uint256 earliest, uint256 now_);
error ProfitSplitter__NoProfit();
error ProfitSplitter__VaultNotRegistered(address vault);
error ProfitSplitter__InvalidProtocolFeeBps(uint256 bps, uint256 max);
error ProfitSplitter__InvalidCreatorShareBps(uint256 bps, uint256 max);
error ProfitSplitter__ZeroRegistry();
error ProfitSplitter__ZeroAsset();
error ProfitSplitter__ZeroTreasury();
error ProfitSplitter__InvalidEpochDuration(uint256 given, uint256 min);
error ProfitSplitter__AlreadyRegistered(uint256 agentId);
error ProfitSplitter__Unauthorized(address caller);
