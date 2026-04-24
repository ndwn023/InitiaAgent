import { Router, Request, Response } from "express";
import { getAllAgents, addAgent, removeAgent, updateAgent, markSubscriptionsClosed, StoredAgent } from "../lib/agent-store";

const router = Router();

// GET /api/agents — list all agents (marketplace)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const agents = await getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error("Failed to get agents:", error);
    res.status(500).json({ error: "Failed to get agents" });
  }
});

// POST /api/agents — create new agent
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;

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
    };

    if (!agent.name || !agent.strategy) {
      res.status(400).json({ error: "Name and strategy are required" });
      return;
    }

    const created = await addAgent(agent);
    res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// DELETE /api/agents/:id — remove agent + close subscriptions
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    if (body.contractAddress) {
      await markSubscriptionsClosed(body.contractAddress);
    }

    const removed = await removeAgent(id);
    if (!removed) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

// PATCH /api/agents/:id — update agent fields
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const updated = await updateAgent(id, patch);
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Failed to update agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

export default router;
