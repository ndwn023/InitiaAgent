/**
 * Seed the `agents` table with a rich, varied catalogue of demo agents.
 *
 * Usage:
 *   npm run seed                    # default (60 agents, skip if already present)
 *   npm run seed -- --count 100     # custom count
 *   npm run seed -- --reset         # wipe demo rows first (id prefix `seed_`)
 *   npm run seed -- --dry-run       # print plan, do not insert
 *   npm run seed -- --seed 42       # deterministic RNG seed
 *
 * All seeded agents share the id prefix `seed_` so they are easy to identify
 * and reset without touching real user data.
 */

import {
  CONTRACTS,
  DEFAULT_AGENT_INTERVAL,
  SUPPORTED_AGENT_INTERVALS,
  type AgentInterval,
  type DeployedAgent,
  type EvmAddress,
} from "@initia-agent/shared";

// DB modules are imported lazily inside `runSeed()` so `--dry-run` still works
// without a DATABASE_URL configured.

// ─── Strategy + theme configs ─────────────────────────────────────────────────

type Strategy = "DCA" | "LP" | "YIELD" | "VIP" | "AGGRESSIVE";

interface StrategyProfile {
  strategy: Strategy;
  themeNames: string[];
  targetTokens: readonly string[];
  intervals: readonly AgentInterval[];
  capitalRange: [number, number];
  tradeSizePctRange: [number, number];
  minConfidenceRange: [number, number];
  takeProfitPctRange: [number, number];
  stopLossPctRange: [number, number];
  protocols?: readonly string[];
  poolTemplates?: readonly string[];
}

const STRATEGY_PROFILES: StrategyProfile[] = [
  {
    strategy: "DCA",
    themeNames: [
      "Iron Fort",        "Steady Compass",   "Deep Root",        "Granite Buyer",
      "Silent River",     "Patient Ember",    "Cobalt Anchor",    "Moonshore Steady",
      "Blue Harvest",     "Still Horizon",    "Quiet Glacier",    "Homestead Pulse",
    ],
    targetTokens:    ["INIT", "BTC", "ETH", "SOL", "TIA", "ATOM"],
    intervals:       ["1 Hour", "4 Hours", "12 Hours", "24 Hours"],
    capitalRange:    [100, 2500],
    tradeSizePctRange:   [5,  15],
    minConfidenceRange:  [35, 55],
    takeProfitPctRange:  [25, 60],
    stopLossPctRange:    [8,  20],
  },
  {
    strategy: "LP",
    themeNames: [
      "Nautilus Prime",   "Flow State",       "Prism Vault",      "Harmony Stream",
      "Coral Depth",      "Tidepool Rebal",   "Lagoon Echo",      "Azure Current",
      "Reflex Pool",      "Rippleguard",      "Orbit Liquidity",  "Mirror Drift",
    ],
    targetTokens:    ["INIT", "ETH", "BTC"],
    intervals:       ["30 Minutes", "1 Hour", "4 Hours"],
    capitalRange:    [250, 3500],
    tradeSizePctRange:   [8,  20],
    minConfidenceRange:  [30, 50],
    takeProfitPctRange:  [15, 40],
    stopLossPctRange:    [6,  15],
    poolTemplates:   ["INIT/USDC", "INIT/ETH", "BTC/USDC", "ETH/USDC", "SOL/INIT"],
    protocols:       ["InitiaDEX", "Uniswap v3"],
  },
  {
    strategy: "YIELD",
    themeNames: [
      "Sun Harvester",    "Meadow Forge",     "Compound Atlas",   "Verdant Echo",
      "Yield Mantis",     "Grainspire",       "Golden Bough",     "Harvest Tempo",
      "Orchard Prime",    "Saffron Loop",     "Terrace Yield",    "Solstice Compounder",
    ],
    targetTokens:    ["INIT", "TIA", "ATOM", "ETH"],
    intervals:       ["1 Hour", "4 Hours", "12 Hours"],
    capitalRange:    [200, 4000],
    tradeSizePctRange:   [10, 22],
    minConfidenceRange:  [40, 60],
    takeProfitPctRange:  [20, 55],
    stopLossPctRange:    [8,  18],
    protocols:       ["Initia Staking", "esINIT Vault", "TIA Restaking", "ATOM Compound"],
  },
  {
    strategy: "VIP",
    themeNames: [
      "Obsidian Crown",   "Velvet Zeus",      "Royal Orbit",      "Alpha Regalia",
      "Elysium Spire",    "Imperial Axis",    "Platinum Herald",  "Ivory Monarch",
      "Zenith Prime",     "Regal Cipher",     "Vanguard Noble",   "Crown Oracle",
    ],
    targetTokens:    ["INIT", "BTC", "ETH", "SOL"],
    intervals:       ["15 Minutes", "30 Minutes", "1 Hour", "4 Hours"],
    capitalRange:    [800, 5000],
    tradeSizePctRange:   [12, 28],
    minConfidenceRange:  [45, 70],
    takeProfitPctRange:  [30, 80],
    stopLossPctRange:    [6,  14],
    protocols:       ["Initia VIP Tier", "esINIT Staking", "Lockdrop Premium"],
  },
  {
    strategy: "AGGRESSIVE",
    themeNames: [
      "Thunder Hawk",     "Wolf Tempo",       "Blade Runner",     "Onyx Cobra",
      "Storm Pivot",      "Vortex Sniper",    "Pyre Falcon",      "Phantom Lancer",
      "Blitz Apex",       "Crimson Strider",  "Ghost Talon",      "Pulse Raptor",
    ],
    targetTokens:    ["INIT", "SOL", "TIA", "ETH", "BTC"],
    intervals:       ["5 Minutes", "15 Minutes", "30 Minutes", "1 Hour"],
    capitalRange:    [150, 3000],
    tradeSizePctRange:   [15, 30],
    minConfidenceRange:  [48, 72],
    takeProfitPctRange:  [40, 120],
    stopLossPctRange:    [4,  10],
  },
];

