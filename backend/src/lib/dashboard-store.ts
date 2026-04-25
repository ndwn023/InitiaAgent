import crypto from "crypto";
import { ensureDatabase, sql } from "./db";
import { emitDashboardUpdate } from "./sse-bus";
import type {
  DashboardStateSnapshot,
  DashboardStateSource,
  PersistedDashboardState,
} from "@initia-agent/shared";

function normalizeRow(row: Record<string, unknown>): PersistedDashboardState {
  return {
    ownerAddress: String(row.owner_address),
    livePortfolio: Number(row.live_portfolio ?? 0),
    liveProfit: Number(row.live_profit ?? 0),
    executionCount: Number(row.execution_count ?? 0),
    remainingBalance: (row.remaining_balance as Record<string, number>) ?? {},
    costBasis: (row.cost_basis as Record<string, number>) ?? {},
    lastAnalysisAt: (row.last_analysis_at as Record<string, number>) ?? {},
    logs: Array.isArray(row.logs) ? (row.logs as unknown[]) : [],
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
  };
}

function normalizeSnapshotRow(row: Record<string, unknown>): DashboardStateSnapshot {
  return {
    id: Number(row.id ?? 0),
    ownerAddress: String(row.owner_address ?? ""),
    source: normalizeSource(row.source),
    payloadHash: String(row.payload_hash ?? ""),
    livePortfolio: Number(row.live_portfolio ?? 0),
    liveProfit: Number(row.live_profit ?? 0),
    executionCount: Number(row.execution_count ?? 0),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function normalizeSource(input: unknown): DashboardStateSource {
  if (input === "worker" || input === "frontend" || input === "api") {
    return input;
  }
  return "api";
}

export async function getDashboardState(ownerAddress: string): Promise<PersistedDashboardState | null> {
  await ensureDatabase();
  const rows = await sql!`
    SELECT * FROM dashboard_state WHERE owner_address = ${ownerAddress.toLowerCase()} LIMIT 1
  `;
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function getDashboardStateSnapshots(
  ownerAddress: string,
  limit = 20,
): Promise<DashboardStateSnapshot[]> {
  const normalizedOwner = ownerAddress.toLowerCase();
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  await ensureDatabase();
  const rows = await sql!`
    SELECT *
    FROM dashboard_state_snapshots
    WHERE owner_address = ${normalizedOwner}
    ORDER BY created_at DESC
    LIMIT ${normalizedLimit}
  `;
  return rows.map((row) => normalizeSnapshotRow(row as Record<string, unknown>));
}

/**
 * Batch fetch dashboard states for multiple owners — eliminates N+1 queries
 * from the agent worker tick loop.
 */
export async function batchGetDashboardStates(ownerAddresses: string[]): Promise<Map<string, PersistedDashboardState>> {
  const result = new Map<string, PersistedDashboardState>();
  if (ownerAddresses.length === 0) return result;

  await ensureDatabase();
  const normalized = ownerAddresses.map(a => a.toLowerCase());
  const rows = await sql!`
    SELECT * FROM dashboard_state WHERE owner_address = ANY(${normalized})
  `;

  for (const row of rows) {
    const state = normalizeRow(row as Record<string, unknown>);
    result.set(state.ownerAddress, state);
  }
  return result;
}

const MAX_LOG_ENTRIES = 50;
const ZERO_EPSILON = 1e-9;

function hasObjectEntries(obj: Record<string, number>): boolean {
  return Object.keys(obj).length > 0;
}

function isZeroLike(value: number): boolean {
  return Math.abs(value) < ZERO_EPSILON;
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStableValue);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, toStableValue(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(toStableValue(value));
}

function buildSnapshotPayload(state: PersistedDashboardState): Omit<PersistedDashboardState, "updatedAt" | "source"> {
  return {
    ownerAddress: state.ownerAddress,
    livePortfolio: state.livePortfolio,
    liveProfit: state.liveProfit,
    executionCount: state.executionCount,
    remainingBalance: state.remainingBalance,
    costBasis: state.costBasis,
    lastAnalysisAt: state.lastAnalysisAt,
    logs: state.logs,
  };
}

function hashSnapshotPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

async function insertDashboardSnapshot(state: PersistedDashboardState, source: DashboardStateSource): Promise<void> {
  const snapshotPayload = buildSnapshotPayload(state);
  const payloadHash = hashSnapshotPayload(snapshotPayload);

  await sql!`
    INSERT INTO dashboard_state_snapshots (
      owner_address,
      source,
      payload_hash,
      live_portfolio,
      live_profit,
      execution_count,
      state_payload
    ) VALUES (
      ${state.ownerAddress},
      ${source},
      ${payloadHash},
      ${state.livePortfolio},
      ${state.liveProfit},
      ${state.executionCount},
      ${JSON.stringify(snapshotPayload)}
    )
    ON CONFLICT (owner_address, payload_hash) DO NOTHING
  `;
}

export async function upsertDashboardState(state: PersistedDashboardState): Promise<PersistedDashboardState> {
  const normalized = state.ownerAddress.toLowerCase();
  const source = normalizeSource(state.source);
  const rawLogs = Array.isArray(state.logs) ? state.logs : [];
  let next: PersistedDashboardState = {
    ...state,
    ownerAddress: normalized,
    source,
    livePortfolio: Number(state.livePortfolio || 0),
    liveProfit: Number(state.liveProfit || 0),
    executionCount: Number(state.executionCount || 0),
    remainingBalance: state.remainingBalance ?? {},
    costBasis: state.costBasis ?? {},
    lastAnalysisAt: state.lastAnalysisAt ?? {},
    logs: rawLogs.slice(0, MAX_LOG_ENTRIES),
  };

  await ensureDatabase();
  const existingRows = await sql!`
    SELECT * FROM dashboard_state WHERE owner_address = ${normalized} LIMIT 1
  `;
  const existing = existingRows[0] ? normalizeRow(existingRows[0] as Record<string, unknown>) : null;

  if (existing) {
    const incomingLooksReset =
      next.executionCount === 0 &&
      !hasObjectEntries(next.remainingBalance) &&
      !hasObjectEntries(next.costBasis) &&
      !hasObjectEntries(next.lastAnalysisAt) &&
      next.logs.length === 0 &&
      isZeroLike(next.livePortfolio) &&
      isZeroLike(next.liveProfit);

    const existingHasProgress =
      existing.executionCount > 0 ||
      hasObjectEntries(existing.remainingBalance) ||
      hasObjectEntries(existing.costBasis) ||
      hasObjectEntries(existing.lastAnalysisAt) ||
      existing.logs.length > 0 ||
      !isZeroLike(existing.livePortfolio) ||
      !isZeroLike(existing.liveProfit);

    if (incomingLooksReset && existingHasProgress) {
      return existing;
    }

    if (!hasObjectEntries(next.remainingBalance) && hasObjectEntries(existing.remainingBalance)) {
      next = { ...next, remainingBalance: existing.remainingBalance };
    }
    if (!hasObjectEntries(next.costBasis) && hasObjectEntries(existing.costBasis)) {
      next = { ...next, costBasis: existing.costBasis };
    }
    if (!hasObjectEntries(next.lastAnalysisAt) && hasObjectEntries(existing.lastAnalysisAt)) {
      next = { ...next, lastAnalysisAt: existing.lastAnalysisAt };
    }
    if (next.logs.length === 0 && existing.logs.length > 0) {
      next = { ...next, logs: existing.logs.slice(0, MAX_LOG_ENTRIES) };
    }
    if (next.executionCount === 0 && existing.executionCount > 0) {
      next = { ...next, executionCount: existing.executionCount };
    }
    if (isZeroLike(next.livePortfolio) && !isZeroLike(existing.livePortfolio)) {
      next = { ...next, livePortfolio: existing.livePortfolio };
    }
    if (isZeroLike(next.liveProfit) && !isZeroLike(existing.liveProfit)) {
      next = { ...next, liveProfit: existing.liveProfit };
    }
  }

  const rows = await sql!`
    INSERT INTO dashboard_state (
      owner_address, live_portfolio, live_profit, execution_count,
      remaining_balance, cost_basis, last_analysis_at, logs
    ) VALUES (
      ${normalized}, ${next.livePortfolio}, ${next.liveProfit}, ${next.executionCount},
      ${JSON.stringify(next.remainingBalance)}, ${JSON.stringify(next.costBasis)},
      ${JSON.stringify(next.lastAnalysisAt)}, ${JSON.stringify(next.logs)}
    )
    ON CONFLICT (owner_address) DO UPDATE SET
      live_portfolio = EXCLUDED.live_portfolio,
      live_profit = EXCLUDED.live_profit,
      execution_count = EXCLUDED.execution_count,
      remaining_balance = EXCLUDED.remaining_balance,
      cost_basis = EXCLUDED.cost_basis,
      last_analysis_at = EXCLUDED.last_analysis_at,
      logs = EXCLUDED.logs,
      updated_at = NOW()
    RETURNING *
  `;

  const saved = normalizeRow(rows[0]);
  await insertDashboardSnapshot(saved, source);

  // Notify all open SSE connections for this owner — zero-delay push
  emitDashboardUpdate(normalized, saved);

  return saved;
}
