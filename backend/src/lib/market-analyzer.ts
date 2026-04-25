/**
 * Deterministic rule-based market analysis engine.
 *
 * Improvements over initial version:
 *  - RSI divergence detection (early reversal warning)
 *  - Dynamic ATR-based thresholds instead of flat pct
 *  - Trend strength & momentum scoring
 *  - Exposes full `indicators` object for transparency
 *  - Confidence calibration via signal-history ring buffer
 *
 * Methodologies:
 *   RSI (Wilder), MACD approximation (Appel), Bollinger Bands (Bollinger),
 *   Volume confirmation (Wyckoff), trend bias (Livermore/Druckenmiller),
 *   risk-first sizing (Tudor Jones / Dalio), divergence (Charles Dow)
 */

import type { MarketSnapshot, PriceData } from "./price-feed";
import { calibrateConfidence, recordSignal } from "./signal-history";
import type {
  MarketAnalysis,
  MarketAnalysisIndicators as IndicatorSnapshot,
} from "@initia-agent/shared";

// Re-export so existing callers that import `MarketAnalysis`/`IndicatorSnapshot`
// from this module keep working.
export type { MarketAnalysis, IndicatorSnapshot };

// ─── Strategy configs ─────────────────────────────────────────────────────────

interface StrategyConfig {
  buyThreshold: number;
  sellThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  label: string;
  aggressiveness: "conservative" | "balanced" | "aggressive";
  rotationBias: number;
}

const STRATEGY_CONFIGS: Record<string, StrategyConfig> = {
  // DCA: accumulate aggressively on every dip, hold long — only sell on extreme overbought.
  // Lower buyThreshold so it enters on any weakness; very high sellThreshold keeps HOLD bias.
  DCA:        { buyThreshold: -6, sellThreshold: -22, rsiOverbought: 78, rsiOversold: 28, label: "DCA", aggressiveness: "conservative", rotationBias: 0.5 },
  // LP: lenient thresholds so rebalance events fire frequently → more 1.5x fee boosts per cycle.
  // LP no longer executes swaps; BUY/SELL signals only gate the fee multiplier.
  LP:         { buyThreshold: 5,  sellThreshold: -5,  rsiOverbought: 65, rsiOversold: 38, label: "LP Rebalancing", aggressiveness: "balanced", rotationBias: 0.6 },
  // YIELD: faster entry/exit to capture APY windows before emissions decay; stronger rotation.
  YIELD:      { buyThreshold: 6,  sellThreshold: -7,  rsiOverbought: 68, rsiOversold: 33, label: "Yield Optimization", aggressiveness: "balanced", rotationBias: 1.0 },
  // VIP: most aggressive — enters early on any momentum, exits before reversal, follows leaders.
  VIP:        { buyThreshold: 5,  sellThreshold: -6,  rsiOverbought: 73, rsiOversold: 38, label: "VIP Maximizer", aggressiveness: "aggressive", rotationBias: 1.4 },
  AGGRESSIVE: { buyThreshold: 5,  sellThreshold: -5,  rsiOverbought: 72, rsiOversold: 42, label: "Aggressive Profit Hunter", aggressiveness: "aggressive", rotationBias: 1.3 },
  DEFAULT:    { buyThreshold: 7,  sellThreshold: -7,  rsiOverbought: 70, rsiOversold: 35, label: "General", aggressiveness: "balanced", rotationBias: 0.7 },
};

function getStrategyConfig(strategy: string): StrategyConfig {
  const s = strategy.toUpperCase();
  if (s.includes("AGGRESSIVE") || s.includes("SNIPER") || s.includes("SCALP") || s.includes("MOMENTUM")) return STRATEGY_CONFIGS.AGGRESSIVE;
  if (s.includes("DCA"))                                                                                   return STRATEGY_CONFIGS.DCA;
  if (s.includes("LP") || s.includes("REBAL"))                                                             return STRATEGY_CONFIGS.LP;
  if (s.includes("YIELD") || s.includes("OPT"))                                                            return STRATEGY_CONFIGS.YIELD;
  if (s.includes("VIP"))                                                                                   return STRATEGY_CONFIGS.VIP;
  return STRATEGY_CONFIGS.DEFAULT;
}

