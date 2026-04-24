import { NextRequest, NextResponse } from "next/server";
import { fetchPrices } from "@/lib/price-feed";

/**
 * Real-world LP fee calculation based on live CoinGecko volume data.
 *
 * Formula:
 *   feeUsd = volume24h × feeRate × (cycleSeconds / 86400) × lpShare
 *   lpShare = userCapitalUsd / poolTvl   (capped at 1%)
 *   poolTvl = tokenMarketCap × 0.005     (conservative 0.5% of market cap)
 *
 * Fee rate: 0.3% — standard AMM (Uniswap v2 / InitiaDEX style)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pools, capital, cycleSeconds = 15 } = body as {
      pools: string[];       // e.g. ["INIT/USDC"]
      capital: number;       // user capital in INIT
      cycleSeconds?: number; // AI cycle duration
    };

    if (!pools?.length || !capital) {
      return NextResponse.json({ error: "pools and capital required" }, { status: 400 });
    }

    const snapshot = await fetchPrices();

    const getPrice = (sym: string): number => {
      if (sym === "USDC") return 1.0;
      const found = snapshot.prices.find(p => p.symbol.startsWith(`${sym}/`));
      return found?.price ?? 0;
    };

    const initPrice = getPrice("INIT") || 0.08;
    const userCapitalUsd = capital * initPrice;
    const LP_FEE_RATE = 0.003; // 0.3% — standard AMM fee tier
    const TVL_MARKET_CAP_RATIO = 0.005; // assume pool TVL ≈ 0.5% of token market cap
    const MAX_LP_SHARE = 0.01; // cap at 1% of pool to stay realistic

    let totalFeeUsd = 0;
    const breakdown: { pool: string; feeUsd: number; feeInit: number; volume24h: number; apr: number }[] = [];

    for (const pool of pools) {
      const [tokenA] = pool.split("/");
      const tokenData = snapshot.prices.find(p => p.symbol.startsWith(`${tokenA}/`));

      if (!tokenData?.volume24h || !tokenData.marketCap) {
        // No volume data for this pair — skip (no fake fallback)
        breakdown.push({ pool, feeUsd: 0, feeInit: 0, volume24h: 0, apr: 0 });
        continue;
      }

      const volume24h = tokenData.volume24h;
      const poolTvl = tokenData.marketCap * TVL_MARKET_CAP_RATIO;
      const lpShare = Math.min(userCapitalUsd / poolTvl, MAX_LP_SHARE);

      // Fee for this cycle
      const feeUsd = volume24h * LP_FEE_RATE * (cycleSeconds / 86400) * lpShare;
      const feeInit = feeUsd / initPrice;
      // Annualised APR for display
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

    return NextResponse.json({
      totalFeeUsd: Math.round(totalFeeUsd * 1e6) / 1e6,
      totalFeeInit: Math.round(totalFeeInit * 1e6) / 1e6,
      initPrice,
      breakdown,
      source: snapshot.source,
      cycleSeconds,
    });
  } catch (error) {
    console.error("LP fee calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate LP fee" }, { status: 500 });
  }
}
