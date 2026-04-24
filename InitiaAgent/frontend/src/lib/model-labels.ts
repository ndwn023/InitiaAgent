/**
 * Canonical model registry — single source of truth for display labels and brand colors.
 * Keys use a prefix convention so "claude-haiku-4-5" resolves via "claude-haiku".
 */
export const MODEL_LABEL: Record<string, { label: string; color: string }> = {
  "claude-haiku":    { label: "Haiku 4.5",  color: "#CC785C" },
  "claude-sonnet":   { label: "Sonnet 4.6", color: "#CC785C" },
  "claude-opus":     { label: "Opus 4.6",   color: "#CC785C" },
  "claude-cli":      { label: "Claude CLI", color: "#CC785C" },
  "gemini-2.5-flash":{ label: "2.5 Flash",  color: "#4285F4" },
  "gemini-3-flash":  { label: "3 Flash",    color: "#4285F4" },
  "gemini-3.1-pro":  { label: "3.1 Pro",    color: "#4285F4" },
};

/** Resolve a full model ID (e.g. "claude-haiku-4-5") to its display meta. */
export function getModelMeta(id: string): { label: string; color: string } {
  if (MODEL_LABEL[id]) return MODEL_LABEL[id];
  const key = Object.keys(MODEL_LABEL).find(k => id.startsWith(k));
  return key ? MODEL_LABEL[key] : { label: id, color: "#71717A" };
}
