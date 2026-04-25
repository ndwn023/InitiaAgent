import { Router, Request, Response, NextFunction } from "express";
import {
  getDashboardState,
  getDashboardStateSnapshots,
  upsertDashboardState,
} from "../lib/dashboard-store";
import { subscribeDashboard } from "../lib/sse-bus";
import {
  dashboardQuerySchema,
  dashboardSnapshotsQuerySchema,
  parsePayload,
  upsertDashboardStateBodySchema,
} from "@initia-agent/shared";

const router = Router();

// ─── GET /api/dashboard-state/stream?ownerAddress=0x... ───────────────────────
// Server-Sent Events — pushes dashboard state to the client in real-time whenever
// `upsertDashboardState` is called (by the frontend or the agent worker).
router.get("/stream", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerAddress } = parsePayload(req.query, dashboardQuerySchema);

    // SSE headers — disable all buffering so bytes reach the client immediately.
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx/proxy buffering
    });
    res.flushHeaders();

    // Confirm connection.
    res.write(": connected\n\n");

    // Send current persisted state immediately so the client doesn't wait for
    // the first change event.
    getDashboardState(ownerAddress).then((state) => {
      if (state) {
        res.write(`data: ${JSON.stringify(state)}\n\n`);
      }
    }).catch(() => { /* ignore */ });

    const unsubscribe = subscribeDashboard(ownerAddress, res);

    // Heartbeat every 25s keeps the connection alive through idle proxies.
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/dashboard-state?ownerAddress=0x... ──────────────────────────────
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set("Cache-Control", "no-store");
    const { ownerAddress } = parsePayload(req.query, dashboardQuerySchema);
    const state = await getDashboardState(ownerAddress);
    res.json(state ?? null);
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/dashboard-state/snapshots?ownerAddress=0x...&limit=20 ───────────
router.get("/snapshots", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set("Cache-Control", "no-store");
    const { ownerAddress, limit } = parsePayload(
      req.query,
      dashboardSnapshotsQuerySchema,
    );
    const snapshots = await getDashboardStateSnapshots(ownerAddress, limit);
    res.json({ snapshots });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/dashboard-state ────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set("Cache-Control", "no-store");
    const body = parsePayload(req.body, upsertDashboardStateBodySchema);
    const saved = await upsertDashboardState(body);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

export default router;
