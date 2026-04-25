/**
 * Agent skill endpoints — extended AI capabilities for InitiaAgent.
 *
 * POST /api/agent/consensus   — multi-model voting signal
 * POST /api/agent/optimize    — strategy optimizer
 * POST /api/agent/risk        — portfolio risk assessment
 * POST /api/agent/epoch       — epoch performance report
 */

import { Router, Request, Response } from "express";
import { fetchPrices } from "../lib/price-feed";
import {
  generateConsensusSignal,
  optimizeStrategy,
  assessPortfolioRisk,
  generateEpochReport,
} from "../lib/ai-agent";
import { ANTHROPIC_MODELS, GEMINI_MODELS } from "../lib/model-router";

const router = Router();

// GET /api/agent/strategy-skills — static config for frontend
router.get("/strategy-skills", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
  res.json({
    strategies: {
      DCA: {
        skills: ["Dip Entry Detector", "Accumulation Engine", "Cost Basis Tracker", "DCA Interval Optimizer", "Market Breadth Filter"],
        indicators: ["RSI < 35", "EMA 20/50 crossover", "Volume spike +2σ", "24h momentum score", "Breadth > 45%"],
      },
      LP: {
        skills: ["IL Protection Guard", "Fee APR Optimizer", "Pool Rebalance Trigger", "Depth Scanner", "Volatility Regime Router"],
        indicators: ["Pool ratio deviation >5%", "Volume/TVL ratio", "Fee 24h APR", "Price range delta", "Intraday volatility %"],
      },
      YIELD: {
        skills: ["APY Scanner", "Protocol Rotation Engine", "Harvest Timer", "Compound Frequency Optimizer", "Cross-Asset Leader Scanner"],
        indicators: ["APY delta 7d", "Emissions decay rate", "Utilization ratio", "Reward token trend", "Leader momentum map"],
      },
      VIP: {
        skills: ["Tier Retention Monitor", "esINIT Compounder", "Epoch Timing Tracker", "Volume Threshold Manager", "Breakout Sniper"],
        indicators: ["esINIT APR", "VIP tier threshold", "Epoch progress %", "Loyalty multiplier", "Risk-on regime + leader confirmation"],
      },
    },
    dataFeeds: {
      primary: ["CoinGecko multi-asset prices", "24h volume/market-cap turnover", "Market breadth and leader scan"],
      cacheSeconds: 60,
    },
    availableModels: {
      anthropic: ANTHROPIC_MODELS,
      gemini: GEMINI_MODELS,
    },
    apiKeys: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

// POST /api/agent/consensus
router.post("/consensus", async (req: Request, res: Response) => {
  try {
    const { strategy, targetToken, capital, marketData } = req.body;
    if (!strategy) { res.status(400).json({ error: "strategy is required" }); return; }

    const snapshot = await fetchPrices();
    const liveMarket = marketData || snapshot.prices.map(p => `${p.symbol}: $${p.price}`).join(", ");

    const consensus = await generateConsensusSignal(strategy, { targetToken, capital, marketData: liveMarket });
    res.json({ ...consensus, priceSnapshot: snapshot.prices, priceSource: snapshot.source });
  } catch (error) {
    console.error("Consensus signal error:", error);
    res.status(500).json({ error: "Failed to generate consensus signal" });
  }
});

// POST /api/agent/optimize
router.post("/optimize", async (req: Request, res: Response) => {
  try {
    const { agentName, strategy, params, model } = req.body;
    if (!agentName || !strategy) { res.status(400).json({ error: "agentName and strategy are required" }); return; }

    const snapshot = await fetchPrices();
    const marketData = snapshot.prices.map(p => `${p.symbol}: $${p.price} (24h: ${p.change24h ?? 0}%)`).join(", ");

    const result = await optimizeStrategy(agentName, strategy, { ...params, marketData }, model);
    res.json(result);
  } catch (error) {
    console.error("Strategy optimize error:", error);
    res.status(500).json({ error: "Failed to optimize strategy" });
  }
});

// POST /api/agent/risk
router.post("/risk", async (req: Request, res: Response) => {
  try {
    const { ownerAddress, agents, model } = req.body;
    if (!ownerAddress || !Array.isArray(agents)) {
      res.status(400).json({ error: "ownerAddress and agents[] are required" });
      return;
    }

    const snapshot = await fetchPrices();
    const report = await assessPortfolioRisk(ownerAddress, agents, snapshot, model);
    res.json(report);
  } catch (error) {
    console.error("Risk assessment error:", error);
    res.status(500).json({ error: "Failed to assess portfolio risk" });
  }
});

// POST /api/agent/epoch
router.post("/epoch", async (req: Request, res: Response) => {
  try {
    const { epochNumber, startDate, endDate, agents, totalCapital, totalProfit, initPriceStart, initPriceEnd, model } = req.body;
    if (!startDate || !endDate || !Array.isArray(agents)) {
      res.status(400).json({ error: "startDate, endDate, and agents[] are required" });
      return;
    }

    const snapshot = await fetchPrices();
    const report = await generateEpochReport(
      { epochNumber, startDate, endDate, agents, totalCapital: totalCapital || 0, totalProfit: totalProfit || 0, initPriceStart: initPriceStart || 0, initPriceEnd: initPriceEnd || snapshot.prices.find(p => p.symbol.startsWith("INIT"))?.price || 0, marketSnapshot: snapshot },
      model,
    );
    res.json(report);
  } catch (error) {
    console.error("Epoch report error:", error);
    res.status(500).json({ error: "Failed to generate epoch report" });
  }
});

export default router;
