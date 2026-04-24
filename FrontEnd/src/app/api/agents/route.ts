import { NextRequest, NextResponse } from "next/server";
import { getAllAgents, addAgent, StoredAgent } from "@/lib/agent-store";

// GET /api/agents — List all agents (for marketplace)
export async function GET() {
  try {
    const agents = await getAllAgents();
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Failed to get agents:", error);
    return NextResponse.json({ error: "Failed to get agents" }, { status: 500 });
  }
}

// POST /api/agents — Create a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const agent: StoredAgent = {
      id: body.id || Math.random().toString(36).substring(2, 11),
      name: body.name,
      strategy: body.strategy,
      target: body.target,
      pool: body.pool,
      protocol: body.protocol,
      vault: body.vault,
      status: "Active",
      deployedAt: body.deployedAt || new Date().toISOString(),
      txHash: body.txHash || "",
      contractAddress: body.contractAddress || "",
      initialCapital: body.initialCapital || 0,
      creatorAddress: body.creatorAddress || "",
      interval: body.interval || "1 Hour",
      isSubscription: body.isSubscription ?? false,
      agentClosed: body.agentClosed ?? false,
      takeProfitPct: body.takeProfitPct,
      stopLossPct: body.stopLossPct,
      minConfidence: body.minConfidence,
      tradeSizePct: body.tradeSizePct,
      onChainAgentId: body.onChainAgentId,
      roi: body.roi != null ? Number(body.roi) : undefined,
      winRate: body.winRate != null ? Number(body.winRate) : undefined,
      totalTrades: body.totalTrades != null ? Number(body.totalTrades) : undefined,
      isDemo: body.isDemo ?? false,
    };

    if (!agent.name || !agent.strategy) {
      return NextResponse.json(
        { error: "Name and strategy are required" },
        { status: 400 }
      );
    }

    const created = await addAgent(agent);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