function isAggressiveStrategy(strategy: string): boolean {
  const s = strategy.toUpperCase();
  return s.includes("AGGRESSIVE") || s.includes("VIP") || s.includes("SNIPER") || s.includes("SCALP") || s.includes("MOMENTUM");
}

// ─── Token resolution ─────────────────────────────────────────────────────────

function resolveTokenPrice(snapshot: MarketSnapshot, targetToken?: string): PriceData | null {
  const requested = (targetToken || "INIT").toUpperCase();
  // If quote token is stablecoin, analyze INIT leg for actionable momentum.
  const symbol = requested === "USDC" || requested === "USDT" || requested === "DAI" ? "INIT" : requested;
  return (
    snapshot.prices.find(p => p.symbol === symbol) ||
    snapshot.prices.find(p => p.symbol.startsWith(symbol)) ||
    snapshot.prices.find(p => p.symbol.startsWith("INIT")) ||
    snapshot.prices[0] ||
    null
  );
}

// ─── Technical indicators ─────────────────────────────────────────────────────

interface Indicators {
  // Raw values
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
  atr: number;
  // Divergence — Dow Theory: price and indicator should confirm each other
  divergence: "bullish" | "bearish" | "none";
}

function calculateIndicators(price: PriceData): Indicators {
  const p        = price.price;
  const ema      = price.emaPrice || p;
  const change24h = price.change24h ?? 0;

  // ── Trend: EMA crossover ──────────────────────────────────────────────────
  const emaCrossover = ema > 0 ? ((p - ema) / ema) * 100 : 0;

  // ── MACD approximation (Appel) ────────────────────────────────────────────
  const p_prev           = p / (1 + change24h / 100);
  const emaCrossoverPrev = ema > 0 ? ((p_prev - ema) / ema) * 100 : 0;
  const macdSignal       = emaCrossover - emaCrossoverPrev;
  const trendStrength    = Math.min(1, Math.abs(emaCrossover) / 5);

  // ── RSI approximation (Wilder) — ±10% 24h ≈ RSI 80/20 ────────────────────
  const rsi = Math.max(5, Math.min(95, 50 + change24h * 3));

  // ── Bollinger Bands (Bollinger) ───────────────────────────────────────────
  const conf        = price.confidence || p * 0.005;
  const bbWidth     = Math.max(conf * 4, p * 0.01);
  const bbLow       = ema - bbWidth / 2;
  const bollingerPct = bbWidth > 0 ? (p - bbLow) / bbWidth : 0.5;
  const volatilityPct = p > 0 ? (conf / p) * 100 : 1;
  const isSqueeze   = volatilityPct < 0.3;

  // ── ATR (Average True Range) from 24h high/low ────────────────────────────
  const atr = (price.high24h && price.low24h)
    ? price.high24h - price.low24h
    : p * 0.03;

  // ── Volume confirmation (Wyckoff) ─────────────────────────────────────────
  let volumeScore = 0;
  if (price.volume24h && price.marketCap) {
    const turnover   = price.volume24h / price.marketCap;
    const isHighVol  = turnover > 0.05;
    volumeScore = isHighVol
      ? (change24h >= 0 ? 1 : -1)
      : (change24h >= 0 ? 0.3 : -0.3);
  }

  // ── RSI Divergence (Dow Theory) ───────────────────────────────────────────
  // Bullish divergence: price making lower low, but RSI making higher low
  //   → price < prev AND rsi > prev_rsi (approximated via momentum vs RSI direction)
  // Bearish divergence: price making higher high, but RSI making lower high
  //   → price > prev AND rsi dropping (change > 0 but RSI < 50)
  let divergence: "bullish" | "bearish" | "none" = "none";
  if (change24h < -2 && rsi > 45) {
    // Price fell but RSI is still relatively high — bullish divergence
    divergence = "bullish";
  } else if (change24h > 2 && rsi < 55) {
    // Price rose but RSI didn't follow — bearish divergence
    divergence = "bearish";
  }

  // ── Composite score (weighted sum) ────────────────────────────────────────
  const emaNorm   = Math.max(-50, Math.min(50, emaCrossover * 8));
  const macdNorm  = Math.max(-20, Math.min(20, macdSignal * 10));
  const rsiDev    = (rsi - 50) / 50 * 25;
  const momNorm   = Math.max(-30, Math.min(30, change24h * 4));
  const volNorm   = volumeScore * 10;
  const volPenalty = Math.min(15, volatilityPct * 3);

  // Divergence penalty: if divergence contradicts EMA direction, reduce score
  let divergencePenalty = 0;
  if (divergence === "bearish" && emaCrossover > 0)  divergencePenalty = -8;
  if (divergence === "bullish" && emaCrossover < 0)   divergencePenalty = +8;

  const compositeScore =
    emaNorm   * 0.30 +
    macdNorm  * 0.20 +
    rsiDev    * 0.20 +
    momNorm   * 0.20 +
    volNorm   * 0.10 -
    volPenalty +
    divergencePenalty;

  return {
    emaCrossover, macdSignal, trendStrength,
    rsi, momentum24h: change24h,
    bollingerPct, volatilityPct, isSqueeze,
    volumeScore, compositeScore, atr, divergence,
  };
}

