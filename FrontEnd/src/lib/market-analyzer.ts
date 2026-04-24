/**
 * Professional market analysis engine.
 *
 * Methodologies referenced:
 * - RSI (J. Welles Wilder) — overbought/oversold momentum
 * - MACD-style EMA crossover (Gerald Appel) — trend direction & momentum
 * - Bollinger Band squeeze (John Bollinger) — volatility & breakout detection
 * - Volume confirmation (Richard Wyckoff) — validate signal with volume
 * - Trend-following bias (Jesse Livermore / Stanley Druckenmiller) — don't fight momentum
 * - Risk-first sizing (Paul Tudor Jones / Ray Dalio) — risk-adjusted confidence
 */

import type { MarketAnalysis } from "./ai-agent";
import type { MarketSnapshot, PriceData } from "./price-feed";

// ─── Strategy Configs ────────────────────────────────────────────────────────

interface StrategyConfig {
  buyThreshold: number;
  sellThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  label: string;
}

const STRATEGY_CONFIGS: Record<string, StrategyConfig> = {
  DCA:     { buyThreshold: -3,  sellThreshold: -25, rsiOverbought: 75, rsiOversold: 30, label: "DCA" },
  LP:      { buyThreshold: 12,  sellThreshold: -12, rsiOverbought: 65, rsiOversold: 40, label: "LP Rebalancing" },
  YIELD:   { buyThreshold: 10,  sellThreshold: -10, rsiOverbought: 68, rsiOversold: 35, label: "Yield Optimization" },
  VIP:     { buyThreshold: 15,  sellThreshold: -15, rsiOverbought: 70, rsiOversold: 38, label: "VIP Maximizer" },
  DEFAULT: { buyThreshold: 8,   sellThreshold: -8,  rsiOverbought: 70, rsiOversold: 35, label: "General" },
};

function getStrategyConfig(strategy: string): StrategyConfig {
  const s = strategy.toUpperCase();
  if (s.includes("DCA"))                         return STRATEGY_CONFIGS.DCA;
  if (s.includes("LP") || s.includes("REBAL"))  return STRATEGY_CONFIGS.LP;
  if (s.includes("YIELD") || s.includes("OPT")) return STRATEGY_CONFIGS.YIELD;
  if (s.includes("VIP"))                         return STRATEGY_CONFIGS.VIP;
  return STRATEGY_CONFIGS.DEFAULT;
}

// ─── Token Resolution ─────────────────────────────────────────────────────────

function resolveTokenPrice(snapshot: MarketSnapshot, targetToken?: string): PriceData | null {
  const symbol = (targetToken || "INIT").toUpperCase();
  return (
    snapshot.prices.find(p => p.symbol === symbol) ||
    snapshot.prices.find(p => p.symbol.startsWith(symbol)) ||
    snapshot.prices.find(p => p.symbol.startsWith("INIT")) ||
    snapshot.prices[0] ||
    null
  );
}

// ─── Technical Indicators ─────────────────────────────────────────────────────

interface Indicators {
  emaCrossover: number;
  macdSignal: number;
  trendStrength: number;
  rsi: number;
  momentum24h: number;
  bollingerPct: number;
  volatilityPct: number;
  isSqueeze: boolean;
  volumeScore: number;
  compositeScore: number;
}

function calculateIndicators(price: PriceData): Indicators {
  const p   = price.price;
  const ema = price.emaPrice || p;
  const change24h = price.change24h ?? 0;

  // Trend: EMA crossover
  const emaCrossover = ema > 0 ? ((p - ema) / ema) * 100 : 0;

  // MACD approximation: change in EMA crossover between today and yesterday
  const p_prev = p / (1 + change24h / 100);
  const emaCrossoverPrev = ema > 0 ? ((p_prev - ema) / ema) * 100 : 0;
  const macdSignal = emaCrossover - emaCrossoverPrev;
  const trendStrength = Math.min(1, Math.abs(emaCrossover) / 5);

  // RSI approximation (Wilder): calibrated so ±10% 24h ≈ RSI 80/20
  const rsi = Math.max(5, Math.min(95, 50 + change24h * 3));

  // Bollinger Bands
  const conf   = price.confidence || p * 0.005;
  const bbWidth = Math.max(conf * 4, p * 0.01);
  const bbLow  = ema - bbWidth / 2;
  const bollingerPct = bbWidth > 0 ? (p - bbLow) / bbWidth : 0.5;
  const volatilityPct = p > 0 ? (conf / p) * 100 : 1;
  const isSqueeze = volatilityPct < 0.3;

  // Volume confirmation (Wyckoff)
  let volumeScore = 0;
  if (price.volume24h && price.marketCap) {
    const turnover = price.volume24h / price.marketCap;
    const isHighVol = turnover > 0.05;
    volumeScore = isHighVol
      ? (change24h >= 0 ? 1 : -1)
      : (change24h >= 0 ? 0.3 : -0.3);
  }

  // Composite score
  const emaNorm  = Math.max(-50, Math.min(50, emaCrossover * 8));
  const macdNorm = Math.max(-20, Math.min(20, macdSignal * 10));
  const rsiDev   = (rsi - 50) / 50 * 25;
  const momNorm  = Math.max(-30, Math.min(30, change24h * 4));
  const volNorm  = volumeScore * 10;
  const volPenalty = Math.min(15, volatilityPct * 3);

  const compositeScore =
    emaNorm   * 0.30 +
    macdNorm  * 0.20 +
    rsiDev    * 0.20 +
    momNorm   * 0.20 +
    volNorm   * 0.10 -
    volPenalty;

  return {
    emaCrossover, macdSignal, trendStrength,
    rsi, momentum24h: change24h,
    bollingerPct, volatilityPct, isSqueeze,
    volumeScore, compositeScore,
  };
}

