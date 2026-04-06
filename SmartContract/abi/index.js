export { AgentRegistryABI } from "./AgentRegistry.js";
export { AgentVaultABI } from "./AgentVault.js";
export { AgentExecutorABI } from "./AgentExecutor.js";
export { ProfitSplitterABI } from "./ProfitSplitter.js";
export { ERC20ABI } from "./ERC20.js";

// Deployed contract addresses (local devnet — chain ID 2124225178762456)
export const ADDRESSES = {
  registry:   "0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D",
  executor:   "0x0777CA550E0dFB9c64deb88A871a3ad867c2e014",
  splitter:   "0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F",
  vault:      "0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6",
  dex:        "0xd1e1f06DD977Fb0faEb29E7322Fd94064aBad3F9",
  initToken:  "0x2A3888Bd6865D2C360D11F284FE773379fb98E30",
  usdcToken:  "0x44cB6c715b9Aba693f87e1660B1728b7aD083620",
  agentId:    1n,
};
