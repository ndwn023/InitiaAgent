export const AgentVaultABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "_asset", "type": "address", "internalType": "address" },
      { "name": "_agentId", "type": "uint256", "internalType": "uint256" },
      { "name": "_creator", "type": "address", "internalType": "address" },
      { "name": "_registry", "type": "address", "internalType": "address" },
      { "name": "_executor", "type": "address", "internalType": "address" },
      { "name": "_intervalSeconds", "type": "uint256", "internalType": "uint256" },
      { "name": "_maxTradeBps", "type": "uint256", "internalType": "uint256" },
      { "name": "_depositCap", "type": "uint256", "internalType": "uint256" },
      { "name": "_allowedTokens", "type": "address[]", "internalType": "address[]" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS_DENOMINATOR",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TRADE_BPS",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_INTERVAL",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agentId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowedTokenList",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowedTokens",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approveForTrade",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "asset",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creator",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [{ "name": "assets", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositCap",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "executor",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSubscriberAssets",
    "inputs": [{ "name": "sub", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "assets_", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "intervalSeconds",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastExecutionTs",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxTradeBps",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pauseVault",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewDeposit",
    "inputs": [{ "name": "assets", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "shares_", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewWithdraw",
    "inputs": [{ "name": "shares_", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "assets_", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reconcileAssets",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IAgentRegistry" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setSplitter",
    "inputs": [{ "name": "_splitter", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "shares",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "snapshotValue",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "splitter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "splitterSet",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalAssets",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalShares",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unpauseVault",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateDepositCap",
    "inputs": [{ "name": "newCap", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateExecutor",
    "inputs": [{ "name": "newExecutor", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [{ "name": "sharesToRedeem", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawForSplitter",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "DepositCapUpdated",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "newCap", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Deposited",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "subscriber", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "assets", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "shares", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ExecutorUpdated",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "newExecutor", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SplitterSet",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "splitter", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SplitterWithdrawal",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "to", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TotalAssetsReconciled",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "newTotal", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeApproved",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "token", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "timestamp", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultPaused",
    "inputs": [{ "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultUnpaused",
    "inputs": [{ "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "subscriber", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "assets", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "shares", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "AgentVault__CooldownNotElapsed", "inputs": [{ "name": "earliest", "type": "uint256", "internalType": "uint256" }, { "name": "now_", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__DepositCapExceeded", "inputs": [{ "name": "attempted", "type": "uint256", "internalType": "uint256" }, { "name": "cap", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__ExceedsMaxTradePercent", "inputs": [{ "name": "bps", "type": "uint256", "internalType": "uint256" }, { "name": "maxBps", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__InsufficientAssets", "inputs": [{ "name": "requested", "type": "uint256", "internalType": "uint256" }, { "name": "available", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__InsufficientShares", "inputs": [{ "name": "requested", "type": "uint256", "internalType": "uint256" }, { "name": "available", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__IntervalTooShort", "inputs": [{ "name": "given", "type": "uint256", "internalType": "uint256" }, { "name": "min", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__InvalidParam", "inputs": [{ "name": "param", "type": "string", "internalType": "string" }] },
  { "type": "error", "name": "AgentVault__MaxTradePercentOutOfRange", "inputs": [{ "name": "bps", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentVault__NotCreator", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentVault__NotExecutor", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentVault__NotSplitter", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentVault__SplitterAlreadySet", "inputs": [] },
  { "type": "error", "name": "AgentVault__TokenNotWhitelisted", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentVault__UnauthorizedReconciler", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentVault__VaultPaused", "inputs": [] },
  { "type": "error", "name": "AgentVault__ZeroAmount", "inputs": [] },
  { "type": "error", "name": "AgentVault__ZeroShares", "inputs": [] },
  { "type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": [] },
  { "type": "error", "name": "SafeERC20FailedOperation", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] }
];