// ─── Demo creator wallets (checksum-cased, rotated to vary ownership) ─────────

const DEMO_CREATORS: readonly EvmAddress[] = [
  "0xA11cE0000000000000000000000000000000A11C",
  "0xB0bD16eCaa1e00000000000000000000BEEFBEEF",
  "0xCafe00000000000000000000000000000000CAFE",
  "0xDecaf0000000000000000000000000000000DECA",
  "0xFEED00000000000000000000000000000000FEED",
  "0xc0FFEE000000000000000000000000000000C0FE",
  "0x1337000000000000000000000000000000013370",
  "0xDEAdBeef00000000000000000000000000DEAD00",
].map((a) => a.toLowerCase() as EvmAddress);

// ─── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
// Same seed → same agent catalogue across runs.

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const pick = <T>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

const randInt = (rng: () => number, lo: number, hi: number): number =>
  Math.floor(lo + rng() * (hi - lo + 1));

const randFloat = (rng: () => number, lo: number, hi: number, decimals = 2): number => {
  const v = lo + rng() * (hi - lo);
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
};

function hexBytes(rng: () => number, bytes: number): string {
  let out = "";
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(rng() * 256).toString(16).padStart(2, "0");
  }
  return out;
}

function deriveContractAddress(rng: () => number): EvmAddress {
  return ("0x" + hexBytes(rng, 20)) as EvmAddress;
}

function deriveTxHash(rng: () => number): string {
  return "0x" + hexBytes(rng, 32);
}

function isoBefore(rng: () => number, maxDaysBack = 30): string {
  const backMs = Math.floor(rng() * maxDaysBack * 86_400_000);
  return new Date(Date.now() - backMs).toISOString();
}

// ─── Agent factory ────────────────────────────────────────────────────────────

function makeAgent(
  rng: () => number,
  index: number,
  profile: StrategyProfile,
  usedNames: Set<string>,
): DeployedAgent {
  // Pick a name without repeats (fall back to suffix if exhausted).
  let name = pick(rng, profile.themeNames);
  if (usedNames.has(name)) {
    name = `${name} #${index + 1}`;
  }
  usedNames.add(name);

  const target   = pick(rng, profile.targetTokens);
  const pool     = profile.poolTemplates ? pick(rng, profile.poolTemplates) : undefined;
  const protocol = profile.protocols ? pick(rng, profile.protocols) : undefined;
  const interval = pick(rng, profile.intervals);

  const id              = `seed_${profile.strategy.toLowerCase()}_${index
    .toString(36)
    .padStart(3, "0")}_${hexBytes(rng, 3)}`;
  const onChainAgentId  = String(10_000 + index);
  const contractAddress = deriveContractAddress(rng);
  const txHash          = deriveTxHash(rng);
  const deployedAt      = isoBefore(rng);

  const initialCapital  = randFloat(rng, profile.capitalRange[0],      profile.capitalRange[1], 0);
  const tradeSizePct    = randFloat(rng, profile.tradeSizePctRange[0], profile.tradeSizePctRange[1], 1);
  const minConfidence   = randFloat(rng, profile.minConfidenceRange[0],profile.minConfidenceRange[1], 0);
  const takeProfitPct   = randFloat(rng, profile.takeProfitPctRange[0],profile.takeProfitPctRange[1], 1);
  const stopLossPct     = randFloat(rng, profile.stopLossPctRange[0],  profile.stopLossPctRange[1], 1);

  return {
    id,
    name,
    strategy: profile.strategy,
    target,
    pool,
    protocol,
    vault: CONTRACTS.AGENT_VAULT_DEFAULT,
    status: "Active",
    deployedAt,
    txHash,
    contractAddress,
    initialCapital,
    creatorAddress: pick(rng, DEMO_CREATORS),
    interval: SUPPORTED_AGENT_INTERVALS.includes(interval) ? interval : DEFAULT_AGENT_INTERVAL,
    isSubscription: false,
    agentClosed: false,
    takeProfitPct,
    stopLossPct,
    minConfidence,
    tradeSizePct,
    onChainAgentId,
  };
}

