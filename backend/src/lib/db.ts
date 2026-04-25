import { neon, neonConfig } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

// Ensure backend/lib modules can read env from monorepo root when imported directly.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (expected in monorepo root .env)");
}

// Optimize Neon connection for serverless
neonConfig.poolQueryViaFetch = true;

// Connection reuse for better performance
export const sql = neon(databaseUrl);

let initPromise: Promise<void> | null = null;

export async function ensureDatabase(): Promise<void> {
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        target TEXT,
        pool TEXT,
        protocol TEXT,
        vault TEXT,
        status TEXT NOT NULL,
        deployed_at TIMESTAMPTZ NOT NULL,
        tx_hash TEXT NOT NULL DEFAULT '',
        contract_address TEXT NOT NULL DEFAULT '',
        initial_capital DOUBLE PRECISION NOT NULL DEFAULT 0,
        creator_address TEXT,
        interval TEXT,
        is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
        agent_closed BOOLEAN NOT NULL DEFAULT FALSE,
        take_profit_pct DOUBLE PRECISION,
        stop_loss_pct DOUBLE PRECISION,
        min_confidence DOUBLE PRECISION,
        trade_size_pct DOUBLE PRECISION,
        on_chain_agent_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS agents_contract_address_idx ON agents (contract_address)`;
    await sql`CREATE INDEX IF NOT EXISTS agents_creator_address_idx ON agents (creator_address)`;
    await sql`CREATE INDEX IF NOT EXISTS agents_status_idx ON agents (status) WHERE agent_closed = false`;
    await sql`
      CREATE INDEX IF NOT EXISTS agents_active_order_idx
      ON agents (deployed_at DESC)
      WHERE status = 'Active' AND agent_closed = false
    `;
    // Composite: filter by owner + active status in a single scan
    await sql`
      CREATE INDEX IF NOT EXISTS agents_creator_active_idx
      ON agents (creator_address, deployed_at DESC)
      WHERE status = 'Active' AND agent_closed = false
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS agents_marketplace_idx
      ON agents (deployed_at DESC)
      WHERE LOWER(COALESCE(status, 'Active')) = 'active'
        AND COALESCE(agent_closed, FALSE) = FALSE
        AND COALESCE(is_subscription, FALSE) = FALSE
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dashboard_state (
        owner_address TEXT PRIMARY KEY,
        live_portfolio DOUBLE PRECISION NOT NULL DEFAULT 0,
        live_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
        execution_count INTEGER NOT NULL DEFAULT 0,
        remaining_balance JSONB NOT NULL DEFAULT '{}'::jsonb,
        cost_basis JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_analysis_at JSONB NOT NULL DEFAULT '{}'::jsonb,
        logs JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE dashboard_state
      ADD COLUMN IF NOT EXISTS last_analysis_at JSONB NOT NULL DEFAULT '{}'::jsonb
    `;

    // Index for time-ordered dashboard queries (most recently updated owners first)
    await sql`
      CREATE INDEX IF NOT EXISTS dashboard_state_updated_idx
      ON dashboard_state (updated_at DESC)
    `;

    // GIN index for JSONB key lookups on remaining_balance (agent balance queries)
    await sql`
      CREATE INDEX IF NOT EXISTS dashboard_state_balance_gin
      ON dashboard_state USING GIN (remaining_balance)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dashboard_state_snapshots (
        id BIGSERIAL PRIMARY KEY,
        owner_address TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'api',
        payload_hash TEXT NOT NULL,
        live_portfolio DOUBLE PRECISION NOT NULL DEFAULT 0,
        live_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
        execution_count INTEGER NOT NULL DEFAULT 0,
        state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_state_snapshot_owner_hash_uidx
      ON dashboard_state_snapshots (owner_address, payload_hash)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS dashboard_state_snapshot_owner_created_idx
      ON dashboard_state_snapshots (owner_address, created_at DESC)
    `;
  })();

  await initPromise;
}
