import { Router, Request, Response, NextFunction } from "express";
import { fetchPrices } from "../lib/price-feed";
import { lpFeeBodySchema, parsePayload } from "@initia-agent/shared";

const router = Router();

// POST /api/agent/lp-fee
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pools, capital, cycleSeconds } = parsePayload(req.body, lpFeeBodySchema);

    const snapshot = await fetchPrices();

    const getPrice = (sym: string): number => {
      if (sym === "USDC") return 1.0;
      const found = snapshot.prices.find(p => p.symbol.startsWith(`${sym}/`));
      return found?.price ?? 0;
    };

    const initPrice = getPrice("INIT") || 0.08;
    const userCapitalUsd = capital * initPrice;
    const LP_FEE_RATE = 0.003;
    const TVL_MARKET_CAP_RATIO = 0.005;
    const MAX_LP_SHARE = 0.01;

    let totalFeeUsd = 0;
    const breakdown: { pool: string; feeUsd: number; feeInit: number; volume24h: number; apr: number }[] = [];

    for (const pool of pools) {
      const [tokenA] = pool.split("/");
      const tokenData = snapshot.prices.find(p => p.symbol.startsWith(`${tokenA}/`));

      if (!tokenData?.volume24h || !tokenData.marketCap) {
        breakdown.push({ pool, feeUsd: 0, feeInit: 0, volume24h: 0, apr: 0 });
        continue;
      }

      const volume24h = tokenData.volume24h;
      const poolTvl = tokenData.marketCap * TVL_MARKET_CAP_RATIO;
      const lpShare = Math.min(userCapitalUsd / poolTvl, MAX_LP_SHARE);
      const feeUsd = volume24h * LP_FEE_RATE * (cycleSeconds / 86400) * lpShare;
      const feeInit = feeUsd / initPrice;
      const apr = poolTvl > 0 ? (volume24h * LP_FEE_RATE * 365) / poolTvl * 100 : 0;

      totalFeeUsd += feeUsd;
      breakdown.push({
        pool,
        feeUsd: Math.round(feeUsd * 1e6) / 1e6,
        feeInit: Math.round(feeInit * 1e6) / 1e6,
        volume24h,
        apr: Math.round(apr * 100) / 100,
      });
    }

    const totalFeeInit = totalFeeUsd / initPrice;

    res.json({
      totalFeeUsd: Math.round(totalFeeUsd * 1e6) / 1e6,
      totalFeeInit: Math.round(totalFeeInit * 1e6) / 1e6,
      initPrice,
      breakdown,
      source: snapshot.source,
      cycleSeconds,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