function generateAgents(count: number, seed: number): DeployedAgent[] {
  const rng = mulberry32(seed);
  const usedNames = new Set<string>();
  const agents: DeployedAgent[] = [];

  // Round-robin across strategies so the marketplace always has a balanced mix.
  for (let i = 0; i < count; i++) {
    const profile = STRATEGY_PROFILES[i % STRATEGY_PROFILES.length];
    agents.push(makeAgent(rng, i, profile, usedNames));
  }
  return agents;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

interface Args {
  count: number;
  seed: number;
  reset: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { count: 60, seed: 20260424, reset: false, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reset") args.reset = true;
    else if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a === "--count" || a === "-c") args.count = Number(argv[++i]);
    else if (a.startsWith("--count=")) args.count = Number(a.slice(8));
    else if (a === "--seed" || a === "-s") args.seed = Number(argv[++i]);
    else if (a.startsWith("--seed=")) args.seed = Number(a.slice(7));
  }

  if (!Number.isFinite(args.count) || args.count < 1 || args.count > 500) {
    throw new Error(`--count must be between 1 and 500 (got ${args.count})`);
  }
  if (!Number.isFinite(args.seed)) {
    throw new Error(`--seed must be a number (got ${args.seed})`);
  }
  return args;
}

async function resetDemoAgents(): Promise<number> {
  const { ensureDatabase, sql } = await import("../lib/db");
  await ensureDatabase();
  const rows = await sql`DELETE FROM agents WHERE id LIKE 'seed_%' RETURNING id`;
  return rows.length;
}

function summarize(agents: DeployedAgent[]): string {
  const perStrategy = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.strategy] = (acc[a.strategy] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(perStrategy)
    .map(([s, n]) => `${s}:${n}`)
    .join("  ");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log("\n▲ InitiaAgent — seed agents");
  console.log(`  count  : ${args.count}`);
  console.log(`  seed   : ${args.seed}`);
  console.log(`  reset  : ${args.reset}`);
  console.log(`  dryRun : ${args.dryRun}\n`);

  const agents = generateAgents(args.count, args.seed);

  console.log(`  plan   : ${summarize(agents)}\n`);

  if (args.dryRun) {
    // Print a compact preview then exit.
    for (const a of agents.slice(0, 10)) {
      console.log(
        `  · ${a.strategy.padEnd(10)} ${a.name.padEnd(22)} ` +
        `target=${a.target ?? "-"} cap=${a.initialCapital} tp=${a.takeProfitPct}% ` +
        `sl=${a.stopLossPct}% int=${a.interval}`,
      );
    }
    if (agents.length > 10) {
      console.log(`  … (${agents.length - 10} more)\n`);
    }
    console.log("\n[dry-run] no rows written. ✔\n");
    return;
  }

  // Lazy-load DB modules — keeps `--dry-run` usable without DATABASE_URL.
  const { addAgent, getAllAgents } = await import("../lib/agent-store");
  const { ensureDatabase } = await import("../lib/db");
  await ensureDatabase();

  if (args.reset) {
    const removed = await resetDemoAgents();
    console.log(`  reset  : removed ${removed} pre-existing seed rows\n`);
  } else {
    // Skip rows that already exist (keeps idempotency without --reset).
    const existing = await getAllAgents({ limit: 500 });
    const existingIds = new Set(existing.map((a) => a.id));
    const before = agents.length;
    for (let i = agents.length - 1; i >= 0; i--) {
      if (existingIds.has(agents[i].id)) agents.splice(i, 1);
    }
    const skipped = before - agents.length;
    if (skipped > 0) console.log(`  skip   : ${skipped} already exist (pass --reset to wipe)\n`);
  }

  let inserted = 0;
  let failed = 0;
  for (const agent of agents) {
    try {
      await addAgent(agent);
      inserted++;
      if (inserted % 10 === 0) process.stdout.write(`  · inserted ${inserted}…\n`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ failed ${agent.id}: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n✔ done — inserted ${inserted}${failed ? `, ${failed} failed` : ""}.\n`,
  );
}

main().catch((err) => {
  console.error("\n✗ seed-agents failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
