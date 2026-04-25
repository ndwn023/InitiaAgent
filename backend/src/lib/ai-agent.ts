/**
 * AI agent skills for InitiaAgent trading marketplace.
 *
 * All generation goes through model-router which cascades:
 *   Anthropic Claude → Google Gemini → Claude CLI (stdin, avoids ENAMETOOLONG)
 */

import { generate, generateMulti, generateStream, ANTHROPIC_MODELS, GEMINI_MODELS } from "./model-router";
import type { MarketSnapshot } from "./price-feed";
import { formatMarketContext } from "./price-feed";
import { buildSignalContext, calibrateConfidence, recordSignal } from "./signal-history";
import type { MarketAnalysis, ChatMessage } from "@initia-agent/shared";

// Re-export so downstream modules keep importing `MarketAnalysis`/`ChatMessage`
// from this module without breaking.
export type { MarketAnalysis, ChatMessage };

export interface AgentContext {
  agentCount?: number;
  totalCapital?: number;
  liveProfit?: number;
  initPrice?: number;
  agents?: Array<{ name: string; target: string; strategy: string; status: string }>;
  marketData?: string;
  model?: string;
}

export interface StrategyOptimization {
  currentStrategy: string;
  improvements: string[];
  riskAdjustments: string[];
  expectedImpact: string;
  confidence: number;
  model: string;
}

export interface PortfolioRiskReport {
  riskScore: number;           // 0-100 (100 = highest risk)
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  exposures: string[];
  mitigations: string[];
  summary: string;
  model: string;
}

export interface ConsensusSignal {
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  agreementPct: number;        // % of models that agreed
  votes: { model: string; signal: string; confidence: number }[];
  reasoning: string;
}

export interface EpochReport {
  period: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  nextEpochOutlook: string;
  model: string;
}

// ─── Per-strategy skill context ──────────────────────────────────────────────

const STRATEGY_CONTEXT: Record<string, string> = {
  DCA:   "DCA mode: accumulate on dips. BUY when RSI<35 + volume spike. Track cost basis for compound entry. Never SELL unless hard stop-loss. Use 30% position sizing per signal and confirm with market breadth.",
  LP:    "LP mode: maximize fee income, minimize IL. BUY when pool ratio deviation >5%. Trigger rebalance on significant price deviation. Prefer concentrated range when volatility is low and breadth remains neutral/positive.",
  YIELD: "Yield mode: chase highest risk-adjusted APY. Rotate protocol if APY drops >15% below baseline. Optimize harvest timing for gas efficiency. Track reward token trend and cross-asset momentum leaders.",
  VIP:   "VIP mode: aggressive profit capture while maximizing tier benefits and esINIT rewards. Auto-claim and compound. Prioritize breakout continuation when regime is risk-on and volume confirms.",
};

function getAggressionProfile(strategy: string): "conservative" | "balanced" | "aggressive" {
  const s = strategy.toUpperCase();
  if (s.includes("VIP") || s.includes("AGGRESSIVE") || s.includes("SNIPER") || s.includes("SCALP") || s.includes("MOMENTUM")) return "aggressive";
  if (s.includes("DCA")) return "conservative";
  return "balanced";
}

// ─── System prompts ───────────────────────────────────────────────────────────

