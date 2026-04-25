import { CONTRACTS } from "./contracts";

/**
 * @deprecated Import `CONTRACTS.TREASURY` from `@initia-agent/shared` instead.
 * Kept as a re-export for backwards compatibility with older call sites.
 */
export const TREASURY_ADDRESS = CONTRACTS.TREASURY;

export const ACTIVATION_FEE_INIT = 0.5;
export const SUBSCRIPTION_FEE_INIT = 0.25;

export const EXECUTION_FEE_BPS = 15;
export const REALIZED_SKIM_BPS = 50;
export const EXECUTION_CLAMP = 0.03;

export const CONFIDENCE_BIAS_BPS = 26;
export const EXECUTION_NOISE_BPS = 2;

export const BASELINE_EDGE_BPS = 6;

// Docs: min cooldown 60s, max trade 30% of vault, default trade 10%.
export const MIN_TRADE_COOLDOWN_MS = 60_000;
export const MAX_TRADE_SIZE_PCT = 30;
export const DEFAULT_TRADE_SIZE_PCT = 10;

// Docs: intervalSeconds default 15 min, AI analysis every 5 min.
export const DEFAULT_INTERVAL_SECONDS = 15 * 60;
export const AI_ANALYSIS_REFRESH_MS = 5 * 60 * 1000;

// Docs: runner-defined slippage tolerance 0.5–1%.
export const SLIPPAGE_TOLERANCE_BPS_MIN = 50;
export const SLIPPAGE_TOLERANCE_BPS_MAX = 100;

// Docs: agents track these symbols via CoinGecko + Pyth.
export const SUPPORTED_TOKENS = ["ETH", "BTC", "SOL", "ATOM", "TIA", "INIT"] as const;
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

// Must stay in sync with docs/features/profit-sharing.md and the on-chain
// ProfitSplitter constructor args. Hard caps live in the contract.
export const EPOCH_PROTOCOL_FEE_BPS = 200;
export const EPOCH_CREATOR_SHARE_BPS = 2000;
export const MAX_EPOCH_PROTOCOL_FEE_BPS = 1000;
export const MAX_EPOCH_CREATOR_SHARE_BPS = 5000;

export const PROTOCOL_FEE_BPS = REALIZED_SKIM_BPS;
export const PERFORMANCE_FEE_BPS = MAX_EPOCH_PROTOCOL_FEE_BPS;

export interface StrategyEdge {
  edgeBps: number;
  confidenceFloor: number;
  baselineWinRate: number;
}

export const STRATEGY_EDGE: Record<string, StrategyEdge> = {
  DCA:        { edgeBps: 14, confidenceFloor: 40, baselineWinRate: 0.62 },
  LP:         { edgeBps: 10, confidenceFloor: 35, baselineWinRate: 0.58 },
  YIELD:      { edgeBps: 18, confidenceFloor: 45, baselineWinRate: 0.64 },
  VIP:        { edgeBps: 26, confidenceFloor: 50, baselineWinRate: 0.68 },
  AGGRESSIVE: { edgeBps: 22, confidenceFloor: 48, baselineWinRate: 0.66 },
  DEFAULT:    { edgeBps: 12, confidenceFloor: 40, baselineWinRate: 0.60 },
};

export function resolveStrategyEdge(strategy: string): StrategyEdge {
  const s = (strategy || "").toUpperCase();
  if (s.includes("VIP")) return STRATEGY_EDGE.VIP;
  if (s.includes("AGGRESSIVE") || s.includes("MOMENTUM") || s.includes("SCALP") || s.includes("SNIPER")) return STRATEGY_EDGE.AGGRESSIVE;
  if (s.includes("DCA")) return STRATEGY_EDGE.DCA;
  if (s.includes("LP") || s.includes("REBAL")) return STRATEGY_EDGE.LP;
  if (s.includes("YIELD") || s.includes("OPT")) return STRATEGY_EDGE.YIELD;
  return STRATEGY_EDGE.DEFAULT;
}

export interface TradeExecutionInput {
  amountIn: number;
  fromPriceUsd: number;
  toPriceUsd: number;
  confidence: number;
  strategy: string;
  noise?: number;
}

