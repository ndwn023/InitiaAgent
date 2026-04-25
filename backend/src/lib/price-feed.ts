export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  emaPrice: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
}

export interface MarketRegime {
  breadthPct: number;       // % of risk assets with positive 24h return
  avgChange24h: number;     // average 24h return of risk assets
  volatilityProxyPct: number; // average intraday range %
  leaders: string[];        // top movers, e.g. ["INIT +4.2%", "SOL -3.1%"]
}

export interface MarketSnapshot {
  prices: PriceData[];
  timestamp: number;
  source: "coingecko" | "pyth" | "fallback";
  regime?: MarketRegime;
}

const COINGECKO_IDS: Record<string, string> = {
  "USDC/USD": "usd-coin",
  "INIT/USD": "initia",
  "BTC/USD": "bitcoin",
  "ETH/USD": "ethereum",
  "SOL/USD": "solana",
  "TIA/USD": "celestia",
};

let cachedSnapshot: MarketSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3 * 60 * 1000;        // 3 minutes normal TTL
const STALE_TTL  = 10 * 60 * 1000;      // 10 minutes when rate-limited
let rateLimitedUntil = 0;               // epoch ms — don't call API before this

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
// After CIRCUIT_FAIL_THRESHOLD consecutive failures, open the circuit for
// CIRCUIT_OPEN_MS milliseconds before allowing another attempt.
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000; // 60 seconds
let circuitFailures = 0;
let circuitOpenUntil = 0;

// ─── In-flight deduplication ──────────────────────────────────────────────────
// Prevents N concurrent callers from all firing separate CoinGecko requests.
let inflightFetch: Promise<MarketSnapshot> | null = null;

function getBaseSymbol(symbol: string): string {
  return symbol.split("/")[0]?.toUpperCase() || symbol.toUpperCase();
}

function isStableAsset(symbol: string): boolean {
  const base = getBaseSymbol(symbol);
  return base === "USDC" || base === "USDT" || base === "DAI";
}

function buildMarketRegime(prices: PriceData[]): MarketRegime {
  const riskAssets = prices.filter((p) => !isStableAsset(p.symbol));
  if (riskAssets.length === 0) {
    return { breadthPct: 50, avgChange24h: 0, volatilityProxyPct: 0, leaders: [] };
  }

  const risingCount = riskAssets.filter((p) => (p.change24h ?? 0) > 0).length;
  const breadthPct = Math.round((risingCount / riskAssets.length) * 100);

  const avgChange24h = Math.round(
    (riskAssets.reduce((sum, p) => sum + (p.change24h ?? 0), 0) / riskAssets.length) * 100
  ) / 100;

  const volatilityProxyPct = Math.round(
    (riskAssets.reduce((sum, p) => {
      if (p.price <= 0) return sum;
      if (p.high24h !== undefined && p.low24h !== undefined) {
        return sum + (((p.high24h - p.low24h) / p.price) * 100);
      }
      return sum + ((p.confidence / p.price) * 200);
    }, 0) / riskAssets.length) * 100
  ) / 100;

  const leaders = [...riskAssets]
    .sort((a, b) => Math.abs((b.change24h ?? 0)) - Math.abs((a.change24h ?? 0)))
    .slice(0, 3)
    .map((p) => `${getBaseSymbol(p.symbol)} ${(p.change24h ?? 0) >= 0 ? "+" : ""}${(p.change24h ?? 0).toFixed(2)}%`);

  return { breadthPct, avgChange24h, volatilityProxyPct, leaders };
}