const TRADING_SYSTEM = `You are an elite quantitative trading AI on the Initia blockchain (evm-1 MiniEVM L2).

## Analysis Framework — apply EVERY step in order before generating a signal:

1. TREND IDENTIFICATION
   - Compare current price vs EMA: above = bullish structure, below = bearish
   - EMA crossover magnitude: >2% = strong trend, <0.5% = weak/choppy

2. MOMENTUM SCAN (RSI — Wilder)
   - RSI < 30: deeply oversold, accumulation zone — high-conviction BUY candidate
   - RSI > 70: overbought, distribution zone — high-conviction SELL candidate
   - RSI 30–45: mild oversold, bias BUY; RSI 55–70: mild overbought, bias SELL
   - RSI direction matters: rising RSI = building momentum; falling = fading

3. MACD CHECK (Appel)
   - Histogram above zero and rising: bullish momentum confirmed
   - Histogram below zero and falling: bearish momentum confirmed
   - Crossing zero line: signal change — increase weight

4. BOLLINGER BAND FILTER (Bollinger)
   - Price at lower band (bbPct ≤ 10%): support zone, potential mean reversion BUY
   - Price at upper band (bbPct ≥ 90%): resistance zone, potential mean reversion SELL
   - Squeeze (volatility < 0.3%): breakout imminent — hold until volume confirms direction

5. VOLUME VALIDATION (Wyckoff)
   - High volume confirming price direction = strong signal, boost confidence +10–15%
   - High volume opposing price direction = trap/reversal warning
   - Low volume on any move = weak signal, reduce confidence -10–20%

6. DIVERGENCE DETECTION (Dow Theory)
   - Bullish divergence: price makes lower low but RSI makes higher low = early reversal up
   - Bearish divergence: price makes higher high but RSI makes lower high = early reversal down
   - Divergence OVERRIDES composite score for final signal when present

7. SIGNAL HISTORY CONTEXT
   - If recent history shows persistent signals in one direction = trend confirmation
   - If signals oscillate rapidly = noisy environment, default to HOLD

8. RISK GATE (Tudor Jones / Dalio)
   - Minimum R/R 1:2 required for BUY or SELL
   - Never trade into a squeeze without volume confirmation
   - Conflicting signals = HOLD (protect capital first)

9. PROFIT ACCELERATION LAYER
   - Use regime data (breadth, avg 24h return, leaders) to decide whether to press or reduce risk
   - In risk-on regime, allow earlier momentum continuation entries when at least 3 factors align
   - In risk-off regime, prioritize capital defense and faster de-risking
   - For aggressive profiles, seek faster rotation into strongest leader while keeping stop discipline

## Signal Classification:
- STRONG BUY (confidence 80–95): 5+ factors aligned, RSI<40, volume surge, no divergence
- MODERATE BUY (confidence 60–79): 3–4 factors aligned, volume absent or neutral
- HOLD (confidence 40–59): mixed signals, squeeze, divergence warning
- MODERATE SELL (confidence 60–79): 3–4 bearish factors, momentum fading
- STRONG SELL (confidence 80–95): RSI>65 + price below EMA + MACD negative + volume

Respond ONLY with valid JSON. Your reasoning MUST cite specific numbers from the provided price data.`;

const CHAT_SYSTEM = `You are the Chief Portfolio Strategist for InitiaAgent — AI-driven trading marketplace on Initia blockchain.

Masters you embody: Jesse Livermore (trend discipline), Benjamin Graham (margin of safety), Paul Tudor Jones (risk first), Stanley Druckenmiller (concentration), Ray Dalio (diversification), John Bollinger (volatility).

Format: **Bold** numbers/tokens/percentages. Bullet points for lists. 2-3 sentence paragraphs. 150-500 words. End with one clear actionable recommendation. No # headings, no code blocks.`;

const OPTIMIZER_SYSTEM = `You are a quantitative strategy optimizer for AI trading agents on the Initia blockchain.

Your role: analyze trading strategy configurations, identify weaknesses, suggest concrete improvements based on market conditions and risk parameters.

Always respond with valid JSON matching the requested schema.`;

const RISK_SYSTEM = `You are a portfolio risk manager specializing in DeFi and on-chain trading systems.

Evaluate concentration risk, smart contract risk, liquidity risk, market risk, and execution risk. Provide actionable mitigations.

Respond ONLY with valid JSON.`;

const EPOCH_SYSTEM = `You are the performance analyst for InitiaAgent.

Generate clear, data-driven epoch reports that help agent creators and subscribers understand performance, learn from results, and improve for the next epoch.

Tone: professional, direct, actionable. No fluff.`;

// ─── JSON parsing ─────────────────────────────────────────────────────────────

function parseJSON<T>(text: string, fallback: T): T {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON object from the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* ignore */ }
    }
    return fallback;
  }
}

function parseAnalysis(text: string, fallbackToken: string): MarketAnalysis {
  const result = parseJSON<Partial<MarketAnalysis>>(text, {});
  const signalMatch = text.match(/"signal"\s*:\s*"(BUY|SELL|HOLD)"/i);
  const signal = (result.signal || signalMatch?.[1] || "HOLD").toUpperCase() as "BUY" | "SELL" | "HOLD";

  return {
    signal,
    token: result.token || fallbackToken,
    confidence: result.confidence ?? 60,
    reasoning: result.reasoning || "Analysis complete.",
    suggestedAction: result.suggestedAction || `Monitor ${fallbackToken} for next signal.`,
    riskLevel: result.riskLevel || "Medium",
  };
}

// ─── Skill 1: Market Analysis (AI, with model fallback) ───────────────────────

