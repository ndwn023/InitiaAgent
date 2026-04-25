/**
 * Signal history ring buffer — zero-allocation circular buffer.
 *
 * Performance improvements:
 *   - Fixed-size circular buffer (no shift() allocation churn)
 *   - TTL-based automatic eviction (prevents memory leak)
 *   - Lazy stats computation (only when requested)
 */

const MAX_HISTORY = 20;
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — evict stale entries
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignalRecord {
  timestamp: number;
  strategy: string;
  token: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskLevel: "Low" | "Medium" | "High";
  engine: "ai" | "rules";
}

export interface SignalStats {
  buy: number;
  sell: number;
  hold: number;
  total: number;
  avgConfidence: number;
  trend: "persistent BUY" | "persistent SELL" | "mixed/neutral";
  lastSignal: SignalRecord | null;
}

// ─── Circular buffer (zero-allocation ring) ────────────────────────────────────

class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0; // next write position
  private count = 0;

  constructor(private capacity: number) {
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Return the last `limit` items in insertion order */
  slice(limit?: number): T[] {
    const n = limit ? Math.min(limit, this.count) : this.count;
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      // Read from newest to oldest
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const val = this.buf[idx];
      if (val !== undefined) result.push(val);
    }
    return result;
  }

  get length(): number {
    return this.count;
  }
}

// ─── Ring buffer store (per token+strategy key) ───────────────────────────────

const historyMap = new Map<string, RingBuffer<SignalRecord>>();

function makeKey(token: string, strategy: string): string {
  return `${token.toUpperCase()}:${strategy.toUpperCase().split(" ")[0]}`;
}

function getOrCreateBuffer(key: string): RingBuffer<SignalRecord> {
  let buf = historyMap.get(key);
  if (!buf) {
    buf = new RingBuffer<SignalRecord>(MAX_HISTORY);
    historyMap.set(key, buf);
  }
  return buf;
}

// ─── TTL Cleanup ──────────────────────────────────────────────────────────────

let lastCleanup = Date.now();

function maybeCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Evict buffers that haven't been written to recently
  // (RingBuffer entries with all timestamps older than TTL)
  for (const [key, buf] of historyMap) {
    const entries = buf.slice(1);
    if (entries.length === 0 || (entries[0] && now - entries[0].timestamp > ENTRY_TTL_MS)) {
      historyMap.delete(key);
    }
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function recordSignal(record: SignalRecord): void {
  const key = makeKey(record.token, record.strategy);
  const buf = getOrCreateBuffer(key);
  buf.push({ ...record, timestamp: record.timestamp || Date.now() });
  maybeCleanup();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getRecentSignals(token: string, strategy: string, limit = 10): SignalRecord[] {
  const key = makeKey(token, strategy);
  const buf = historyMap.get(key);
  if (!buf) return [];
  return buf.slice(limit);
}

export function computeStats(token: string, strategy: string, window = 6): SignalStats {
  const recent = getRecentSignals(token, strategy, window);
  if (recent.length === 0) {
    return { buy: 0, sell: 0, hold: 0, total: 0, avgConfidence: 50, trend: "mixed/neutral", lastSignal: null };
  }

  const buy  = recent.filter(r => r.signal === "BUY").length;
  const sell = recent.filter(r => r.signal === "SELL").length;
  const hold = recent.filter(r => r.signal === "HOLD").length;
  const total = recent.length;
  const avgConfidence = Math.round(recent.reduce((s, r) => s + r.confidence, 0) / total);

  const trend: SignalStats["trend"] =
    buy > sell && buy > hold  ? "persistent BUY"  :
    sell > buy && sell > hold ? "persistent SELL"  :
    "mixed/neutral";

  return {
    buy, sell, hold, total, avgConfidence, trend,
    lastSignal: recent[0] ?? null, // newest is at index 0 (slice reads newest first)
  };
}

// ─── AI context builder ───────────────────────────────────────────────────────

export function buildSignalContext(token: string, strategy: string): string {
  const stats = computeStats(token, strategy, 6);
  if (stats.total < 2) return "";

  const last = stats.lastSignal!;
  const minAgo = Math.round((Date.now() - last.timestamp) / 60000);
  const ageLabel = minAgo < 60
    ? `${minAgo}m ago`
    : `${Math.round(minAgo / 60)}h ago`;

  return (
    `SIGNAL HISTORY (last ${stats.total} signals): ` +
    `BUY=${stats.buy}, SELL=${stats.sell}, HOLD=${stats.hold} — ${stats.trend}. ` +
    `Avg confidence: ${stats.avgConfidence}%. ` +
    `Last: ${last.signal} @ ${ageLabel} (${last.engine}, conf ${last.confidence}%).`
  );
}

// ─── Confidence calibration ───────────────────────────────────────────────────

export function calibrateConfidence(
  base: number,
  newSignal: "BUY" | "SELL" | "HOLD",
  token: string,
  strategy: string,
): number {
  const recent = getRecentSignals(token, strategy, 5);
  if (recent.length < 3) return base;

  const agreeing = recent.filter(r => r.signal === newSignal).length;
  const agreementRate = agreeing / recent.length;

  if (agreementRate >= 0.8) return Math.min(95, base + 6);
  if (agreementRate <= 0.2) return Math.max(25, base - 8);
  return base;
}
