import type { AgentsResponse, DeployedAgent } from "@initia-agent/shared";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const LOCAL_DEV_API_ORIGIN = "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 10_000;

function normalizeApiBase(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/api")) return trimmed.slice(0, -4);
  return trimmed;
}

const API_BASE = normalizeApiBase(RAW_API_BASE);

function buildAgentApiUrl(path = ""): string {
  const normalizedPath = path
    ? path.startsWith("/") ? path : `/${path}`
    : "";
  return `${API_BASE}/api/agents${normalizedPath}`;
}

function canUseLocalDevFallback(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return API_BASE.length === 0 && (host === "localhost" || host === "127.0.0.1");
}

async function fetchAgentApi(
  path: string,
  init: RequestInit,
  fallbackAllowed: boolean,
): Promise<Response> {
  try {
    return await fetch(buildAgentApiUrl(path), init);
  } catch (error) {
    if (!fallbackAllowed || !canUseLocalDevFallback()) throw error;
    return await fetch(`${LOCAL_DEV_API_ORIGIN}/api/agents${path}`, init);
  }
}

export function parseAgentsResponse(payload: AgentsResponse | DeployedAgent[]): DeployedAgent[] {
  return Array.isArray(payload) ? payload : payload.agents ?? [];
}

export async function fetchAgentsList(options: {
  limit?: number;
  offset?: number;
  creator?: string;
  scope?: "all" | "marketplace";
  signal?: AbortSignal;
} = {}): Promise<DeployedAgent[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 300));
  if ((options.offset ?? 0) > 0) params.set("offset", String(options.offset));
  if (options.creator) params.set("creator", options.creator);
  if (options.scope === "marketplace") params.set("scope", "marketplace");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = options.signal;

  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  }

  const queryPath = `?${params.toString()}`;
  const res = await (async () => {
    try {
      return await fetchAgentApi(
        queryPath,
        { signal: controller.signal },
        true,
      );
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  })();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const payload = await res.json() as AgentsResponse | DeployedAgent[];
  return parseAgentsResponse(payload);
}

export async function createAgent(payload: Omit<DeployedAgent, "id"> & { id?: string }): Promise<DeployedAgent> {
  const res = await fetchAgentApi("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, false);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json() as DeployedAgent;
}

export async function deleteAgentById(id: string, contractAddress?: string): Promise<void> {
  const res = await fetchAgentApi(`/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractAddress }),
  }, false);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
