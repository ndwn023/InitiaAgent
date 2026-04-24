import { Router, Request, Response } from "express";
import { getDashboardState, upsertDashboardState } from "../lib/dashboard-store";

const router = Router();

// GET /api/dashboard-state?ownerAddress=0x...
router.get("/", async (req: Request, res: Response) => {
  try {
    const ownerAddress = (req.query.ownerAddress as string)?.toLowerCase();
    if (!ownerAddress) {
      res.status(400).json({ error: "ownerAddress is required" });
      return;
    }

    const state = await getDashboardState(ownerAddress);
    res.json(state ?? null);
  } catch (error) {
    console.error("Failed to load dashboard state:", error);
    res.status(500).json({ error: "Failed to load dashboard state" });
  }
});

// POST /api/dashboard-state
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const ownerAddress = body.ownerAddress?.toLowerCase();

    if (!ownerAddress) {
      res.status(400).json({ error: "ownerAddress is required" });
      return;
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

    res.json(saved);
  } catch (error) {
    console.error("Failed to save dashboard state:", error);
    res.status(500).json({ error: "Failed to save dashboard state" });
  }
});

export default router;
