import { NextRequest, NextResponse } from "next/server";
import { getDashboardState, upsertDashboardState } from "@/lib/dashboard-store";

export async function GET(req: NextRequest) {
  try {
    const ownerAddress = req.nextUrl.searchParams.get("ownerAddress")?.toLowerCase();
    if (!ownerAddress) {
      return NextResponse.json({ error: "ownerAddress is required" }, { status: 400 });
    }

    const state = await getDashboardState(ownerAddress);
    return NextResponse.json(state ?? null);
  } catch (error) {
    console.error("Failed to load dashboard state:", error);
    return NextResponse.json({ error: "Failed to load dashboard state" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ownerAddress = body.ownerAddress?.toLowerCase();

    if (!ownerAddress) {
      return NextResponse.json({ error: "ownerAddress is required" }, { status: 400 });
    }

    const saved = await upsertDashboardState({
      ownerAddress,
      livePortfolio: Number(body.livePortfolio || 0),
      liveProfit: Number(body.liveProfit || 0),
      executionCount: Number(body.executionCount || 0),
      remainingBalance: body.remainingBalance ?? {},
      costBasis: body.costBasis ?? {},
      lastAnalysisAt: body.lastAnalysisAt ?? {},
      logs: Array.isArray(body.logs) ? body.logs.slice(0, 20) : [],
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save dashboard state:", error);
    return NextResponse.json({ error: "Failed to save dashboard state" }, { status: 500 });
  }
}