// ─── Signal Generation ────────────────────────────────────────────────────────

function deriveSignal(ind: Indicators, config: StrategyConfig): "BUY" | "SELL" | "HOLD" {
  const { compositeScore, rsi, bollingerPct, isSqueeze } = ind;

  // RSI extremes override (Wilder)
  if (rsi >= config.rsiOverbought && compositeScore < 5)  return "SELL";
  if (rsi <= config.rsiOversold   && compositeScore > -5) return "BUY";

  // Bollinger extremes (Bollinger)
  if (bollingerPct >= 0.9 && compositeScore < 0) return "SELL";
  if (bollingerPct <= 0.1 && compositeScore > 0) return "BUY";

  // Squeeze: wait for breakout confirmation (Bollinger)
  if (isSqueeze && Math.abs(compositeScore) < 15) return "HOLD";

  // Composite threshold
  if (compositeScore > config.buyThreshold)  return "BUY";
  if (compositeScore < config.sellThreshold) return "SELL";
  return "HOLD";
}

function deriveConfidence(ind: Indicators, signal: "BUY" | "SELL" | "HOLD", strategy: string): number {
  let base = 45;
  base += Math.min(30, Math.abs(ind.compositeScore) * 0.6);
  const aligned = (signal === "BUY" && ind.volumeScore > 0) || (signal === "SELL" && ind.volumeScore < 0);
  if (aligned)                                         base += 10;
  base += ind.trendStrength * 8;
  if (signal === "BUY"  && ind.rsi < 45)               base += 7;
  if (signal === "SELL" && ind.rsi > 55)               base += 7;
  if (strategy.toUpperCase().includes("DCA") && signal === "BUY") base += 12;
  if (ind.isSqueeze)                                   base -= 10;
  return Math.min(95, Math.max(25, Math.round(base)));
}

function deriveRiskLevel(ind: Indicators): "Low" | "Medium" | "High" {
  if (ind.volatilityPct > 2.5 || Math.abs(ind.momentum24h) > 8) return "High";
  if (ind.volatilityPct > 1.0 || Math.abs(ind.momentum24h) > 3) return "Medium";
  return "Low";
}

// ─── Reasoning & Suggested Action ────────────────────────────────────────────

function generateReasoning(
  signal: "BUY" | "SELL" | "HOLD",
  token: string,
  price: PriceData,
  ind: Indicators,
  strategy: string,
  marketContext: string,
): string {
  const dir  = price.price > price.emaPrice ? "above" : "below";
  const chg  = (ind.momentum24h >= 0 ? "+" : "") + ind.momentum24h.toFixed(2) + "%";
  const base = `${token} $${price.price} (${dir} EMA $${price.emaPrice}). 24h: ${chg}. RSI ${ind.rsi.toFixed(0)}.`;

  const rsiNote = ind.rsi > 70 ? " RSI overbought — profit-taking zone (Wilder)."
    : ind.rsi < 30             ? " RSI oversold — accumulation zone (Wilder)."
    : "";

  const macdNote = ind.macdSignal > 0.5 ? " MACD histogram positive — bullish crossover (Appel)."
    : ind.macdSignal < -0.5             ? " MACD histogram negative — bearish crossover (Appel)."
    : "";

  const volNote = ind.volumeScore > 0.5  ? " High volume confirms upside (Wyckoff demand)."
    : ind.volumeScore < -0.5            ? " High volume confirms downside (Wyckoff supply)."
    : ind.volumeScore !== 0             ? " Below-average volume — weak confirmation."
    : "";

  const bbNote = ind.bollingerPct >= 0.85 ? " At upper Bollinger band — resistance zone."
    : ind.bollingerPct <= 0.15           ? " At lower Bollinger band — support zone."
    : ind.isSqueeze                      ? " Bollinger squeeze — breakout incoming."
    : "";

  const ctx = marketContext ? ` ${marketContext}` : "";
  return `${base}${rsiNote}${macdNote}${bbNote}${volNote}${ctx}`.trim();
}

