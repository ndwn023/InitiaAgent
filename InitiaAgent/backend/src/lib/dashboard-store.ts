import { promises as fs } from "fs";
import path from "path";
import { ensureDatabase, hasDatabase, sql } from "./db";

export interface PersistedDashboardState {
  ownerAddress: string;
  livePortfolio: number;
  liveProfit: number;
  executionCount: number;
  remainingBalance: Record<string, number>;
  costBasis: Record<string, number>;
  lastAnalysisAt: Record<string, number>;
  logs: unknown[];
  updatedAt?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DASHBOARD_STATE_FILE = path.join(DATA_DIR, "dashboard-state.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStateFile(): Promise<Record<string, PersistedDashboardState>> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(DASHBOARD_STATE_FILE, "utf-8");
    return JSON.parse(data) as Record<string, PersistedDashboardState>;
  } catch {
    return {};
  }
}

async function writeStateFile(state: Record<string, PersistedDashboardState>) {
  await ensureDataDir();
  await fs.writeFile(DASHBOARD_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

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

export async function getDashboardState(ownerAddress: string): Promise<PersistedDashboardState | null> {
  const normalized = ownerAddress.toLowerCase();

  if (!hasDatabase || !sql) {
    const file = await readStateFile();
    return file[normalized] ?? null;
  }

  await ensureDatabase();
  const rows = await sql`
    SELECT * FROM dashboard_state WHERE owner_address = ${normalized} LIMIT 1
  `;
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function upsertDashboardState(state: PersistedDashboardState): Promise<PersistedDashboardState> {
  const normalized = state.ownerAddress.toLowerCase();
  const next: PersistedDashboardState = {
    ...state,
    ownerAddress: normalized,
    livePortfolio: Number(state.livePortfolio || 0),
    liveProfit: Number(state.liveProfit || 0),
    executionCount: Number(state.executionCount || 0),
    remainingBalance: state.remainingBalance ?? {},
    costBasis: state.costBasis ?? {},
    lastAnalysisAt: state.lastAnalysisAt ?? {},
    logs: Array.isArray(state.logs) ? state.logs : [],
  };

  if (!hasDatabase || !sql) {
    const file = await readStateFile();
    file[normalized] = next;
    await writeStateFile(file);
    return next;
  }

  await ensureDatabase();
  const rows = await sql`
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

  return normalizeRow(rows[0]);
}
