import { Router, Request, Response, NextFunction } from "express";
import { analyzeMarketRules } from "../lib/market-analyzer";
import { analyzeMarketAI } from "../lib/ai-agent";
import { fetchPrices, formatMarketContext } from "../lib/price-feed";
import { getRecentSignals, computeStats } from "../lib/signal-history";
import {
  analyzeBodySchema,
  analyzeQuerySchema,
  parsePayload,
} from "@initia-agent/shared";

const router = Router();

const STABLECOINS = new Set(["USDC", "USDT", "DAI"]);

// GET /api/agent/analyze/market
// Lightweight market snapshot endpoint for frequent UI polling.
router.get("/market", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const marketSnapshot = await fetchPrices();
    const initPrice = marketSnapshot.prices.find((p) => p.symbol.startsWith("INIT"))?.price ?? 0;
    res.set("Cache-Control", "public, max-age=5, stale-while-revalidate=20");
    res.json({
      marketPrices: marketSnapshot.prices,
      marketRegime: marketSnapshot.regime,
      currentPrice: initPrice,
      priceTimestamp: marketSnapshot.timestamp,
      source: marketSnapshot.source,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/analyze?mode=rules|ai
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parsePayload(req.body, analyzeBodySchema);
    const { mode } = parsePayload(req.query, analyzeQuerySchema);

    const marketSnapshot = await fetchPrices();
    const initPrice = marketSnapshot.prices.find((p) => p.symbol.startsWith("INIT"))?.price ?? 0;

    const token = (body.targetToken ?? "INIT").toUpperCase();
    const normalizedToken = STABLECOINS.has(token) ? "INIT" : token;

    const baseResponse = {
      marketPrices: marketSnapshot.prices,
      marketRegime: marketSnapshot.regime,
      currentPrice: initPrice,
      priceTimestamp: marketSnapshot.timestamp,
    };

    if (mode === "ai") {
      const marketData = formatMarketContext(marketSnapshot);
      const analysis = await analyzeMarketAI(
        body.strategy,
        {
          targetToken: normalizedToken,
          capital: body.capital,
          interval: body.interval,
          marketData,
        },
        body.model,
      );
      const statsToken = analysis.token || normalizedToken;
      res.json({
        ...analysis,
        ...baseResponse,
        engine: "ai",
        signalHistory: getRecentSignals(statsToken, body.strategy, 5),
        signalStats: computeStats(statsToken, body.strategy),
      });
      return;
    }

    // Default: deterministic rule-based (fast, no API key needed)
    const analysis = analyzeMarketRules(
      body.strategy,
      {
        targetToken: normalizedToken,
        pool: body.pool,
        protocol: body.protocol,
        vault: body.vault,
        capital: body.capital,
        interval: body.interval,
      },
      marketSnapshot,
    );
    const statsToken = analysis.token || normalizedToken;
    res.json({
      ...analysis,
      ...baseResponse,
      engine: "rules",
      signalHistory: getRecentSignals(statsToken, body.strategy, 5),
      signalStats: computeStats(statsToken, body.strategy),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