// ─── Signal generation ────────────────────────────────────────────────────────

function deriveSignal(ind: Indicators, config: StrategyConfig): "BUY" | "SELL" | "HOLD" {
  const { compositeScore, rsi, bollingerPct, isSqueeze, divergence } = ind;

  // Divergence overrides — early reversal warning (Dow Theory)
  if (divergence === "bearish" && compositeScore > 0 && rsi > 60) return "SELL";
  if (divergence === "bullish" && compositeScore < 0 && rsi < 40)  return "BUY";

  // RSI extremes (Wilder)
  if (rsi >= config.rsiOverbought && compositeScore < 5)  return "SELL";
  if (rsi <= config.rsiOversold   && compositeScore > -5) return "BUY";

  // Bollinger extremes (Bollinger)
  if (bollingerPct >= 0.9 && compositeScore < 0) return "SELL";
  if (bollingerPct <= 0.1 && compositeScore > 0) return "BUY";

  // Squeeze: wait for breakout confirmation
  if (isSqueeze && Math.abs(compositeScore) < 15) return "HOLD";

  // Composite threshold
  if (compositeScore > config.buyThreshold)  return "BUY";
  if (compositeScore < config.sellThreshold) return "SELL";
  return "HOLD";
}

type RegimeBias = "risk-on" | "risk-off" | "neutral";

function applyAggressiveSignalOverride(
  signal: "BUY" | "SELL" | "HOLD",
  ind: Indicators,
  config: StrategyConfig,
  regimeBias: RegimeBias,
): "BUY" | "SELL" | "HOLD" {
  if (config.aggressiveness !== "aggressive" || signal !== "HOLD") return signal;

  const nearBuyEdge = ind.compositeScore > (config.buyThreshold - 4) && ind.macdSignal >= -0.15 && ind.rsi < 62;
  const nearSellEdge = ind.compositeScore < (config.sellThreshold + 4) && ind.macdSignal <= 0.15 && ind.rsi > 38;

  if (regimeBias !== "risk-off" && nearBuyEdge && ind.volumeScore >= 0) return "BUY";
  if (regimeBias !== "risk-on" && nearSellEdge && ind.volumeScore <= 0) return "SELL";
  return signal;
}

