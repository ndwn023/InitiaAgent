import { Router, Request, Response } from "express";
import { analyzeMarketRules } from "../lib/market-analyzer";
import { analyzeMarketAI } from "../lib/ai-agent";
import { fetchPrices, formatMarketContext } from "../lib/price-feed";

const router = Router();

// POST /api/agent/analyze
// ?mode=rules (default) | ai   — choose analysis engine
router.post("/", async (req: Request, res: Response) => {
  try {
    const { strategy, targetToken, pool, protocol, vault, capital, interval, model } = req.body;
    const mode = (req.query.mode as string) || "rules";

    if (!strategy) {
      res.status(400).json({ error: "Strategy is required" });
      return;
    }

    const marketSnapshot = await fetchPrices();

    if (mode === "ai") {
      const marketData = formatMarketContext(marketSnapshot);
      const analysis = await analyzeMarketAI(strategy, { targetToken, capital, interval, marketData }, model);
      res.json({ ...analysis, marketPrices: marketSnapshot.prices, priceTimestamp: marketSnapshot.timestamp, engine: "ai" });
      return;
    }

    // Default: deterministic rule-based (fast, no API key needed)
    const analysis = analyzeMarketRules(strategy, { targetToken, pool, protocol, vault, capital, interval }, marketSnapshot);
    res.json({ ...analysis, marketPrices: marketSnapshot.prices, priceTimestamp: marketSnapshot.timestamp, engine: "rules" });
  } catch (error) {
    console.error("Agent analyze error:", error);
    res.status(500).json({ error: "Failed to analyze market" });
  }
});

export default router;
