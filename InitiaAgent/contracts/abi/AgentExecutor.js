export const AgentExecutorABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "_registry", "type": "address", "internalType": "address" },
      { "name": "_dex", "type": "address", "internalType": "address" },
      { "name": "_owner", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "acceptOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agentVault",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "authorizeRunner",
    "inputs": [
      { "name": "agentId", "type": "uint256", "internalType": "uint256" },
      { "name": "runner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "dex",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IInitiaDEX" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "executeSwap",
    "inputs": [
      { "name": "agentId", "type": "uint256", "internalType": "uint256" },
      { "name": "tokenIn", "type": "address", "internalType": "address" },
      { "name": "tokenOut", "type": "address", "internalType": "address" },
      { "name": "amountIn", "type": "uint256", "internalType": "uint256" },
      { "name": "minAmountOut", "type": "uint256", "internalType": "uint256" },
      { "name": "deadline", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "amountOut", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isRunnerAuthorized",
    "inputs": [
      { "name": "agentId", "type": "uint256", "internalType": "uint256" },
      { "name": "runner", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingOwner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
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
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRunner",
    "inputs": [
      { "name": "agentId", "type": "uint256", "internalType": "uint256" },
      { "name": "runner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [{ "name": "newOwner", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateDEX",
    "inputs": [{ "name": "newDex", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "DEXUpdated",
    "inputs": [
      { "name": "oldDex", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "newDex", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferStarted",
    "inputs": [
      { "name": "previousOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newOwner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      { "name": "previousOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newOwner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RunnerAuthorized",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "runner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RunnerRevoked",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "runner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SwapExecuted",
    "inputs": [
      { "name": "agentId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "runner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "tokenIn", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "tokenOut", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "amountIn", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "amountOut", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "AgentExecutor__AgentNotActive", "inputs": [{ "name": "agentId", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__DeadlineExpired", "inputs": [{ "name": "deadline", "type": "uint256", "internalType": "uint256" }, { "name": "blockTs", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__InvalidDEX", "inputs": [{ "name": "dex", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentExecutor__InvalidRegistry", "inputs": [{ "name": "registry", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentExecutor__NotAuthorizedRunner", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }, { "name": "agentId", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__NotCreator", "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }, { "name": "agentId", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__RunnerAlreadyAuthorized", "inputs": [{ "name": "runner", "type": "address", "internalType": "address" }, { "name": "agentId", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__RunnerNotAuthorized", "inputs": [{ "name": "runner", "type": "address", "internalType": "address" }, { "name": "agentId", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__SameToken", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AgentExecutor__SlippageExceeded", "inputs": [{ "name": "received", "type": "uint256", "internalType": "uint256" }, { "name": "minimum", "type": "uint256", "internalType": "uint256" }] },
  { "type": "error", "name": "AgentExecutor__SwapFailed", "inputs": [] },
  { "type": "error", "name": "AgentExecutor__ZeroMinOutput", "inputs": [] },
  { "type": "error", "name": "OwnableInvalidOwner", "inputs": [{ "name": "owner", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "OwnableUnauthorizedAccount", "inputs": [{ "name": "account", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "SafeERC20FailedOperation", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] }
];