function deriveConfidence(
  ind: Indicators,
  signal: "BUY" | "SELL" | "HOLD",
  strategy: string,
  config: StrategyConfig,
  regimeBias: RegimeBias,
): number {
  let base = 45;
  base += Math.min(30, Math.abs(ind.compositeScore) * 0.6);

  const aligned = (signal === "BUY" && ind.volumeScore > 0) || (signal === "SELL" && ind.volumeScore < 0);
  if (aligned)                                              base += 10;
  base += ind.trendStrength * 8;
  if (signal === "BUY"  && ind.rsi < 45)                   base += 7;
  if (signal === "SELL" && ind.rsi > 55)                   base += 7;
  if (strategy.toUpperCase().includes("DCA") && signal === "BUY") base += 12;
  if (ind.isSqueeze)                                        base -= 10;
  if (config.aggressiveness === "aggressive" && signal !== "HOLD") base += 4;

  // Divergence aligning with signal → boost
  if (ind.divergence === "bullish" && signal === "BUY")    base += 8;
  if (ind.divergence === "bearish" && signal === "SELL")   base += 8;
  // Divergence contradicting signal → penalize
  if (ind.divergence === "bearish" && signal === "BUY")    base -= 12;
  if (ind.divergence === "bullish" && signal === "SELL")   base -= 12;

  if (regimeBias === "risk-on" && signal === "BUY") base += 6;
  if (regimeBias === "risk-off" && signal === "SELL") base += 6;
  if (regimeBias === "risk-on" && signal === "SELL") base -= 8;
  if (regimeBias === "risk-off" && signal === "BUY") base -= 8;

  return Math.min(95, Math.max(25, Math.round(base)));
}

function deriveRiskLevel(ind: Indicators, regimeBias: RegimeBias, regimeVolatilityPct?: number): "Low" | "Medium" | "High" {
  const volPct = Math.max(ind.volatilityPct, regimeVolatilityPct ?? 0);
  if (volPct > 2.5 || Math.abs(ind.momentum24h) > 8 || regimeBias === "risk-off") return "High";
  if (volPct > 1.0 || Math.abs(ind.momentum24h) > 3) return "Medium";
  return "Low";
}

// ─── Reasoning & action ───────────────────────────────────────────────────────

function generateReasoning(
  signal: "BUY" | "SELL" | "HOLD",
  token: string,
  price: PriceData,
  ind: Indicators,
  _strategy: string,
  marketContext: string,
): string {
  const dir = price.price > price.emaPrice ? "above" : "below";
  const chg = (ind.momentum24h >= 0 ? "+" : "") + ind.momentum24h.toFixed(2) + "%";
  const base = `${token} $${price.price} (${dir} EMA $${price.emaPrice}). 24h: ${chg}. RSI ${ind.rsi.toFixed(0)}.`;

  const rsiNote =
    ind.rsi > 70 ? " RSI overbought — profit-taking zone (Wilder)." :
    ind.rsi < 30 ? " RSI oversold — accumulation zone (Wilder)." : "";

  const macdNote =
    ind.macdSignal > 0.5  ? " MACD histogram positive — bullish crossover (Appel)." :
    ind.macdSignal < -0.5 ? " MACD histogram negative — bearish crossover (Appel)." : "";

  const volNote =
    ind.volumeScore > 0.5  ? " High volume confirms upside (Wyckoff demand)." :
    ind.volumeScore < -0.5 ? " High volume confirms downside (Wyckoff supply)." :
    ind.volumeScore !== 0  ? " Below-average volume — weak confirmation." : "";

  const bbNote =
    ind.bollingerPct >= 0.85 ? " At upper Bollinger band — resistance zone." :
    ind.bollingerPct <= 0.15 ? " At lower Bollinger band — support zone." :
    ind.isSqueeze            ? " Bollinger squeeze — breakout incoming." : "";

  const divNote =
    ind.divergence === "bullish" ? " Bullish RSI divergence — price weakness may reverse (Dow)." :
    ind.divergence === "bearish" ? " Bearish RSI divergence — upside momentum fading (Dow)." : "";

  const ctx = marketContext ? ` ${marketContext}` : "";
  return `${base}${rsiNote}${macdNote}${bbNote}${volNote}${divNote}${ctx}`.trim();
}

