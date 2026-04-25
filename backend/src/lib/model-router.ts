/**
 * Multi-model router: Anthropic SDK → Gemini SDK
 *
 * Features:
 *   - Adaptive thinking  for Opus 4.6 / Sonnet 4.6 (auto-enabled)
 *   - Prompt caching     via cache_control on system block (Anthropic)
 *   - SSE streaming      via generateStream() for real-time chat
 */

import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Clients ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

// ─── Safety limits ────────────────────────────────────────────────────────────

const MAX_PROMPT_CHARS = 32_000;  // ~8k tokens, prevents runaway cost
const MAX_SYSTEM_CHARS = 16_000;  // system prompt cap

function truncatePrompt(text: string, max: number): string {
  if (text.length <= max) return text;
  const suffix = "\n\n[... truncated for length ...]";
  return text.slice(0, max - suffix.length) + suffix;
}

// ─── Model lists ──────────────────────────────────────────────────────────────

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash-lite",
];

export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
];

/** Models that support adaptive thinking (Opus 4.6, Sonnet 4.6) */
const ADAPTIVE_THINKING_MODELS = new Set(["claude-opus-4-6", "claude-sonnet-4-6"]);

export type ModelName = string;

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Override model. "gemini-*" → Gemini, "claude-*" → Anthropic SDK. */
  model?: ModelName;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Set false to skip adaptive thinking (e.g. for speed-critical paths). Default: true */
  thinking?: boolean;
}

// ─── Provider detection ───────────────────────────────────────────────────────

type Provider = "gemini" | "anthropic";

