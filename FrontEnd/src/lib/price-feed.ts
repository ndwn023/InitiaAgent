/**
 * Real-time price feed using CoinGecko (primary) and Pyth Network (backup).
 * Both are free and require no API key.
 */

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  emaPrice: number;
  change24h?: number;
  volume24h?: number;      // 24h trading volume in USD
  marketCap?: number;      // market cap in USD
  high24h?: number;        // 24h high
  low24h?: number;         // 24h low
}

export interface MarketSnapshot {
  prices: PriceData[];
  timestamp: number;
  source: "coingecko" | "pyth" | "fallback";
}

// CoinGecko token IDs
const COINGECKO_IDS: Record<string, string> = {
  "USDC/USD": "usd-coin",
  "INIT/USD": "initia",
};

// Cache to avoid rate limiting (CoinGecko 429 errors)
let cachedSnapshot: MarketSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // Cache for 60 seconds

export async function fetchPrices(): Promise<MarketSnapshot> {
  // Return cached data if still fresh
  if (cachedSnapshot && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSnapshot;
  }

  // Try CoinGecko first (most reliable, no encoding issues)
  try {
    const result = await fetchFromCoinGecko();
    cachedSnapshot = result;
    cacheTimestamp = Date.now();
    return result;
  } catch (err) {
    console.warn("CoinGecko fetch failed, trying Pyth:", err);
  }

  // Try Pyth as backup
  try {
    const result = await fetchFromPyth();
    cachedSnapshot = result;
    cacheTimestamp = Date.now();
    return result;
  } catch (err) {
    console.warn("Pyth fetch also failed:", err);
  }

  // Return stale cache if available
  if (cachedSnapshot) return cachedSnapshot;

  // Ultimate fallback
  return getFallbackPrices();
}

async function fetchFromCoinGecko(): Promise<MarketSnapshot> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);

  const data = await response.json();
  const prices: PriceData[] = [];

  for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
    const tokenData = data[geckoId];
    if (tokenData?.usd !== undefined) {
      const price = tokenData.usd;
      const change24h = tokenData.usd_24h_change || 0;
      const volume24h = tokenData.usd_24h_vol || 0;
      const marketCap = tokenData.usd_market_cap || 0;
      // Approximate 24h high/low from price + change
      const prevPrice = price / (1 + change24h / 100);
      const high24h = Math.max(price, prevPrice) * 1.005;
      const low24h  = Math.min(price, prevPrice) * 0.995;
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

  return {
    prices,
    timestamp: Date.now(),
    source: "coingecko",
  };
}

// Pyth backup is intentionally disabled here because the app only needs
// mock INIT and mock USDC pricing, both of which are covered by CoinGecko
// or the local fallback snapshot below.
const PYTH_FEED_IDS: Record<string, string> = {};

async function fetchFromPyth(): Promise<MarketSnapshot> {
  const prices: PriceData[] = [];

  // Fetch individually to avoid URL encoding issues
  for (const [symbol, feedId] of Object.entries(PYTH_FEED_IDS)) {
    try {
      const res = await fetch(
        `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${feedId}`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (data.parsed?.[0]) {
        const p = data.parsed[0];
        const price = parseInt(p.price.price) * Math.pow(10, p.price.expo);
        const ema = parseInt(p.ema_price.price) * Math.pow(10, p.ema_price.expo);
        prices.push({
          symbol,
          price: Math.round(price * 100) / 100,
          confidence: Math.round(parseInt(p.price.conf) * Math.pow(10, p.price.expo) * 100) / 100,
          publishTime: p.price.publish_time,
          emaPrice: Math.round(ema * 100) / 100,
        });
      }
    } catch {
      continue;
    }
  }

  if (prices.length === 0) throw new Error("No Pyth prices fetched");

  return { prices, timestamp: Date.now(), source: "pyth" };
}

function getFallbackPrices(): MarketSnapshot {
  const now = Math.floor(Date.now() / 1000);
  return {
    prices: [
      { symbol: "USDC/USD", price: 1.0, confidence: 0.001, publishTime: now, emaPrice: 1.0 },
      { symbol: "INIT/USD", price: 1.20, confidence: 0.05, publishTime: now, emaPrice: 1.18 },
    ],
    timestamp: Date.now(),
    source: "fallback",
  };
}

/**
 * Format price data for the AI agent prompt.
 */
export function formatMarketContext(snapshot: MarketSnapshot): string {
  if (snapshot.prices.length === 0) return "No market data available.";

  const lines = snapshot.prices.map((p) => {
    const trend = p.price > p.emaPrice ? "↑ Above EMA (bullish)" : p.price < p.emaPrice ? "↓ Below EMA (bearish)" : "→ At EMA (neutral)";
    const changeStr = p.change24h !== undefined ? ` | 24h: ${p.change24h >= 0 ? "+" : ""}${p.change24h}%` : "";
    const volStr = p.volume24h ? ` | Vol: $${(p.volume24h / 1e6).toFixed(1)}M` : "";
    const rangeStr = (p.high24h && p.low24h) ? ` | Range: $${p.low24h}–$${p.high24h}` : "";
    return `  ${p.symbol}: $${p.price} | EMA: $${p.emaPrice} | ${trend}${changeStr}${volStr}${rangeStr}`;
  });

  return `LIVE MARKET DATA (${snapshot.source} · ${new Date(snapshot.timestamp).toUTCString()}):\n${lines.join("\n")}`;
}