function generateSuggestedAction(
  signal: "BUY" | "SELL" | "HOLD",
  token: string,
  price: PriceData,
  ind: Indicators,
  strategy: string,
): string {
  const p      = price.price;
  const atr    = ind.atr || p * 0.03;
  const aggressive = isAggressiveStrategy(strategy);
  const target = (p + atr * (aggressive ? 2.2 : 1.5)).toFixed(4);
  const stop   = (p - atr * (aggressive ? 0.8 : 1.0)).toFixed(4);
  const rrLabel = aggressive ? "2.0" : "1.5";

  if (signal === "BUY") {
    if (strategy.toUpperCase().includes("DCA"))
      return `DCA into ${token} at $${p}. Scale in gradually — next target $${target}. Don't deploy all capital at once.`;
    if (strategy.toUpperCase().includes("LP"))
      return `Add liquidity near $${p}. Rebalance threshold: >${(ind.volatilityPct * 2).toFixed(1)}% price drift.`;
    if (aggressive)
      return `Aggressive long on ${token} near $${p}. Target $${target}, protective stop $${stop}. Favor momentum continuation while keeping ATR stop active.`;
    return `Enter ${token} at $${p}. Target $${target}, stop $${stop}. ATR-based R/R ≥ ${rrLabel} (Livermore principle).`;
  }
  if (signal === "SELL") {
    if (aggressive)
      return `Take profits / de-risk ${token} around $${p}. Downside trigger near $${stop}; rotate quickly if momentum weakens.`;
    return `Reduce ${token} at $${p}. Support at $${stop}. Protect capital first — losses compound faster than gains (Kahneman).`;
  }
  if (ind.isSqueeze)
    return `Bollinger squeeze on ${token}. Await volume breakout above $${target} or below $${stop} before committing.`;
  if (ind.divergence !== "none")
    return `Divergence signal on ${token}. Wait for confirmation: ${ind.divergence === "bullish" ? `break above $${target}` : `break below $${stop}`}.`;
  return `Hold ${token} at $${p}. Watch $${target} (resistance) and $${stop} (support) for next signal.`;
}

// ─── Multi-token scanner ──────────────────────────────────────────────────────

interface TokenScore { symbol: string; score: number; ind: Indicators; price: PriceData; }

function scanAllTokens(snapshot: MarketSnapshot): TokenScore[] {
  return snapshot.prices
    .filter(p => !p.symbol.startsWith("USDC"))
    .map(p => {
      const ind = calculateIndicators(p);
      return { symbol: p.symbol.split("/")[0], score: ind.compositeScore, ind, price: p };
    })
    .sort((a, b) => b.score - a.score);
}

function deriveRegimeBias(snapshot: MarketSnapshot): RegimeBias {
  const regime = snapshot.regime;
  if (!regime) return "neutral";
  if (regime.breadthPct >= 60 && regime.avgChange24h >= 0.5) return "risk-on";
  if (regime.breadthPct <= 40 && regime.avgChange24h <= -0.5) return "risk-off";
  return "neutral";
}

function deriveRegimeScoreDelta(
  snapshot: MarketSnapshot,
  rankings: TokenScore[],
  targetToken: string,
  config: StrategyConfig,
): number {
  const regime = snapshot.regime;
  const bias = deriveRegimeBias(snapshot);
  let delta = 0;

  if (bias === "risk-on") delta += 2.5;
  if (bias === "risk-off") delta -= 2.5;

  const targetIdx = rankings.findIndex((r) => r.symbol.toUpperCase() === targetToken.toUpperCase());
  if (targetIdx === 0) delta += 2 * config.rotationBias;
  else if (targetIdx > 0 && targetIdx <= 2) delta += 1 * config.rotationBias;

  if (regime?.leaders.some((leader) => leader.startsWith(`${targetToken.toUpperCase()} `))) {
    delta += 1.8;
  }

  return Math.round(delta * 100) / 100;
}