function generateSuggestedAction(
  signal: "BUY" | "SELL" | "HOLD",
  token: string,
  price: PriceData,
  ind: Indicators,
  strategy: string,
): string {
  const p   = price.price;
  const atr = (price.high24h && price.low24h) ? (price.high24h - price.low24h) : p * 0.03;
  const target = (p + atr * 1.5).toFixed(4);
  const stop   = (p - atr * 1.0).toFixed(4);

  if (signal === "BUY") {
    if (strategy.toUpperCase().includes("DCA"))
      return `DCA into ${token} at $${p}. Scale in gradually — next target $${target}. Don't deploy all capital at once.`;
    if (strategy.toUpperCase().includes("LP"))
      return `Add liquidity near $${p}. Rebalance threshold: >${(ind.volatilityPct * 2).toFixed(1)}% price drift.`;
    return `Enter ${token} at $${p}. Target $${target}, stop $${stop}. R/R ≥ 1.5 (Livermore principle).`;
  }
  if (signal === "SELL") {
    return `Reduce ${token} at $${p}. Support at $${stop}. Protect capital first — losses hurt more than gains help (Kahneman).`;
  }
  if (ind.isSqueeze)
    return `Bollinger squeeze on ${token}. Await volume breakout above $${target} or below $${stop} before committing.`;
  return `Hold ${token} at $${p}. Watch $${target} (resistance) and $${stop} (support) for next signal.`;
}

// ─── Multi-Token Scanner ──────────────────────────────────────────────────────

interface TokenScore {
  symbol: string;
  score: number;
  ind: Indicators;
  price: PriceData;
}

function scanAllTokens(snapshot: MarketSnapshot): TokenScore[] {
  return snapshot.prices
    .filter(p => !p.symbol.startsWith("USDC"))
    .map(p => {
      const ind = calculateIndicators(p);
      return { symbol: p.symbol.split("/")[0], score: ind.compositeScore, ind, price: p };
    })
    .sort((a, b) => b.score - a.score);
}

function getMarketContext(rankings: TokenScore[], targetToken: string): string {
  const best = rankings[0];
  if (best && best.symbol !== targetToken && best.score > 12)
    return `Strongest opportunity: ${best.symbol} (score ${best.score.toFixed(0)}, RSI ${best.ind.rsi.toFixed(0)}, 24h ${best.ind.momentum24h >= 0 ? "+" : ""}${best.ind.momentum24h.toFixed(1)}%).`;
  const others = rankings.filter(r => r.symbol !== targetToken).slice(0, 2);
  if (!others.length) return "";
  return `Market: ${others.map(o => `${o.symbol} ${o.ind.momentum24h >= 0 ? "+" : ""}${o.ind.momentum24h.toFixed(1)}%`).join(", ")}.`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function analyzeMarketRules(
  strategy: string,
  params: {
    targetToken?: string;
    pool?: string;
    protocol?: string;
    vault?: string;
    capital?: number;
    interval?: string;
  },
  snapshot: MarketSnapshot,
): MarketAnalysis {
  const config    = getStrategyConfig(strategy);
  const tokenData = resolveTokenPrice(snapshot, params.targetToken);

  if (!tokenData) {
    return {
      signal: "HOLD",
      token: params.targetToken || "INIT",
      confidence: 35,
      reasoning: "Insufficient market data. Defaulting to HOLD — capital preservation first (Ray Dalio).",
      suggestedAction: "Wait for market data to refresh before taking action.",
      riskLevel: "Medium",
    };
  }

  const ind         = calculateIndicators(tokenData);
  const signal      = deriveSignal(ind, config);
  const confidence  = deriveConfidence(ind, signal, strategy);
  const riskLevel   = deriveRiskLevel(ind);
  const tokenName   = params.targetToken || tokenData.symbol.split("/")[0] || "INIT";

  const rankings     = scanAllTokens(snapshot);
  const marketContext = getMarketContext(rankings, tokenName);

  return {
    signal,
    token: tokenName,
    confidence,
    reasoning: generateReasoning(signal, tokenName, tokenData, ind, strategy, marketContext),
    suggestedAction: generateSuggestedAction(signal, tokenName, tokenData, ind, strategy),
    riskLevel,
    // @ts-ignore — extra display fields
    indicators: {
      rsi: Math.round(ind.rsi),
      macd: ind.macdSignal > 0.2 ? "+" : ind.macdSignal < -0.2 ? "-" : "0",
      bbPct: Math.round(ind.bollingerPct * 100),
      volume: ind.volumeScore > 0 ? "High↑" : ind.volumeScore < 0 ? "High↓" : "Normal",
      squeeze: ind.isSqueeze,
    },
  };
}
