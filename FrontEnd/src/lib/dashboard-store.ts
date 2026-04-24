import { promises as fs } from "fs";
import path from "path";
import { ensureDatabase, hasDatabase, sql } from "@/lib/neon";

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
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
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
  const normalizedOwner = ownerAddress.toLowerCase();

  if (!hasDatabase || !sql) {
    const fileState = await readStateFile();
    return fileState[normalizedOwner] ?? null;
  }

  await ensureDatabase();
  const rows = await sql`
    SELECT *
    FROM dashboard_state
    WHERE owner_address = ${normalizedOwner}
    LIMIT 1
  `;

  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function upsertDashboardState(
  state: PersistedDashboardState
): Promise<PersistedDashboardState> {
  const normalizedOwner = state.ownerAddress.toLowerCase();
  const nextState: PersistedDashboardState = {
    ...state,
    ownerAddress: normalizedOwner,
    livePortfolio: Number(state.livePortfolio || 0),
    liveProfit: Number(state.liveProfit || 0),
    executionCount: Number(state.executionCount || 0),
    remainingBalance: state.remainingBalance ?? {},
    costBasis: state.costBasis ?? {},
    lastAnalysisAt: state.lastAnalysisAt ?? {},
    logs: Array.isArray(state.logs) ? state.logs : [],
  };

  if (!hasDatabase || !sql) {
    const fileState = await readStateFile();
    fileState[normalizedOwner] = nextState;
    await writeStateFile(fileState);
    return nextState;
  }

  await ensureDatabase();
  const rows = await sql`
    INSERT INTO dashboard_state (
      owner_address,
      live_portfolio,
      live_profit,
      execution_count,
      remaining_balance,
      cost_basis,
      last_analysis_at,
      logs
    ) VALUES (
      ${normalizedOwner},
      ${nextState.livePortfolio},
      ${nextState.liveProfit},
      ${nextState.executionCount},
      ${JSON.stringify(nextState.remainingBalance)},
      ${JSON.stringify(nextState.costBasis)},
      ${JSON.stringify(nextState.lastAnalysisAt)},
      ${JSON.stringify(nextState.logs)}
    )
    ON CONFLICT (owner_address)
    DO UPDATE SET
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