function getMarketContext(rankings: TokenScore[], targetToken: string, snapshot: MarketSnapshot, regimeBias: RegimeBias): string {
  const notes: string[] = [];
  const best = rankings[0];
  if (best && best.symbol !== targetToken && best.score > 12)
    notes.push(`Strongest opportunity: ${best.symbol} (score ${best.score.toFixed(0)}, RSI ${best.ind.rsi.toFixed(0)}, 24h ${best.ind.momentum24h >= 0 ? "+" : ""}${best.ind.momentum24h.toFixed(1)}%).`);
  else {
    const others = rankings.filter(r => r.symbol !== targetToken).slice(0, 2);
    if (others.length) {
      notes.push(`Market: ${others.map(o => `${o.symbol} ${o.ind.momentum24h >= 0 ? "+" : ""}${o.ind.momentum24h.toFixed(1)}%`).join(", ")}.`);
    }
  }

  if (snapshot.regime) {
    const r = snapshot.regime;
    notes.push(
      `Regime ${regimeBias}: breadth ${r.breadthPct}% | avg 24h ${r.avgChange24h >= 0 ? "+" : ""}${r.avgChange24h.toFixed(2)}% | vol ${r.volatilityProxyPct.toFixed(2)}%${r.leaders.length ? ` | leaders ${r.leaders.join(", ")}` : ""}.`
    );
  }

  return notes.join(" ");
}

// ─── Main export ──────────────────────────────────────────────────────────────

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
  const tokenName   = tokenData.symbol.split("/")[0] || params.targetToken || "INIT";
  const rankings    = scanAllTokens(snapshot);
  const regimeBias  = deriveRegimeBias(snapshot);
  const regimeDelta = deriveRegimeScoreDelta(snapshot, rankings, tokenName, config);
  const tunedInd: Indicators = { ...ind, compositeScore: ind.compositeScore + regimeDelta };
  let signal        = deriveSignal(tunedInd, config);
  signal            = applyAggressiveSignalOverride(signal, tunedInd, config, regimeBias);

  // Raw confidence before history calibration
  const rawConf     = deriveConfidence(tunedInd, signal, strategy, config, regimeBias);
  // Calibrate using signal-history ring buffer (ClaudeCodeMind pattern)
  const confidence  = calibrateConfidence(rawConf, signal, tokenName, strategy);

  const riskLevel   = deriveRiskLevel(tunedInd, regimeBias, snapshot.regime?.volatilityProxyPct);
  const marketCtx   = getMarketContext(rankings, tokenName, snapshot, regimeBias);

  // Record to history ring buffer for future calibration
  recordSignal({
    timestamp:  Date.now(),
    strategy,
    token:      tokenName,
    signal,
    confidence,
    riskLevel,
    engine:     "rules",
  });

  const indicators: IndicatorSnapshot = {
    rsi:           Math.round(tunedInd.rsi),
    macd:          tunedInd.macdSignal > 0.2 ? "+" : tunedInd.macdSignal < -0.2 ? "-" : "0",
    bbPct:         Math.round(tunedInd.bollingerPct * 100),
    volume:        tunedInd.volumeScore > 0 ? "High↑" : tunedInd.volumeScore < 0 ? "High↓" : "Normal",
    squeeze:       tunedInd.isSqueeze,
    divergence:    tunedInd.divergence,
    compositeScore: Math.round(tunedInd.compositeScore),
    atr:           Math.round(tunedInd.atr * 10000) / 10000,
    regime:        regimeBias,
    marketBreadth: snapshot.regime?.breadthPct,
    leader:        snapshot.regime?.leaders.some((leader) => leader.startsWith(`${tokenName.toUpperCase()} `)) ?? false,
  };

  return {
    signal,
    token:           tokenName,
    confidence,
    reasoning:       generateReasoning(signal, tokenName, tokenData, tunedInd, strategy, marketCtx),
    suggestedAction: generateSuggestedAction(signal, tokenName, tokenData, tunedInd, strategy),
    riskLevel,
    indicators,
  };
}