function detectProvider(model: string): Provider {
  if (model.startsWith("claude")) return "anthropic";
  return "gemini";
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(opts: GenerateOptions, model: string): Promise<string> {
  const userPrompt   = truncatePrompt(opts.userPrompt,   MAX_PROMPT_CHARS);
  const systemPrompt = truncatePrompt(opts.systemPrompt, MAX_SYSTEM_CHARS);

  const response = await genAI.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 1024,
      ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

// ─── Anthropic SDK ────────────────────────────────────────────────────────────

/**
 * System prompt as a cached content block.
 * cache_control marks the system as a cacheable prefix — on repeated calls
 * with the same system prompt, Anthropic serves it at ~10% of normal cost.
 * Minimum cacheable prefix: 4096 tokens (Opus/Haiku), 2048 (Sonnet).
 * Below that the marker is silently ignored — no harm in always adding it.
 */
function cachedSystem(text: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

async function callAnthropic(opts: GenerateOptions, model: string): Promise<string> {
  const useThinking = opts.thinking !== false && ADAPTIVE_THINKING_MODELS.has(model);

  const userPrompt   = truncatePrompt(opts.userPrompt,   MAX_PROMPT_CHARS);
  const systemPrompt = truncatePrompt(opts.systemPrompt, MAX_SYSTEM_CHARS);

  const maxTokens = opts.maxTokens ?? 1024;
  const msg = await anthropic.messages.create({
    model,
    max_tokens: useThinking ? Math.max(maxTokens, 8000) : maxTokens,
    // temperature is incompatible with extended thinking — omit it
    ...(!useThinking && { temperature: opts.temperature ?? 0.4 }),
    ...(useThinking && { thinking: { type: "enabled" as const, budget_tokens: 5000 } }),
    system: cachedSystem(systemPrompt),
    messages: [{ role: "user", content: userPrompt }],
  });

  // Thinking produces [thinking_block, text_block] — find the text block
  for (const block of msg.content) {
    if (block.type === "text" && block.text) return block.text.trim();
  }
  throw new Error("No text block in Anthropic response");
}

// ─── Single-model call ────────────────────────────────────────────────────────

async function callModel(opts: GenerateOptions, model: string): Promise<string> {
  const provider = detectProvider(model);
  switch (provider) {
    case "gemini":    return callGemini(opts, model);
    case "anthropic": return callAnthropic(opts, model);
  }
}

// ─── Cascade order ────────────────────────────────────────────────────────────

const DEFAULT_CASCADE: ModelName[] = [
  "claude-sonnet-4-6",       // Anthropic + adaptive thinking
  "gemini-2.5-flash",        // Gemini — fast fallback
  "claude-haiku-4-5",        // Anthropic — fast fallback
  "gemini-2.5-pro",          // Gemini — deep fallback
  "gemini-3-flash-preview",  // Gemini 3 — latest fast
  "gemini-3.1-pro-preview",  // Gemini 3.1 — latest deep
];

// ─── generate (non-streaming) ─────────────────────────────────────────────────

/** Returns true if the error is a rate-limit (429) response */
function isRateLimit(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
}

/** Sleep for `ms` milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate text using the best available model with automatic cascade fallback.
 * Adaptive thinking auto-enabled for Opus 4.6 / Sonnet 4.6.
 * On 429 rate-limit responses, waits briefly before moving to next model.
 * Throws only if ALL providers fail.
 */
export async function generate(opts: GenerateOptions): Promise<{ text: string; model: string }> {
  const cascade = opts.model
    ? [opts.model, ...DEFAULT_CASCADE.filter(m => m !== opts.model)]
    : DEFAULT_CASCADE;

  const errors: string[] = [];

  for (let i = 0; i < cascade.length; i++) {
    const model = cascade[i];
    try {
      const text = await callModel(opts, model);
      return { text, model };
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 120) || String(err);
      console.warn(`[model-router] ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);

      // On 429, add a short backoff before trying the next model
      if (isRateLimit(err) && i < cascade.length - 1) {
        await sleep(500 * (i + 1)); // 500ms, 1000ms, 1500ms ...
      }
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

// ─── generateStream (SSE-friendly streaming) ─────────────────────────────────

/**
 * Stream tokens to `onChunk` as they arrive.
 * - Anthropic: real token-by-token streaming via SDK stream()
 * - Gemini / CLI: emits full response as a single chunk (no native SSE)
 * Falls back through the cascade until one succeeds.
 */
export async function generateStream(
  opts: GenerateOptions,
  onChunk: (text: string) => void,
): Promise<{ model: string }> {
  const cascade = opts.model
    ? [opts.model, ...DEFAULT_CASCADE.filter(m => m !== opts.model)]
    : DEFAULT_CASCADE;

  const errors: string[] = [];

  for (let i = 0; i < cascade.length; i++) {
    const model    = cascade[i];
    const provider = detectProvider(model);

    try {
      if (provider === "anthropic") {
        const useThinking  = opts.thinking !== false && ADAPTIVE_THINKING_MODELS.has(model);
        const userPrompt   = truncatePrompt(opts.userPrompt,   MAX_PROMPT_CHARS);
        const systemPrompt = truncatePrompt(opts.systemPrompt, MAX_SYSTEM_CHARS);

        const streamMaxTokens = opts.maxTokens ?? 2048;
        const stream = anthropic.messages.stream({
          model,
          max_tokens: useThinking ? Math.max(streamMaxTokens, 8000) : streamMaxTokens,
          ...(!useThinking && { temperature: opts.temperature ?? 0.6 }),
          ...(useThinking && { thinking: { type: "enabled" as const, budget_tokens: 5000 } }),
          system: cachedSystem(systemPrompt),
          messages: [{ role: "user", content: userPrompt }],
        });

        // Fire text deltas (thinking deltas are skipped — client only sees reply)
        stream.on("text", onChunk);
        await stream.finalMessage();
        return { model };

      } else {
        // Gemini: no native per-token streaming — emit full response as one chunk
        const text = await callModel(opts, model);
        onChunk(text);
        return { model };
      }

    } catch (err) {
      const msg = (err as Error).message?.slice(0, 120) || String(err);
      console.warn(`[model-router/stream] ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);

      if (isRateLimit(err) && i < cascade.length - 1) {
        await sleep(500 * (i + 1));
      }
    }
  }

  throw new Error(`All models failed (stream):\n${errors.join("\n")}`);
}

// ─── generateMulti (consensus) ────────────────────────────────────────────────

/**
 * Run the same prompt through multiple models concurrently.
 * Used for consensus / multi-signal voting.
 */
export async function generateMulti(
  opts: GenerateOptions,
  models: ModelName[],
): Promise<{ model: string; text: string }[]> {
  const results = await Promise.allSettled(
    models.map(async (model) => ({ model, text: await callModel({ ...opts }, model) }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ model: string; text: string }> => r.status === "fulfilled")
    .map(r => r.value);
}
