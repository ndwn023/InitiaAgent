import { promises as fs } from "fs";
import path from "path";
import { ensureDatabase, hasDatabase, sql } from "@/lib/neon";
import { DEMO_AGENTS } from "@/lib/demo-agents";

export interface StoredAgent {
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
  isSubscription?: boolean; // true = user subscribed to someone else's agent
  agentClosed?: boolean;    // true = creator closed this agent
  // Risk & Execution settings
  takeProfitPct?: number;
  stopLossPct?: number;
  minConfidence?: number;
  tradeSizePct?: number;
  onChainAgentId?: string;
  // Performance metrics
  roi?: number;
  winRate?: number;
  totalTrades?: number;
  isDemo?: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const AGENTS_FILE = path.join(DATA_DIR, "agents.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

async function readAgents(): Promise<StoredAgent[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(AGENTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // File doesn't exist yet, return empty array
    return [];
  }
}

async function writeAgents(agents: StoredAgent[]) {
  await ensureDataDir();
  await fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2), "utf-8");
}

function rowToAgent(row: Record<string, unknown>): StoredAgent {
  return {
    id: String(row.id),
    name: String(row.name),
    strategy: String(row.strategy),
    target: row.target ? String(row.target) : undefined,
    pool: row.pool ? String(row.pool) : undefined,
    protocol: row.protocol ? String(row.protocol) : undefined,
    vault: row.vault ? String(row.vault) : undefined,
    status: (row.status ? String(row.status) : "Active") as "Active" | "Paused",
    deployedAt: new Date(String(row.deployed_at)).toISOString(),
    txHash: String(row.tx_hash ?? ""),
    contractAddress: String(row.contract_address ?? ""),
    initialCapital: Number(row.initial_capital ?? 0),
    creatorAddress: row.creator_address ? String(row.creator_address) : undefined,
    interval: row.interval ? String(row.interval) : undefined,
    isSubscription: Boolean(row.is_subscription),
    agentClosed: Boolean(row.agent_closed),
    takeProfitPct: row.take_profit_pct == null ? undefined : Number(row.take_profit_pct),
    stopLossPct: row.stop_loss_pct == null ? undefined : Number(row.stop_loss_pct),
    minConfidence: row.min_confidence == null ? undefined : Number(row.min_confidence),
    tradeSizePct: row.trade_size_pct == null ? undefined : Number(row.trade_size_pct),
    onChainAgentId: row.on_chain_agent_id ? String(row.on_chain_agent_id) : undefined,
    roi: row.roi == null ? undefined : Number(row.roi),
    winRate: row.win_rate == null ? undefined : Number(row.win_rate),
    totalTrades: row.total_trades == null ? undefined : Number(row.total_trades),
    isDemo: Boolean(row.is_demo),
  };
}