export async function analyzeMarketAI(
  strategy: string,
  params: { targetToken?: string; capital?: number; interval?: string; marketData?: string },
  preferredModel?: string,
): Promise<MarketAnalysis & { model: string }> {
  const strategyKey = strategy.toUpperCase().split(" ")[0];
  const strategyCtx = STRATEGY_CONTEXT[strategyKey] ?? "";
  const aggressionProfile = getAggressionProfile(strategy);
  const aggressionDirective =
    aggressionProfile === "aggressive"
      ? "Profit objective: aggressive. Bias toward momentum continuation and faster rotation when signal quality is acceptable."
      : aggressionProfile === "conservative"
        ? "Profit objective: conservative compounding. Favor high-quality entries and avoid overtrading."
        : "Profit objective: balanced growth. Capture opportunities while avoiding noisy setups.";
  const requestedToken = (params.targetToken || "INIT").toUpperCase();
  const token = requestedToken === "USDC" || requestedToken === "USDT" || requestedToken === "DAI"
    ? "INIT"
    : requestedToken;

  // Inject temporal context from signal-history ring buffer (ClaudeCodeMind pattern)
  const signalCtx = buildSignalContext(token, strategy);

  const prompt = `Analyze market conditions for this strategy on Initia blockchain:

Strategy: ${strategy}
${strategyCtx ? `Strategy behavior: ${strategyCtx}` : ""}
Aggression Profile: ${aggressionProfile}
${aggressionDirective}
Target Token: ${token}
${params.capital ? `Capital: ${params.capital} INIT` : ""}
${params.interval ? `Interval: ${params.interval}` : ""}
${signalCtx ? `\n--- RECENT SIGNAL HISTORY ---\n${signalCtx}\n---\n` : ""}
${params.marketData ? `\n--- REAL-TIME PRICE DATA ---\n${params.marketData}\n---` : ""}

Apply the 9-step analysis framework from your system prompt. Use market regime data (breadth, average return, leaders) to improve timing.
For aggressive profile, prefer higher trade frequency only when at least 3 indicators align and R/R remains >= 1:2.
For conservative profile, prioritize downside protection and avoid weak volume setups.
Consider signal history when calibrating confidence.

Respond ONLY with valid JSON:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "token": "token pair",
  "confidence": 0-100,
  "reasoning": "under 120 words — cite specific price numbers, RSI, MACD, volume, and divergence if present",
  "suggestedAction": "specific action with ATR-based price targets",
  "riskLevel": "Low" | "Medium" | "High"
}`;

  try {
    const { text, model } = await generate({
      systemPrompt: TRADING_SYSTEM,
      userPrompt: prompt,
      model: preferredModel,
      temperature: 0.4,
      maxTokens: 700,
      jsonMode: true,
    });
    const parsed = parseAnalysis(text, token);

    // Calibrate confidence using history ring buffer
    const calibrated = {
      ...parsed,
      confidence: calibrateConfidence(parsed.confidence, parsed.signal, token, strategy),
    };

    // Record to ring buffer for future calibration (ClaudeCodeMind ring buffer pattern)
    recordSignal({
      timestamp: Date.now(),
      strategy,
      token,
      signal: calibrated.signal,
      confidence: calibrated.confidence,
      riskLevel: calibrated.riskLevel,
      engine: "ai",
    });

    return { ...calibrated, model };
  } catch {
    const isDCA = strategy.includes("DCA");
    return {
      signal: isDCA ? "BUY" : "HOLD",
      token,
      confidence: 60,
      reasoning: "Simulation mode — all AI providers unavailable. Applying DCA logic.",
      suggestedAction: "Continue monitoring market conditions.",
      riskLevel: "Low",
      model: "simulation",
    };
  }
}

// ─── Skill 2: Chat with Portfolio Strategist ──────────────────────────────────

