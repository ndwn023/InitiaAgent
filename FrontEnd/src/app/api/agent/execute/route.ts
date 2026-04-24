import { NextRequest, NextResponse } from "next/server";
import { fetchPrices } from "@/lib/price-feed";

/**
 * Auto-execute endpoint for AI-driven trades.
 * Supports the available mock pair: INIT↔USDC.
 * Uses real market prices for conversion.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, signal, confidence, tradeAmount, fromToken, toToken, strategy } = body;

    if (!signal || !confidence) {
      return NextResponse.json(
        { error: "Signal and confidence are required" },
        { status: 400 }
      );
    }

    // Fetch current prices
    const marketSnapshot = await fetchPrices();

    // Get USD prices for both tokens
    const getUsdPrice = (token: string): number => {
      if (token === "USDC") return 1.0;
      const found = marketSnapshot.prices.find(p => p.symbol.startsWith(token));
      return found?.price || 0.08;
    };

    const fromPrice = getUsdPrice(fromToken || "INIT");
    const toPrice = getUsdPrice(toToken || "USDC");
    const initPrice = getUsdPrice("INIT");

    const slippageBps = confidence >= 80 ? 50 : 150;
    const slippage = 1 - slippageBps / 10000;

    // Convert: fromAmount * fromPriceUSD / toPriceUSD * slippage
    const estimatedOutput = Math.round((tradeAmount * fromPrice / toPrice) * slippage * 100) / 100;

    console.log(`[AutoExecute] ${signal} ${tradeAmount.toFixed(2)} ${fromToken} → ${estimatedOutput.toFixed(2)} ${toToken} | ${fromToken}=$${fromPrice} ${toToken}=$${toPrice} | ${confidence}% | Agent: ${agentId}`);

    await new Promise(r => setTimeout(r, 300));

    return NextResponse.json({
      success: true,
      signal,
      confidence,
      tradeAmount,
      tokenIn: fromToken,
      tokenOut: toToken,
      estimatedOutput,
      slippageBps,
      strategy,
      currentPrice: initPrice,
      fromPrice,
      toPrice,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Agent execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute trade" },
      { status: 500 }
    );
  }
}