async function ensureDemoAgents(): Promise<void> {
  if (!hasDatabase || !sql) {
    // JSON fallback path
    const existing = await readAgents();
    const hasDemos = existing.some((a) => a.isDemo);
    if (hasDemos) return;
    await writeAgents([...DEMO_AGENTS, ...existing]);
    return;
  }

  // Neon path
  await ensureDatabase();
  const existing = await sql`
    SELECT id FROM agents WHERE is_demo = TRUE LIMIT 1
  `;
  if (existing.length > 0) return;

  for (const agent of DEMO_AGENTS) {
    await sql`
      INSERT INTO agents (
        id, name, strategy, target, pool, protocol, vault, status,
        deployed_at, tx_hash, contract_address, initial_capital,
        creator_address, interval, is_subscription, agent_closed,
        take_profit_pct, stop_loss_pct, min_confidence, trade_size_pct,
        on_chain_agent_id, roi, win_rate, total_trades, is_demo
      ) VALUES (
        ${agent.id}, ${agent.name}, ${agent.strategy}, ${agent.target ?? null},
        ${agent.pool ?? null}, ${agent.protocol ?? null}, ${agent.vault ?? null},
        ${agent.status}, ${agent.deployedAt}, ${agent.txHash},
        ${agent.contractAddress}, ${agent.initialCapital},
        ${agent.creatorAddress ?? null}, ${agent.interval ?? null},
        ${agent.isSubscription ?? false}, ${agent.agentClosed ?? false},
        ${agent.takeProfitPct ?? null}, ${agent.stopLossPct ?? null},
        ${agent.minConfidence ?? null}, ${agent.tradeSizePct ?? null},
        ${agent.onChainAgentId ?? null}, ${agent.roi ?? null},
        ${agent.winRate ?? null}, ${agent.totalTrades ?? null},
        TRUE
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export async function getAllAgents(): Promise<StoredAgent[]> {
  await ensureDemoAgents();
  if (!hasDatabase || !sql) return readAgents();
  await ensureDatabase();
  const rows = await sql`
    SELECT *
    FROM agents
    ORDER BY deployed_at DESC, created_at DESC
  `;
  return rows.map(rowToAgent);
}

export async function addAgent(agent: StoredAgent): Promise<StoredAgent> {
  if (!hasDatabase || !sql) {
    const agents = await readAgents();
    agents.unshift(agent);
    await writeAgents(agents);
    return agent;
  }

  await ensureDatabase();
  await sql`
    INSERT INTO agents (
      id, name, strategy, target, pool, protocol, vault, status, deployed_at,
      tx_hash, contract_address, initial_capital, creator_address, interval,
      is_subscription, agent_closed, take_profit_pct, stop_loss_pct,
      min_confidence, trade_size_pct, on_chain_agent_id,
      roi, win_rate, total_trades, is_demo
    ) VALUES (
      ${agent.id},
      ${agent.name},
      ${agent.strategy},
      ${agent.target ?? null},
      ${agent.pool ?? null},
      ${agent.protocol ?? null},
      ${agent.vault ?? null},
      ${agent.status},
      ${agent.deployedAt},
      ${agent.txHash},
      ${agent.contractAddress},
      ${agent.initialCapital},
      ${agent.creatorAddress ?? null},
      ${agent.interval ?? null},
      ${agent.isSubscription ?? false},
      ${agent.agentClosed ?? false},
      ${agent.takeProfitPct ?? null},
      ${agent.stopLossPct ?? null},
      ${agent.minConfidence ?? null},
      ${agent.tradeSizePct ?? null},
      ${agent.onChainAgentId ?? null},
      ${agent.roi ?? null},
      ${agent.winRate ?? null},
      ${agent.totalTrades ?? null},
      ${agent.isDemo ?? false}
    )
  `;
  return agent;
}

export async function removeAgent(id: string): Promise<boolean> {
  if (!hasDatabase || !sql) {
    const agents = await readAgents();
    const filtered = agents.filter((a) => a.id !== id);
    if (filtered.length === agents.length) return false;
    await writeAgents(filtered);
    return true;
  }

  await ensureDatabase();
  const result = await sql`
    DELETE FROM agents
    WHERE id = ${id}
  `;
  return result.length > 0;
}

export async function getAgentsByCreator(creatorAddress: string): Promise<StoredAgent[]> {
  if (!hasDatabase || !sql) {
    const agents = await readAgents();
    return agents.filter((a) => a.creatorAddress === creatorAddress);
  }

  await ensureDatabase();
  const rows = await sql`
    SELECT *
    FROM agents
    WHERE creator_address = ${creatorAddress}
    ORDER BY deployed_at DESC, created_at DESC
  `;
  return rows.map(rowToAgent);
}

export async function updateAgent(id: string, patch: Partial<StoredAgent>): Promise<StoredAgent | null> {
  if (!hasDatabase || !sql) {
    const agents = await readAgents();
    const idx = agents.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    agents[idx] = { ...agents[idx], ...patch };
    await writeAgents(agents);
    return agents[idx];
  }

  await ensureDatabase();
  const existing = await sql`
    SELECT *
    FROM agents
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existing.length === 0) return null;

  const current = rowToAgent(existing[0]);
  const next = { ...current, ...patch };

  const rows = await sql`
    UPDATE agents
    SET
      name = ${next.name},
      strategy = ${next.strategy},
      target = ${next.target ?? null},
      pool = ${next.pool ?? null},
      protocol = ${next.protocol ?? null},
      vault = ${next.vault ?? null},
      status = ${next.status},
      deployed_at = ${next.deployedAt},
      tx_hash = ${next.txHash},
      contract_address = ${next.contractAddress},
      initial_capital = ${next.initialCapital},
      creator_address = ${next.creatorAddress ?? null},
      interval = ${next.interval ?? null},
      is_subscription = ${next.isSubscription ?? false},
      agent_closed = ${next.agentClosed ?? false},
      take_profit_pct = ${next.takeProfitPct ?? null},
      stop_loss_pct = ${next.stopLossPct ?? null},
      min_confidence = ${next.minConfidence ?? null},
      trade_size_pct = ${next.tradeSizePct ?? null},
      on_chain_agent_id = ${next.onChainAgentId ?? null},
      roi = ${next.roi ?? null},
      win_rate = ${next.winRate ?? null},
      total_trades = ${next.totalTrades ?? null},
      is_demo = ${next.isDemo ?? false},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return rows[0] ? rowToAgent(rows[0]) : null;
}

// Mark all subscriptions sharing the same contractAddress as closed
export async function markSubscriptionsClosed(contractAddress: string): Promise<void> {
  if (!hasDatabase || !sql) {
    const agents = await readAgents();
    const updated = agents.map((a) =>
      a.contractAddress === contractAddress && a.isSubscription
        ? { ...a, agentClosed: true, status: "Paused" as const }
        : a
    );
    await writeAgents(updated);
    return;
  }

  await ensureDatabase();
  await sql`
    UPDATE agents
    SET
      agent_closed = TRUE,
      status = 'Paused',
      updated_at = NOW()
    WHERE contract_address = ${contractAddress}
      AND is_subscription = TRUE
  `;
}
