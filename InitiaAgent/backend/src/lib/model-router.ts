/**
 * Multi-model router: Anthropic SDK → Gemini SDK → Claude CLI (stdin)
 *
 * Features:
 *   - Adaptive thinking  for Opus 4.6 / Sonnet 4.6 (auto-enabled)
 *   - Prompt caching     via cache_control on system block (Anthropic)
 *   - SSE streaming      via generateStream() for real-time chat
 *   - Claude CLI         stdin piping to avoid ENAMETOOLONG on Windows
 */

import { spawn } from "child_process";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Clients ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

// ─── Model lists ──────────────────────────────────────────────────────────────

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash",
  "gemini-3.1-pro",
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
  /** Override model. "gemini-*" → Gemini, "claude-*" → Anthropic SDK, "claude-cli" → CLI. */
  model?: ModelName;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Set false to skip adaptive thinking (e.g. for speed-critical paths). Default: true */
  thinking?: boolean;
}

// ─── Provider detection ───────────────────────────────────────────────────────

type Provider = "gemini" | "anthropic" | "claude-cli";

function detectProvider(model: string): Provider {
  if (model === "claude-cli") return "claude-cli";
  if (model.startsWith("claude")) return "anthropic";
  return "gemini";
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(opts: GenerateOptions, model: string): Promise<string> {
  const response = await genAI.models.generateContent({
    model,
    contents: opts.userPrompt,
    config: {
      systemInstruction: opts.systemPrompt,
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

  const msg = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    // temperature is incompatible with adaptive thinking — omit it
    ...(!useThinking && { temperature: opts.temperature ?? 0.4 }),
    ...(useThinking && { thinking: { type: "adaptive" as const } }),
    system: cachedSystem(opts.systemPrompt),
    messages: [{ role: "user", content: opts.userPrompt }],
  });

  // Thinking produces [thinking_block, text_block] — find the text block
  for (const block of msg.content) {
    if (block.type === "text" && block.text) return block.text.trim();
  }
  throw new Error("No text block in Anthropic response");
}

// ─── Claude CLI (stdin) ───────────────────────────────────────────────────────

/**
 * Calls `claude --print` via stdin to avoid ENAMETOOLONG / uv_spawn on Windows.
 * Never pass the prompt as a CLI argument.
 */
async function callClaudeCli(opts: GenerateOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullPrompt = `${opts.systemPrompt}\n\n${opts.userPrompt}`;

    const proc = spawn("claude", ["--print"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", (err) => reject(new Error(`claude-cli spawn failed: ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else reject(new Error(`claude-cli exited ${code}: ${stderr.slice(0, 300)}`));
    });

    proc.stdin.write(fullPrompt, "utf8");
    proc.stdin.end();
  });
}

// ─── Single-model call ────────────────────────────────────────────────────────

async function callModel(opts: GenerateOptions, model: string): Promise<string> {
  const provider = detectProvider(model);
  switch (provider) {
    case "gemini":     return callGemini(opts, model);
    case "anthropic":  return callAnthropic(opts, model);
    case "claude-cli": return callClaudeCli(opts);
  }
}

// ─── Cascade order ────────────────────────────────────────────────────────────

const DEFAULT_CASCADE: ModelName[] = [
  "claude-sonnet-4-6",  // Anthropic + adaptive thinking
  "gemini-2.5-flash",   // Gemini — fast
  "claude-haiku-4-5",   // Anthropic — fast fallback
  "gemini-3-flash",     // Gemini 3 — fast fallback
  "gemini-3.1-pro",     // Gemini 3.1 — deep fallback
  "claude-cli",         // Local CLI — last resort
];

// ─── generate (non-streaming) ─────────────────────────────────────────────────

/**
 * Generate text using the best available model with automatic cascade fallback.
 * Adaptive thinking auto-enabled for Opus 4.6 / Sonnet 4.6.
 * Throws only if ALL providers fail.
 */
export async function generate(opts: GenerateOptions): Promise<{ text: string; model: string }> {
  const cascade = opts.model
    ? [opts.model, ...DEFAULT_CASCADE.filter(m => m !== opts.model)]
    : DEFAULT_CASCADE;

  const errors: string[] = [];

  for (const model of cascade) {
    try {
      const text = await callModel(opts, model);
      return { text, model };
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 120) || String(err);
      console.warn(`[model-router] ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);
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

  for (const model of cascade) {
    const provider = detectProvider(model);

    try {
      if (provider === "anthropic") {
        const useThinking = opts.thinking !== false && ADAPTIVE_THINKING_MODELS.has(model);

        const stream = anthropic.messages.stream({
          model,
          max_tokens: opts.maxTokens ?? 2048,
          ...(!useThinking && { temperature: opts.temperature ?? 0.6 }),
          ...(useThinking && { thinking: { type: "adaptive" as const } }),
          system: cachedSystem(opts.systemPrompt),
          messages: [{ role: "user", content: opts.userPrompt }],
        });

        // Fire text deltas (thinking deltas are skipped — client only sees reply)
        stream.on("text", onChunk);
        await stream.finalMessage();
        return { model };

      } else {
        // Gemini / CLI: no native per-token streaming — emit full response as one chunk
        const text = await callModel(opts, model);
        onChunk(text);
        return { model };
      }

    } catch (err) {
      const msg = (err as Error).message?.slice(0, 120) || String(err);
      console.warn(`[model-router/stream] ${model} failed: ${msg}`);
      errors.push(`${model}: ${msg}`);
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