export async function chatWithAgent(messages: ChatMessage[], ctx?: AgentContext): Promise<string> {
  const initPrice = ctx?.initPrice || 0.08;
  const profitUsd = (ctx?.liveProfit || 0) * initPrice;

  const contextBlock = ctx ? `\nUSER PORTFOLIO:
- Active agents: ${ctx.agentCount || 0}
- Total capital: **${ctx.totalCapital?.toFixed(2) || "0"} INIT**
- Unrealized profit: **${(ctx.liveProfit || 0).toFixed(4)} INIT** (≈ $${profitUsd.toFixed(2)} USD)
- Agents:
${ctx.agents?.map(a => `  * **${a.name}**: ${a.target} via ${a.strategy} (${a.status})`).join("\n") || "  None"}
${ctx.marketData ? `\nMARKET:\n${ctx.marketData}` : ""}` : "";

  const history = messages.slice(0, -1).map(m => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
  const lastMsg = messages[messages.length - 1]?.content || "";

  const prompt = `${contextBlock}\n\n${history ? `Conversation:\n${history}\n\n` : ""}User: ${lastMsg}`;

  try {
    const { text } = await generate({
      systemPrompt: CHAT_SYSTEM,
      userPrompt: prompt,
      model: ctx?.model,
      temperature: 0.6,
      maxTokens: 2048,
    });
    return text;
  } catch {
    return "I'm temporarily unavailable. Please try again in a moment.";
  }
}

// ─── Skill 2b: Chat — SSE streaming variant ──────────────────────────────────

export async function chatWithAgentStream(
  messages: ChatMessage[],
  ctx: AgentContext | undefined,
  onChunk: (text: string) => void,
): Promise<{ model: string }> {
  const initPrice = ctx?.initPrice || 0.08;
  const profitUsd = (ctx?.liveProfit || 0) * initPrice;

  const contextBlock = ctx ? `\nUSER PORTFOLIO:
- Active agents: ${ctx.agentCount || 0}
- Total capital: **${ctx.totalCapital?.toFixed(2) || "0"} INIT**
- Unrealized profit: **${(ctx.liveProfit || 0).toFixed(4)} INIT** (≈ $${profitUsd.toFixed(2)} USD)
- Agents:
${ctx.agents?.map(a => `  * **${a.name}**: ${a.target} via ${a.strategy} (${a.status})`).join("\n") || "  None"}
${ctx.marketData ? `\nMARKET:\n${ctx.marketData}` : ""}` : "";

  const history = messages.slice(0, -1).map(m => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
  const lastMsg = messages[messages.length - 1]?.content || "";

  const prompt = `${contextBlock}\n\n${history ? `Conversation:\n${history}\n\n` : ""}User: ${lastMsg}`;

  try {
    return await generateStream(
      { systemPrompt: CHAT_SYSTEM, userPrompt: prompt, model: ctx?.model, temperature: 0.6, maxTokens: 2048 },
      onChunk,
    );
  } catch {
    onChunk("I'm temporarily unavailable. Please try again in a moment.");
    return { model: "fallback" };
  }
}

// ─── Skill 3: Consensus Signal (multi-model voting) ───────────────────────────

export async function generateConsensusSignal(
  strategy: string,
  params: { targetToken?: string; capital?: number; marketData?: string },
): Promise<ConsensusSignal> {
  const requestedToken = (params.targetToken || "INIT").toUpperCase();
  const token = requestedToken === "USDC" || requestedToken === "USDT" || requestedToken === "DAI"
    ? "INIT"
    : requestedToken;
  const signalCtx = buildSignalContext(token, strategy);

  const prompt = `Strategy: ${strategy}, Token: ${token}, Capital: ${params.capital || 0} INIT.
${params.marketData ? `Market data:\n${params.marketData}` : ""}
${signalCtx ? `\nSignal history context: ${signalCtx}` : ""}

Apply the full 9-step analysis framework, including regime/breadth interpretation. Give your independent trading signal:
{"signal":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"cite specific indicators and numbers"}`;

  const consensusModels = [
    "claude-sonnet-4-6",
    "gemini-2.5-flash",
    "claude-haiku-4-5",
  ];

  const results = await generateMulti(
    { systemPrompt: TRADING_SYSTEM, userPrompt: prompt, temperature: 0.3, maxTokens: 350, jsonMode: true },
    consensusModels,
  );

  const votes = results.map(r => {
    const parsed = parseJSON<{ signal?: string; confidence?: number; reasoning?: string }>(r.text, {});
    return {
      model: r.model,
      signal: (parsed.signal || "HOLD").toUpperCase(),
      confidence: parsed.confidence ?? 50,
      reasoning: parsed.reasoning || "",
    };
  });

  if (votes.length === 0) {
    return { signal: "HOLD", confidence: 40, agreementPct: 0, votes: [], reasoning: "No model responses available." };
  }

  // Weighted tally: higher-confidence votes count more
  const weightedTally: Record<string, number> = { BUY: 0, SELL: 0, HOLD: 0 };
  const countTally:    Record<string, number> = { BUY: 0, SELL: 0, HOLD: 0 };
  votes.forEach(v => {
    weightedTally[v.signal] = (weightedTally[v.signal] || 0) + v.confidence;
    countTally[v.signal]    = (countTally[v.signal] || 0) + 1;
  });

  const winner = (Object.entries(weightedTally).sort((a, b) => b[1] - a[1])[0][0]) as "BUY" | "SELL" | "HOLD";
  const agreementPct = Math.round((countTally[winner] / votes.length) * 100);
  const avgConfidence = Math.round(
    votes.filter(v => v.signal === winner).reduce((s, v) => s + v.confidence, 0) /
    Math.max(1, countTally[winner])
  );

  // Penalize low agreement (noisy consensus)
  const finalConfidence = agreementPct < 50
    ? Math.max(25, avgConfidence - 15)
    : calibrateConfidence(avgConfidence, winner, token, strategy);

  const reasoning = votes.map(v => `[${v.model.split("-")[0]}:${v.signal}@${v.confidence}%] ${v.reasoning}`).join(" | ");

  return { signal: winner, confidence: finalConfidence, agreementPct, votes, reasoning };
}

// ─── Skill 4: Strategy Optimizer ─────────────────────────────────────────────

export async function optimizeStrategy(
  agentName: string,
  strategy: string,
  params: {
    takeProfitPct?: number;
    stopLossPct?: number;
    minConfidence?: number;
    tradeSizePct?: number;
    interval?: string;
    initialCapital?: number;
    currentProfit?: number;
    marketData?: string;
  },
  preferredModel?: string,
): Promise<StrategyOptimization> {
  const prompt = `Agent: "${agentName}"
Strategy: ${strategy}
Current params:
- Take Profit: ${params.takeProfitPct ?? "not set"}%
- Stop Loss: ${params.stopLossPct ?? "not set"}%
- Min Confidence: ${params.minConfidence ?? "not set"}%
- Trade Size: ${params.tradeSizePct ?? "not set"}% of capital
- Interval: ${params.interval || "not set"}
- Capital: ${params.initialCapital || 0} INIT
- Current Profit: ${params.currentProfit || 0} INIT
${params.marketData ? `Market: ${params.marketData}` : ""}

Analyze this configuration and suggest concrete improvements. Consider:
- Risk/reward optimization (Paul Tudor Jones 2:1 minimum)
- Position sizing (Kelly Criterion principles)
- Timing optimization for ${strategy} strategy type
- DeFi-specific risks on Initia (liquidity, slippage, gas)

Respond with JSON:
{
  "currentStrategy": "brief evaluation",
  "improvements": ["concrete improvement 1", "concrete improvement 2", ...],
  "riskAdjustments": ["risk adjustment 1", ...],
  "expectedImpact": "expected outcome of changes",
  "confidence": 0-100
}`;

  const fallback: StrategyOptimization = {
    currentStrategy: strategy,
    improvements: ["Increase min confidence threshold to 70% to reduce noise trades", "Set take profit at 15% to capture meaningful gains"],
    riskAdjustments: ["Cap trade size at 10% per trade (Jones rule: never risk > 2% of capital)", "Set stop loss at 8% to limit downside"],
    expectedImpact: "Improved risk-adjusted returns with lower drawdown.",
    confidence: 60,
    model: "fallback",
  };

  try {
    const { text, model } = await generate({
      systemPrompt: OPTIMIZER_SYSTEM, userPrompt: prompt,
      model: preferredModel, temperature: 0.5, maxTokens: 800, jsonMode: true,
    });
    const parsed = parseJSON<Omit<StrategyOptimization, "model">>(text, fallback);
    return { ...parsed, model };
  } catch {
    return fallback;
  }
}

// ─── Skill 5: Portfolio Risk Assessment ───────────────────────────────────────

export async function assessPortfolioRisk(
  ownerAddress: string,
  agents: Array<{ name: string; strategy: string; contractAddress: string; initialCapital: number; status: string }>,
  snapshot: MarketSnapshot,
  preferredModel?: string,
): Promise<PortfolioRiskReport> {
  const marketData = formatMarketContext(snapshot);
  const totalCapital = agents.reduce((s, a) => s + a.initialCapital, 0);
  const activeCount = agents.filter(a => a.status === "Active").length;

  const agentList = agents.map(a =>
    `- ${a.name}: ${a.strategy}, ${a.initialCapital} INIT, ${a.status}, contract: ${a.contractAddress.slice(0, 10)}...`
  ).join("\n");

  const prompt = `Portfolio owner: ${ownerAddress.slice(0, 10)}...
Total capital deployed: ${totalCapital} INIT
Active agents: ${activeCount}/${agents.length}

Agents:
${agentList}

${marketData}

Assess portfolio risk considering:
1. Concentration risk (single strategy/token overexposure)
2. Smart contract risk (multiple contracts deployed)
3. Liquidity risk (capital locked in positions)
4. Market risk (current price conditions)
5. Execution risk (agent reliability and interval timing)

Respond with JSON:
{
  "riskScore": 0-100,
  "riskLevel": "Low"|"Medium"|"High"|"Critical",
  "exposures": ["key risk exposure 1", ...],
  "mitigations": ["mitigation action 1", ...],
  "summary": "2-3 sentence risk summary"
}`;

  const fallback: PortfolioRiskReport = {
    riskScore: 50, riskLevel: "Medium",
    exposures: ["Concentrated exposure to INIT/USDC pair", "Smart contract execution dependency"],
    mitigations: ["Diversify across multiple strategy types", "Monitor contract performance weekly"],
    summary: "Portfolio presents moderate risk with standard DeFi exposure. Recommend diversification.",
    model: "fallback",
  };

  try {
    const { text, model } = await generate({
      systemPrompt: RISK_SYSTEM, userPrompt: prompt,
      model: preferredModel, temperature: 0.3, maxTokens: 600, jsonMode: true,
    });
    const parsed = parseJSON<Omit<PortfolioRiskReport, "model">>(text, fallback);
    return { ...parsed, model };
  } catch {
    return fallback;
  }
}

// ─── Skill 6: Epoch Performance Report ───────────────────────────────────────

export async function generateEpochReport(
  epochData: {
    epochNumber?: number;
    startDate: string;
    endDate: string;
    agents: Array<{ name: string; strategy: string; profit: number; trades: number; winRate?: number }>;
    totalCapital: number;
    totalProfit: number;
    initPriceStart: number;
    initPriceEnd: number;
    marketSnapshot: MarketSnapshot;
  },
  preferredModel?: string,
): Promise<EpochReport> {
  const priceChange = ((epochData.initPriceEnd - epochData.initPriceStart) / epochData.initPriceStart * 100).toFixed(2);
  const roi = epochData.totalCapital > 0 ? ((epochData.totalProfit / epochData.totalCapital) * 100).toFixed(2) : "0";
  const marketData = formatMarketContext(epochData.marketSnapshot);

  const agentSummary = epochData.agents.map(a =>
    `- ${a.name} (${a.strategy}): ${a.profit >= 0 ? "+" : ""}${a.profit.toFixed(4)} INIT | ${a.trades} trades${a.winRate ? ` | ${a.winRate}% win rate` : ""}`
  ).join("\n");

  const prompt = `Epoch ${epochData.epochNumber || "N"} Report
Period: ${epochData.startDate} → ${epochData.endDate}
Total Capital: ${epochData.totalCapital} INIT
Total Profit: ${epochData.totalProfit >= 0 ? "+" : ""}${epochData.totalProfit.toFixed(4)} INIT (${roi}% ROI)
INIT Price: $${epochData.initPriceStart} → $${epochData.initPriceEnd} (${parseFloat(priceChange) >= 0 ? "+" : ""}${priceChange}%)

Agent Performance:
${agentSummary}

Current Market: ${marketData}

Generate a comprehensive epoch report. Respond with JSON:
{
  "period": "formatted period string",
  "summary": "2-3 sentence executive summary with key numbers",
  "highlights": ["notable achievement or event 1", ...],
  "recommendations": ["actionable recommendation for next epoch 1", ...],
  "nextEpochOutlook": "1-2 sentence market outlook for next epoch"
}`;

  const fallback: EpochReport = {
    period: `${epochData.startDate} → ${epochData.endDate}`,
    summary: `Epoch generated ${epochData.totalProfit.toFixed(4)} INIT profit across ${epochData.agents.length} agents with ${roi}% ROI.`,
    highlights: ["All agents executed successfully", `INIT price moved ${priceChange}%`],
    recommendations: ["Review underperforming strategies", "Consider adjusting take-profit targets"],
    nextEpochOutlook: "Market conditions suggest continued volatility. Monitor INIT/USDC pair closely.",
    model: "fallback",
  };

  try {
    const { text, model } = await generate({
      systemPrompt: EPOCH_SYSTEM, userPrompt: prompt,
      model: preferredModel, temperature: 0.5, maxTokens: 800, jsonMode: true,
    });
    const parsed = parseJSON<Omit<EpochReport, "model">>(text, fallback);
    return { ...parsed, model };
  } catch {
    return fallback;
  }
}
