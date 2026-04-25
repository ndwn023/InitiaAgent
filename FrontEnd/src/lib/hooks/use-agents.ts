"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import type { DeployedAgent } from "@initia-agent/shared";
import { createAgent, deleteAgentById, fetchAgentsList } from "@/lib/agents/api";
const POLL_MS      = 30_000;   // normal poll interval
const MAX_BACKOFF  = 120_000;  // cap backoff at 2 minutes

function areAgentListsEquivalent(prev: DeployedAgent[], next: DeployedAgent[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.strategy !== b.strategy ||
      a.status !== b.status ||
      a.agentClosed !== b.agentClosed ||
      a.initialCapital !== b.initialCapital ||
      a.txHash !== b.txHash ||
      a.contractAddress !== b.contractAddress ||
      a.deployedAt !== b.deployedAt
    ) {
      return false;
    }
  }
  return true;
}

export interface UseAgentsOptions {
  limit?: number;
  scope?: "all" | "marketplace";
}

export function useAgents(options: UseAgentsOptions = {}) {
  const limit = options.limit ?? 300;
  const scope = options.scope ?? "all";
  const { address } = useInterwovenKit();
  const [allAgents, setAllAgents] = useState<DeployedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef        = useRef<AbortController | null>(null);
  const isFetchingRef   = useRef(false);   // dedup guard: skip if already in-flight
  const backoffRef      = useRef(POLL_MS); // current poll interval (grows on error)
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch all agents from server with abort + dedup support
  const fetchAgents = useCallback(async () => {
    // Skip if a request is already in-flight (prevents double-fetch on tab focus)
    if (isFetchingRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current  = controller;
    isFetchingRef.current = true;

    try {
      const agents = await fetchAgentsList({
        limit,
        scope,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setAllAgents((prev) => (areAgentListsEquivalent(prev, agents) ? prev : agents));
      backoffRef.current = POLL_MS; // reset backoff on success
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      console.error("Failed to fetch agents:", error);

      // Exponential backoff: double the interval, up to MAX_BACKOFF
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [limit, scope]);

  // Re-schedule the polling interval using the current (possibly backed-off) delay
  const schedulePolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (document.visibilityState === "hidden") return;
    intervalRef.current = setInterval(() => {
      void fetchAgents();
    }, backoffRef.current);
  }, [fetchAgents]);

  // Load on mount + auto-refresh (paused in background tabs)
  useEffect(() => {
    // Async fetch — setState happens inside the promise resolution, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAgents();
    schedulePolling();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchAgents();
      }
      schedulePolling();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [fetchAgents, schedulePolling]);

  const addAgent = async (agent: Omit<DeployedAgent, "id"> & { id?: string }) => {
    try {
      const created = await createAgent(agent);
      setAllAgents((prev) => [created, ...prev]);
      return created;
    } catch (error) {
      console.error("Failed to add agent:", error);
    }
    return null;
  };

  const removeAgent = async (id: string, contractAddress?: string) => {
    try {
      await deleteAgentById(id, contractAddress);
      setAllAgents((prev) => prev
        .filter((a) => a.id !== id)
        .map((a) =>
          contractAddress && a.contractAddress === contractAddress && a.isSubscription
            ? { ...a, agentClosed: true, status: "Paused" as const }
            : a
        )
      );
      return true;
    } catch (error) {
      console.error("Failed to remove agent:", error);
    }
    return false;
  };

  // `myAgents` = agents where the CONNECTED wallet is the recorded owner.
  // For created agents `creatorAddress` is the user who deployed; for
  // subscriptions it's the subscriber (we reuse the field — see dashboard
  // subscribe flow). Seeded demo agents use reserved demo creator addresses
  // that never match a real wallet, so they're filtered out here.
  // When no wallet is connected, `myAgents` is empty by design.
  const myAgents = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return allAgents.filter(
      (a) => a.creatorAddress && a.creatorAddress.toLowerCase() === me,
    );
  }, [allAgents, address]);

  return { myAgents, allAgents, addAgent, removeAgent, isLoading, refetch: fetchAgents };
}

export type { DeployedAgent };
