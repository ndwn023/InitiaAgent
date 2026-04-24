import { NextRequest, NextResponse } from "next/server";
import { analyzeMarketRules } from "@/lib/market-analyzer";
import { fetchPrices } from "@/lib/price-feed";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { strategy, targetToken, pool, protocol, vault, capital, interval } = body;

    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy is required" },
        { status: 400 }
      );
    }

    // Fetch real-time prices
    const marketSnapshot = await fetchPrices();

    // Rule-based analysis — instant, no LLM tokens needed
    const analysis = analyzeMarketRules(strategy, {
      targetToken,
      pool,
      protocol,
      vault,
      capital,
      interval,
    }, marketSnapshot);

    // Attach price data to the response
    return NextResponse.json({
      ...analysis,
      marketPrices: marketSnapshot.prices,
      priceTimestamp: marketSnapshot.timestamp,
    });
  } catch (error) {
    console.error("Agent analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze market" },
      { status: 500 }
    );
  }
}
