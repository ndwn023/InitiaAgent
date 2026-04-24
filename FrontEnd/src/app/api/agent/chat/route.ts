import { NextRequest, NextResponse } from "next/server";
import { chatWithAgent, ChatMessage } from "@/lib/ai-agent";
import { fetchPrices, formatMarketContext } from "@/lib/price-feed";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, agentContext, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Fetch live prices for chat context
    const marketSnapshot = await fetchPrices();
    const marketContext = formatMarketContext(marketSnapshot);

    const response = await chatWithAgent(
      messages as ChatMessage[],
      {
        ...agentContext,
        marketData: marketContext,
        model: model || undefined,
      }
    );

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Agent chat error:", error);
    return NextResponse.json(
      { error: "Failed to get chat response" },
      { status: 500 }
    );
  }
}