export interface TradeExecutionResult {
  amountOut: number;
  executionFee: number;
  effectiveMultiplier: number;
  edgeBps: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function computeTradeExecution(input: TradeExecutionInput): TradeExecutionResult {
  if (input.fromPriceUsd <= 0 || input.toPriceUsd <= 0) {
    throw new Error("computeTradeExecution: price must be positive");
  }
  const edge = resolveStrategyEdge(input.strategy);
  const confidence = clamp(input.confidence ?? 60, 0, 100);

  const mid              = (input.amountIn * input.fromPriceUsd) / input.toPriceUsd;
  const executionCost    = EXECUTION_FEE_BPS / 10_000;
  const baselineEdge     = BASELINE_EDGE_BPS / 10_000;
  const confidenceEdge   = Math.max(0, (confidence - 50) / 50) * (CONFIDENCE_BIAS_BPS / 10_000);
  const strategyScale    = confidence >= edge.confidenceFloor ? 1 : confidence / Math.max(edge.confidenceFloor, 1);
  const strategyEdge     = (edge.edgeBps / 10_000) * strategyScale;
  const noise            = ((input.noise ?? Math.random()) * 2 - 1) * (EXECUTION_NOISE_BPS / 10_000);

  const effectiveMultiplier = clamp(
    1 - executionCost + baselineEdge + confidenceEdge + strategyEdge + noise,
    1 - EXECUTION_CLAMP,
    1 + EXECUTION_CLAMP,
  );

  const amountOut = Math.max(0, mid * effectiveMultiplier);
  const executionFee = input.amountIn * executionCost;

  return {
    amountOut: Number.isFinite(amountOut) ? amountOut : 0,
    executionFee,
    effectiveMultiplier,
    edgeBps: edge.edgeBps,
  };
}

export function computeRealizedSkim(realizedProfit: number): number {
  if (realizedProfit <= 0) return 0;
  return (realizedProfit * REALIZED_SKIM_BPS) / 10_000;
}

export function computeEpochProtocolFee(grossProfit: number): number {
  if (grossProfit <= 0) return 0;
  return (grossProfit * EPOCH_PROTOCOL_FEE_BPS) / 10_000;
}

export function computeEpochCreatorShare(grossProfit: number): number {
  if (grossProfit <= 0) return 0;
  const afterProtocol = grossProfit - computeEpochProtocolFee(grossProfit);
  return (afterProtocol * EPOCH_CREATOR_SHARE_BPS) / 10_000;
}

export const computeProtocolFee = computeRealizedSkim;
export const computePerformanceFee = computeEpochProtocolFee;

export function expectedEdgeBps(strategy: string, confidence: number): number {
  const edge = resolveStrategyEdge(strategy);
  const confEdge = ((clamp(confidence, 0, 100) - 50) / 50) * CONFIDENCE_BIAS_BPS;
  const stratEdge = confidence >= edge.confidenceFloor ? edge.edgeBps : 0;
  return confEdge + stratEdge - EXECUTION_FEE_BPS;
}

export const METRIC_KEYS = {
  grossProfit:        "__grossProfit",
  feesPaid:           "__feesPaid",
  netProfit:          "__netProfit",
  tradesExecuted:     "__tradesExecuted",
  winningTrades:      "__winningTrades",
  activationFeeInit:  "__activationFeeInit",
  subscriptionFeeInit:"__subscriptionFeeInit",
  realizedProfit:     "__realizedProfit",
  protocolFee:        "__protocolFee",
} as const;

export interface AgentMetrics {
  grossProfit: number;
  feesPaid: number;
  netProfit: number;
  tradesExecuted: number;
  winningTrades: number;
  activationFeeInit: number;
  subscriptionFeeInit: number;
  realizedProfit: number;
  protocolFee: number;
}

export function emptyAgentMetrics(): AgentMetrics {
  return {
    grossProfit: 0,
    feesPaid: 0,
    netProfit: 0,
    tradesExecuted: 0,
    winningTrades: 0,
    activationFeeInit: 0,
    subscriptionFeeInit: 0,
    realizedProfit: 0,
    protocolFee: 0,
  };
}

export function readAgentMetrics(costBasis: Record<string, number> | undefined): AgentMetrics {
  const m = emptyAgentMetrics();
  if (!costBasis) return m;
  m.grossProfit         = Number(costBasis[METRIC_KEYS.grossProfit]) || 0;
  m.feesPaid            = Number(costBasis[METRIC_KEYS.feesPaid]) || 0;
  m.netProfit           = Number(costBasis[METRIC_KEYS.netProfit]) || 0;
  m.tradesExecuted      = Number(costBasis[METRIC_KEYS.tradesExecuted]) || 0;
  m.winningTrades       = Number(costBasis[METRIC_KEYS.winningTrades]) || 0;
  m.activationFeeInit   = Number(costBasis[METRIC_KEYS.activationFeeInit]) || 0;
  m.subscriptionFeeInit = Number(costBasis[METRIC_KEYS.subscriptionFeeInit]) || 0;
  m.realizedProfit      = Number(costBasis[METRIC_KEYS.realizedProfit]) || 0;
  m.protocolFee         = Number(costBasis[METRIC_KEYS.protocolFee]) || 0;
  return m;
}

export function writeAgentMetrics(
  costBasis: Record<string, number>,
  metrics: AgentMetrics,
): Record<string, number> {
  costBasis[METRIC_KEYS.grossProfit]         = metrics.grossProfit;
  costBasis[METRIC_KEYS.feesPaid]            = metrics.feesPaid;
  costBasis[METRIC_KEYS.netProfit]           = metrics.netProfit;
  costBasis[METRIC_KEYS.tradesExecuted]      = metrics.tradesExecuted;
  costBasis[METRIC_KEYS.winningTrades]       = metrics.winningTrades;
  costBasis[METRIC_KEYS.activationFeeInit]   = metrics.activationFeeInit;
  costBasis[METRIC_KEYS.subscriptionFeeInit] = metrics.subscriptionFeeInit;
  costBasis[METRIC_KEYS.realizedProfit]      = metrics.realizedProfit;
  costBasis[METRIC_KEYS.protocolFee]         = metrics.protocolFee;
  return costBasis;
}

export function isAgentCostBasisKey(key: string): boolean {
  return !key.startsWith("__");
}

export function entryPriceKey(agentId: string): string {
  return `${agentId}__entryInitPrice`;
}

export function winRate(m: AgentMetrics): number {
  if (m.tradesExecuted <= 0) return 0;
  return m.winningTrades / m.tradesExecuted;
}
