import { Router, Request, Response, NextFunction } from "express";
import {
  getAllAgents,
  addAgent,
  removeAgent,
  updateAgent,
  markSubscriptionsClosed,
  StoredAgent,
} from "../lib/agent-store";
import {
  DEFAULT_AGENT_INTERVAL,
  createAgentBodySchema,
  deleteAgentBodySchema,
  listAgentsQuerySchema,
  parsePayload,
  patchAgentBodySchema,
} from "@initia-agent/shared";

const router = Router();

// ─── GET /api/agents ──────────────────────────────────────────────────────────
// Query: ?limit=50&offset=0&creator=0x...&scope=marketplace
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, creator, scope } = parsePayload(
      req.query,
      listAgentsQuerySchema,
    );

    const agents = await getAllAgents({
      limit,
      offset,
      creatorAddress: creator,
      marketplaceOnly: scope === "marketplace",
    });

    res.set("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
    res.json({ agents, total: agents.length, limit, offset });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/agents ─────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parsePayload(req.body, createAgentBodySchema);

    const agent: StoredAgent = {
      id:              body.id ?? Math.random().toString(36).substring(2, 11),
      name:            body.name,
      strategy:        body.strategy,
      target:          body.target,
      pool:            body.pool,
      protocol:        body.protocol,
      vault:           body.vault,
      status:          body.status ?? "Active",
      deployedAt:      body.deployedAt ?? new Date().toISOString(),
      txHash:          body.txHash,
      contractAddress: body.contractAddress,
      initialCapital:  body.initialCapital,
      creatorAddress:  body.creatorAddress,
      interval:        body.interval ?? DEFAULT_AGENT_INTERVAL,
      isSubscription:  body.isSubscription,
      agentClosed:     body.agentClosed,
      takeProfitPct:   body.takeProfitPct,
      stopLossPct:     body.stopLossPct,
      minConfidence:   body.minConfidence,
      tradeSizePct:    body.tradeSizePct,
      onChainAgentId:  body.onChainAgentId,
    };

    const created = await addAgent(agent);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/agents/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { contractAddress } = parsePayload(req.body ?? {}, deleteAgentBodySchema);

    if (contractAddress) {
      await markSubscriptionsClosed(contractAddress);
    }

    const removed = await removeAgent(id);
    if (!removed) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /api/agents/:id ────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const patch = parsePayload(req.body, patchAgentBodySchema);

    const updated = await updateAgent(id, patch as Partial<StoredAgent>);
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
