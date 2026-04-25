/**
 * Runtime validation schemas shared between frontend and backend.
 *
 * Backends should call `parseBody(req.body, schema)` to validate request
 * payloads. Frontends can reuse the same schemas (or their inferred types)
 * so both sides agree on exactly what a valid payload looks like.
 */

import { z } from "zod";
import type {
  AgentStatus,
  DashboardStateSource,
} from "./agents";
import { SUPPORTED_AGENT_INTERVALS } from "./agents";
import type { EvmAddress, EvmHash } from "./chain";

// ─── Primitive schemas ────────────────────────────────────────────────────────

/** EVM address (0x + 40 hex). Always lower-cased for canonical storage. */
export const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "invalid EVM address")
  .transform((val) => val.toLowerCase() as EvmAddress);

/** EVM transaction hash (0x + 64 hex). Preserves case. */
export const evmHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "invalid EVM hash") as z.ZodType<EvmHash>;

/** Trimmed non-empty string with configurable max length. */
export const trimmedString = (max = 256) =>
  z.string().trim().min(1).max(max);

/** Supported trading strategies accepted by the registry. */
export const VALID_STRATEGIES = ["DCA", "LP", "YIELD", "VIP", "AGGRESSIVE"] as const;
export type Strategy = (typeof VALID_STRATEGIES)[number];
export const strategySchema = z.enum(VALID_STRATEGIES);

export const agentIntervalSchema = z.enum(
  SUPPORTED_AGENT_INTERVALS as unknown as [string, ...string[]],
);

export const agentStatusSchema: z.ZodType<AgentStatus> = z.enum(["Active", "Paused"]);

export const dashboardStateSourceSchema: z.ZodType<DashboardStateSource> = z.enum([
  "worker",
  "frontend",
  "api",
]);

// ─── Agent CRUD schemas ───────────────────────────────────────────────────────

export const createAgentBodySchema = z.object({
  id:              z.string().trim().min(1).max(64).optional(),
  name:            trimmedString(100),
  strategy:        z.string().trim().min(1).max(50)
                    .transform((s) => s.toUpperCase())
                    .pipe(strategySchema),
  target:          trimmedString(20).optional(),
  pool:            trimmedString(100).optional(),
  protocol:        trimmedString(50).optional(),
  vault:           trimmedString(42).optional(),
  status:          agentStatusSchema.optional(),
  deployedAt:      z.string().datetime().optional(),
  txHash:          z.string().trim().max(66).default(""),
  contractAddress: z.string().trim().max(42).default(""),
  initialCapital:  z.number().finite().nonnegative().max(1e9).default(0),
  creatorAddress:  evmAddressSchema.optional(),
  interval:        agentIntervalSchema.optional(),
  isSubscription:  z.boolean().default(false),
  agentClosed:     z.boolean().default(false),
  takeProfitPct:   z.number().finite().min(0).max(1000).optional(),
  stopLossPct:     z.number().finite().min(0).max(100).optional(),
  minConfidence:   z.number().finite().min(0).max(100).optional(),
  tradeSizePct:    z.number().finite().min(1).max(100).optional(),
  onChainAgentId:  z.string().trim().max(78).optional(),
});
export type CreateAgentBody = z.infer<typeof createAgentBodySchema>;

export const patchAgentBodySchema = createAgentBodySchema.partial();
export type PatchAgentBody = z.infer<typeof patchAgentBodySchema>;

export const deleteAgentBodySchema = z.object({
  contractAddress: z.string().trim().max(42).optional(),
});
export type DeleteAgentBody = z.infer<typeof deleteAgentBodySchema>;

export const listAgentsQuerySchema = z.object({
  limit:   z.coerce.number().int().min(1).max(500).default(200),
  offset:  z.coerce.number().int().min(0).default(0),
  creator: evmAddressSchema.optional(),
  scope:   z.enum(["all", "marketplace"]).optional(),
});
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;

// ─── Market analysis schemas ──────────────────────────────────────────────────

export const analyzeBodySchema = z.object({
  strategy:    z.string().trim().min(1).max(50),
  targetToken: trimmedString(20).optional(),
  pool:        trimmedString(100).optional(),
  protocol:    trimmedString(50).optional(),
  vault:       trimmedString(42).optional(),
  capital:     z.number().finite().nonnegative().optional(),
  interval:    z.string().trim().max(32).optional(),
  model:       z.string().trim().max(64).optional(),
});
export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;

export const analyzeQuerySchema = z.object({
  mode: z.enum(["rules", "ai"]).default("rules"),
});

// ─── Execute schemas ──────────────────────────────────────────────────────────

export const executeBodySchema = z.object({
  agentId:          z.string().trim().max(64).optional(),
  signal:           z.enum(["BUY", "SELL", "HOLD"]),
  confidence:       z.number().finite().min(0).max(100),
  tradeAmount:      z.number().finite().nonnegative().optional(),
  fromToken:        trimmedString(20).optional(),
  toToken:          trimmedString(20).optional(),
  strategy:         z.string().trim().max(50).optional(),
  onChainAgentId:   z.string().trim().max(78).optional(),
});
export type ExecuteBody = z.infer<typeof executeBodySchema>;

// ─── Chat schemas ─────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const chatBodySchema = z.object({
  messages:     z.array(chatMessageSchema).min(1).max(50),
  agentContext: z.record(z.unknown()).optional(),
  model:        z.string().trim().max(64).optional(),
  stream:       z.boolean().optional(),
});

// ─── Dashboard schemas ────────────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  ownerAddress: evmAddressSchema,
});

export const dashboardSnapshotsQuerySchema = dashboardQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const upsertDashboardStateBodySchema = z.object({
  ownerAddress:     evmAddressSchema,
  livePortfolio:    z.coerce.number().finite().default(0),
  liveProfit:       z.coerce.number().finite().default(0),
  executionCount:   z.coerce.number().int().nonnegative().default(0),
  remainingBalance: z.record(z.coerce.number()).default({}),
  costBasis:        z.record(z.coerce.number()).default({}),
  lastAnalysisAt:   z.record(z.coerce.number()).default({}),
  logs:             z.array(z.unknown()).max(20).default([]),
  source:           dashboardStateSourceSchema.default("api"),
});

// ─── LP fee schema ────────────────────────────────────────────────────────────

export const lpFeeBodySchema = z.object({
  pools:        z.array(z.string().min(1).max(32)).min(1).max(20),
  capital:      z.number().finite().positive(),
  cycleSeconds: z.number().finite().positive().max(86400).default(15),
});

// ─── Utility helpers ──────────────────────────────────────────────────────────

export class RequestValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(issues[0]?.message ?? "Invalid request");
    this.name = "RequestValidationError";
    this.issues = issues;
  }
  /** Flatten for API error response: `{ fields: { path: message } }`. */
  toJSON() {
    const fields: Record<string, string> = {};
    for (const issue of this.issues) {
      fields[issue.path.join(".") || "_"] = issue.message;
    }
    return { error: "Invalid request", fields };
  }
}

/** Parse an unknown payload, throwing `RequestValidationError` on failure. */
export function parsePayload<T extends z.ZodTypeAny>(
  input: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues);
  }
  return result.data;
}
