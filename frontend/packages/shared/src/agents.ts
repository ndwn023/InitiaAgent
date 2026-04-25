export const SUPPORTED_AGENT_INTERVALS = [
  "30 Seconds",
  "1 Minute",
  "5 Minutes",
  "15 Minutes",
  "30 Minutes",
  "1 Hour",
  "4 Hours",
  "8 Hours",
  "12 Hours",
  "24 Hours",
] as const;

export type AgentInterval = (typeof SUPPORTED_AGENT_INTERVALS)[number];

export const DEFAULT_AGENT_INTERVAL: AgentInterval = "1 Hour";

export const AGENT_INTERVAL_MS: Record<AgentInterval, number> = {
  "30 Seconds": 30_000,
  "1 Minute": 60_000,
  "5 Minutes": 300_000,
  "15 Minutes": 900_000,
  "30 Minutes": 1_800_000,
  "1 Hour": 3_600_000,
  "4 Hours": 14_400_000,
  "8 Hours": 28_800_000,
  "12 Hours": 43_200_000,
  "24 Hours": 86_400_000,
};

export function getAgentIntervalMs(interval?: string): number {
  const matched = SUPPORTED_AGENT_INTERVALS.find((value) => value === interval);
  return AGENT_INTERVAL_MS[matched ?? DEFAULT_AGENT_INTERVAL];
}

export type AgentStatus = "Active" | "Paused";

export function normalizeAgentStatus(input: unknown): AgentStatus {
  const normalized = typeof input === "string" ? input.trim().toLowerCase() : "";
  return normalized === "paused" ? "Paused" : "Active";
}

export interface DeployedAgent {
  id: string;
  name: string;
  strategy: string;
  target?: string;
  pool?: string;
  protocol?: string;
  vault?: string;
  status: AgentStatus;
  deployedAt: string;
  txHash: string;
  contractAddress: string;
  initialCapital: number;
  creatorAddress?: string;
  interval?: string;
  isSubscription?: boolean;
  agentClosed?: boolean;
  roi?: string;
  takeProfitPct?: number;
  stopLossPct?: number;
  minConfidence?: number;
  tradeSizePct?: number;
  onChainAgentId?: string;
}

export interface AgentsResponse {
  agents: DeployedAgent[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface PersistedDashboardState {
  ownerAddress: string;
  livePortfolio: number;
  liveProfit: number;
  executionCount: number;
  remainingBalance: Record<string, number>;
  costBasis: Record<string, number>;
  lastAnalysisAt: Record<string, number>;
  logs: unknown[];
  source?: DashboardStateSource;
  updatedAt?: string;
}

export type DashboardStateSource = "worker" | "frontend" | "api";

export interface DashboardStateSnapshot {
  id: number;
  ownerAddress: string;
  source: DashboardStateSource;
  payloadHash: string;
  livePortfolio: number;
  liveProfit: number;
  executionCount: number;
  createdAt: string;
}

export function isOpenCreatorAgent(agent: DeployedAgent): boolean {
  return !agent.isSubscription && !agent.agentClosed;
}

export function getOpenCreatorAgents(agents: DeployedAgent[]): DeployedAgent[] {
  return agents.filter(isOpenCreatorAgent);
}

export function filterAgentsByStrategy(agents: DeployedAgent[], strategy: string): DeployedAgent[] {
  if (strategy === "All") return agents;
  return agents.filter((agent) => agent.strategy === strategy);
}

// ─── Market analysis API contract ─────────────────────────────────────────────
// Shape returned by backend `/api/agent/analyze` (both rule-based and AI modes).
// Backend may attach additional diagnostic fields (e.g. `indicators`) — they
// remain optional so the contract is forward-compatible.

export type TradeSignal = "BUY" | "SELL" | "HOLD";
export type RiskLevel = "Low" | "Medium" | "High";

export interface MarketAnalysis {
  signal: TradeSignal;
  token: string;
  confidence: number;
  reasoning: string;
  suggestedAction: string;
  riskLevel: RiskLevel;
  indicators?: MarketAnalysisIndicators;
}

export interface MarketAnalysisIndicators {
  rsi: number;
  macd: "+" | "-" | "0";
  bbPct: number;
  volume: "High↑" | "High↓" | "Normal";
  squeeze: boolean;
  divergence: "bullish" | "bearish" | "none";
  compositeScore: number;
  atr: number;
  regime?: "risk-on" | "risk-off" | "neutral";
  marketBreadth?: number;
  leader?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAgentSummary {
  name: string;
  target: string;
  strategy: string;
  status: string;
}
