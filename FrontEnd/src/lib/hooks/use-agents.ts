"use client";

import { useState, useEffect, useCallback } from "react";

export interface DeployedAgent {
  id: string;
  name: string;
  strategy: string;
  target?: string;
  pool?: string;
  protocol?: string;
  vault?: string;
  status: "Active" | "Paused";
  deployedAt: string;
  txHash: string;
  contractAddress: string;
  initialCapital: number;
  creatorAddress?: string;
  interval?: string;
  isSubscription?: boolean;
  agentClosed?: boolean;
  roi?: number;
  winRate?: number;
  totalTrades?: number;
  isDemo?: boolean;
  takeProfitPct?: number;
  stopLossPct?: number;
  minConfidence?: number;
  tradeSizePct?: number;
  onChainAgentId?: string; // uint256 from AgentRegistry.registerAgent()
}

export function useAgents() {
  const [allAgents, setAllAgents] = useState<DeployedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all agents from server
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const agents = await res.json();
        setAllAgents(agents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const addAgent = async (agent: Omit<DeployedAgent, "id"> & { id?: string }) => {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });

      if (res.ok) {
        const created = await res.json();
        setAllAgents((prev) => [created, ...prev]);
        return created;
      }
    } catch (error) {
      console.error("Failed to add agent:", error);
    }
    return null;
  };

  const removeAgent = async (id: string, contractAddress?: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress }),
      });

      if (res.ok) {
        // Remove creator entry and mark subscription entries as closed locally
        setAllAgents((prev) => prev
          .filter((a) => a.id !== id)
          .map((a) =>
            contractAddress && a.contractAddress === contractAddress && a.isSubscription
              ? { ...a, agentClosed: true, status: "Paused" as const }
              : a
          )
        );
        return true;
      }
    } catch (error) {
      console.error("Failed to remove agent:", error);
    }
    return false;
  };

  // For backward compatibility: myAgents = allAgents (all are visible to everyone)
  return { myAgents: allAgents, allAgents, addAgent, removeAgent, isLoading, refetch: fetchAgents };
}