export async function fetchPrices(): Promise<MarketSnapshot> {
  const now = Date.now();

  // 1. Serve fresh cache
  if (cachedSnapshot && now - cacheTimestamp < CACHE_TTL) {
    return cachedSnapshot;
  }

  // 2. Skip API while rate-limited
  if (now < rateLimitedUntil) {
    if (cachedSnapshot) return cachedSnapshot;
    return getFallbackPrices();
  }

  // 3. Circuit breaker: open circuit on repeated failures
  if (circuitFailures >= CIRCUIT_FAIL_THRESHOLD && now < circuitOpenUntil) {
    console.warn(`[price-feed] Circuit open — using cache/fallback until ${new Date(circuitOpenUntil).toISOString()}`);
    if (cachedSnapshot) return cachedSnapshot;
    return getFallbackPrices();
  }

  // 4. In-flight deduplication: coalesce concurrent callers onto one request
  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = (async (): Promise<MarketSnapshot> => {
    try {
      const result = await fetchFromCoinGecko();
      cachedSnapshot = result;
      cacheTimestamp = Date.now();
      circuitFailures = 0; // reset on success
      return result;
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      console.warn("[price-feed] CoinGecko fetch failed:", msg.slice(0, 200));

      circuitFailures++;
      if (circuitFailures >= CIRCUIT_FAIL_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        console.warn(`[price-feed] Circuit opened after ${circuitFailures} failures`);
      }

      // 429: back off for 5 minutes with extended stale window
      if (msg.includes("429")) {
        rateLimitedUntil = Date.now() + 5 * 60 * 1000;
        console.warn(`[price-feed] Rate limited — pausing until ${new Date(rateLimitedUntil).toISOString()}`);
        if (cachedSnapshot && Date.now() - cacheTimestamp < STALE_TTL) {
          return cachedSnapshot;
        }
      }

      if (cachedSnapshot) return cachedSnapshot;
      return getFallbackPrices();
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

async function fetchFromCoinGecko(): Promise<MarketSnapshot> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);

  const data = await response.json() as Record<string, Record<string, number>>;
  const prices: PriceData[] = [];

  for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
    const tokenData = data[geckoId];
    if (tokenData?.usd !== undefined) {
      const price = tokenData.usd;
      const change24h = tokenData.usd_24h_change || 0;
      const volume24h = tokenData.usd_24h_vol || 0;
      const marketCap = tokenData.usd_market_cap || 0;
      const prevPrice = price / (1 + change24h / 100);
      const high24h = Math.max(price, prevPrice) * 1.005;
      const low24h = Math.min(price, prevPrice) * 0.995;
      prices.push({
        symbol,
        price: Math.round(price * 10000) / 10000,
        confidence: Math.round(price * 0.005 * 10000) / 10000,
        publishTime: Math.floor(Date.now() / 1000),
        emaPrice: Math.round(price * (1 - change24h / 100 / 2) * 10000) / 10000,
        change24h: Math.round(change24h * 100) / 100,
        volume24h: Math.round(volume24h),
        marketCap: Math.round(marketCap),
        high24h: Math.round(high24h * 10000) / 10000,
        low24h: Math.round(low24h * 10000) / 10000,
      });
    }
  }

  if (prices.length === 0) throw new Error("No prices from CoinGecko");
  return { prices, timestamp: Date.now(), source: "coingecko", regime: buildMarketRegime(prices) };
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackPrices(): MarketSnapshot {
  const now = Math.floor(Date.now() / 1000);
  const prices: PriceData[] = [
    { symbol: "USDC/USD", price: 1.0, confidence: 0.001, publishTime: now, emaPrice: 1.0, change24h: 0, volume24h: 0, marketCap: 0, high24h: 1.001, low24h: 0.999 },
    { symbol: "INIT/USD", price: 1.20, confidence: 0.05, publishTime: now, emaPrice: 1.18, change24h: 2.1, volume24h: 9_500_000, marketCap: 115_000_000, high24h: 1.26, low24h: 1.15 },
    { symbol: "BTC/USD", price: 68000, confidence: 350, publishTime: now, emaPrice: 67400, change24h: 1.3, volume24h: 18_000_000_000, marketCap: 1_340_000_000_000, high24h: 68950, low24h: 66880 },
    { symbol: "ETH/USD", price: 3200, confidence: 22, publishTime: now, emaPrice: 3165, change24h: 1.9, volume24h: 8_300_000_000, marketCap: 385_000_000_000, high24h: 3268, low24h: 3130 },
    { symbol: "SOL/USD", price: 145, confidence: 1.1, publishTime: now, emaPrice: 142.5, change24h: 3.4, volume24h: 2_400_000_000, marketCap: 71_000_000_000, high24h: 149.8, low24h: 139.5 },
    { symbol: "TIA/USD", price: 8.5, confidence: 0.09, publishTime: now, emaPrice: 8.3, change24h: 4.6, volume24h: 120_000_000, marketCap: 4_900_000_000, high24h: 8.8, low24h: 8.1 },
  ];

  return {
    prices,
    timestamp: Date.now(),
    source: "fallback",
    regime: buildMarketRegime(prices),
  };
}

export function formatMarketContext(snapshot: MarketSnapshot): string {
  if (snapshot.prices.length === 0) return "No market data available.";
  const regime = snapshot.regime ?? buildMarketRegime(snapshot.prices);

  const lines = snapshot.prices.map((p) => {
    const trend = p.price > p.emaPrice ? "↑ Above EMA (bullish)" : p.price < p.emaPrice ? "↓ Below EMA (bearish)" : "→ At EMA (neutral)";
    const changeStr = p.change24h !== undefined ? ` | 24h: ${p.change24h >= 0 ? "+" : ""}${p.change24h}%` : "";
    const volStr = p.volume24h ? ` | Vol: $${(p.volume24h / 1e6).toFixed(1)}M` : "";
    const rangeStr = (p.high24h && p.low24h) ? ` | Range: $${p.low24h}–$${p.high24h}` : "";
    return `  ${p.symbol}: $${p.price} | EMA: $${p.emaPrice} | ${trend}${changeStr}${volStr}${rangeStr}`;
  });

  const regimeLine = `REGIME: breadth ${regime.breadthPct}% | avg 24h ${regime.avgChange24h >= 0 ? "+" : ""}${regime.avgChange24h}% | intraday vol ${regime.volatilityProxyPct}%${regime.leaders.length ? ` | leaders: ${regime.leaders.join(", ")}` : ""}`;
  return `LIVE MARKET DATA (${snapshot.source} · ${new Date(snapshot.timestamp).toUTCString()}):\n${regimeLine}\n${lines.join("\n")}`;
}
