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
);

CREATE INDEX IF NOT EXISTS agents_contract_address_idx
ON agents (contract_address);

CREATE INDEX IF NOT EXISTS agents_creator_address_idx
ON agents (creator_address);

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
);
