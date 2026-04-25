import { ensureDatabase, sql } from "./db";
import type { DeployedAgent } from "@initia-agent/shared";
import { normalizeAgentStatus } from "@initia-agent/shared";

export type StoredAgent = DeployedAgent;

export interface GetAgentsOptions {
  limit?: number;
  offset?: number;
  creatorAddress?: string;
  marketplaceOnly?: boolean;
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t";
  }
  return false;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIsoDate(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function rowToAgent(row: Record<string, unknown>): StoredAgent {
  return {
    id: asOptionalString(row.id) ?? "",
    name: asOptionalString(row.name) ?? "Unnamed Agent",
    strategy: asOptionalString(row.strategy) ?? "DCA",
    target: asOptionalString(row.target),
    pool: asOptionalString(row.pool),
    protocol: asOptionalString(row.protocol),
    vault: asOptionalString(row.vault),
    status: normalizeAgentStatus(row.status),
    deployedAt: asIsoDate(row.deployed_at),
    txHash: asOptionalString(row.tx_hash) ?? "",
    contractAddress: asOptionalString(row.contract_address) ?? "",
    initialCapital: asNumber(row.initial_capital, 0),
    creatorAddress: asOptionalString(row.creator_address)?.toLowerCase(),
    interval: asOptionalString(row.interval),
    isSubscription: asBoolean(row.is_subscription),
    agentClosed: asBoolean(row.agent_closed),
    takeProfitPct: row.take_profit_pct == null ? undefined : asNumber(row.take_profit_pct),
    stopLossPct: row.stop_loss_pct == null ? undefined : asNumber(row.stop_loss_pct),
    minConfidence: row.min_confidence == null ? undefined : asNumber(row.min_confidence),
    tradeSizePct: row.trade_size_pct == null ? undefined : asNumber(row.trade_size_pct),
    onChainAgentId: asOptionalString(row.on_chain_agent_id),
  };
}

export async function getAllAgents(options: GetAgentsOptions = {}): Promise<StoredAgent[]> {
  const limit = Math.min(Math.max(Math.trunc(Number(options.limit ?? 500) || 500), 1), 500);
  const offset = Math.max(Math.trunc(Number(options.offset ?? 0) || 0), 0);
  const creatorAddress = options.creatorAddress?.toLowerCase();
  const marketplaceOnly = options.marketplaceOnly ?? false;

  await ensureDatabase();
  let rows;

  if (creatorAddress && marketplaceOnly) {
    rows = await sql!`
      SELECT * FROM agents
      WHERE creator_address = ${creatorAddress}
        AND LOWER(COALESCE(status, 'Active')) = 'active'
        AND COALESCE(agent_closed, FALSE) = FALSE
        AND COALESCE(is_subscription, FALSE) = FALSE
      ORDER BY deployed_at DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (creatorAddress) {
    rows = await sql!`
      SELECT * FROM agents
      WHERE creator_address = ${creatorAddress}
      ORDER BY deployed_at DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (marketplaceOnly) {
    rows = await sql!`
      SELECT * FROM agents
      WHERE LOWER(COALESCE(status, 'Active')) = 'active'
        AND COALESCE(agent_closed, FALSE) = FALSE
        AND COALESCE(is_subscription, FALSE) = FALSE
      ORDER BY deployed_at DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    rows = await sql!`
      SELECT * FROM agents
      ORDER BY deployed_at DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return rows.map(rowToAgent);
}

/**
 * Get only active agents — optimized for worker tick (avoids fetching closed/paused)
 */
export async function getActiveAgents(): Promise<StoredAgent[]> {
  await ensureDatabase();
  const rows = await sql!`
    SELECT * FROM agents
    WHERE LOWER(COALESCE(status, 'Active')) = 'active'
      AND COALESCE(agent_closed, FALSE) = FALSE
    ORDER BY deployed_at DESC
  `;
  return rows.map(rowToAgent);
}

export async function addAgent(agent: StoredAgent): Promise<StoredAgent> {
  const normalizedCreatorAddress = agent.creatorAddress?.toLowerCase();
  const normalizedStatus = normalizeAgentStatus(agent.status);

  await ensureDatabase();
  await sql!`
    INSERT INTO agents (
      id, name, strategy, target, pool, protocol, vault, status, deployed_at,
      tx_hash, contract_address, initial_capital, creator_address, interval,
      is_subscription, agent_closed, take_profit_pct, stop_loss_pct,
      min_confidence, trade_size_pct, on_chain_agent_id
    ) VALUES (
      ${agent.id}, ${agent.name}, ${agent.strategy}, ${agent.target ?? null},
      ${agent.pool ?? null}, ${agent.protocol ?? null}, ${agent.vault ?? null},
      ${normalizedStatus}, ${agent.deployedAt}, ${agent.txHash}, ${agent.contractAddress},
      ${agent.initialCapital}, ${normalizedCreatorAddress ?? null}, ${agent.interval ?? null},
      ${agent.isSubscription ?? false}, ${agent.agentClosed ?? false},
      ${agent.takeProfitPct ?? null}, ${agent.stopLossPct ?? null},
      ${agent.minConfidence ?? null}, ${agent.tradeSizePct ?? null},
      ${agent.onChainAgentId ?? null}
    )
  `;
  return agent;
}

export async function removeAgent(id: string): Promise<boolean> {
  await ensureDatabase();
  const result = await sql!`DELETE FROM agents WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function updateAgent(id: string, patch: Partial<StoredAgent>): Promise<StoredAgent | null> {
  await ensureDatabase();

  // Single round-trip: fetch + update atomically using a CTE.
  // If the row doesn't exist, RETURNING returns zero rows → null.
  const rows = await sql!`
    UPDATE agents SET
      name             = COALESCE(${patch.name ?? null}, name),
      strategy         = COALESCE(${patch.strategy ?? null}, strategy),
      target           = COALESCE(${patch.target ?? null}, target),
      pool             = COALESCE(${patch.pool ?? null}, pool),
      protocol         = COALESCE(${patch.protocol ?? null}, protocol),
      vault            = COALESCE(${patch.vault ?? null}, vault),
      status           = COALESCE(${patch.status ?? null}, status),
      deployed_at      = COALESCE(${patch.deployedAt ?? null}, deployed_at),
      tx_hash          = COALESCE(${patch.txHash ?? null}, tx_hash),
      contract_address = COALESCE(${patch.contractAddress ?? null}, contract_address),
      initial_capital  = COALESCE(${patch.initialCapital ?? null}, initial_capital),
      creator_address  = COALESCE(${patch.creatorAddress ?? null}, creator_address),
      interval         = COALESCE(${patch.interval ?? null}, interval),
      is_subscription  = COALESCE(${patch.isSubscription ?? null}, is_subscription),
      agent_closed     = COALESCE(${patch.agentClosed ?? null}, agent_closed),
      take_profit_pct  = COALESCE(${patch.takeProfitPct ?? null}, take_profit_pct),
      stop_loss_pct    = COALESCE(${patch.stopLossPct ?? null}, stop_loss_pct),
      min_confidence   = COALESCE(${patch.minConfidence ?? null}, min_confidence),
      trade_size_pct   = COALESCE(${patch.tradeSizePct ?? null}, trade_size_pct),
      on_chain_agent_id = COALESCE(${patch.onChainAgentId ?? null}, on_chain_agent_id),
      updated_at       = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return rows[0] ? rowToAgent(rows[0]) : null;
}

export async function markSubscriptionsClosed(contractAddress: string): Promise<void> {
  await ensureDatabase();
  await sql!`
    UPDATE agents SET agent_closed = TRUE, status = 'Paused', updated_at = NOW()
    WHERE contract_address = ${contractAddress} AND is_subscription = TRUE
  `;
}
