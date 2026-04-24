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

export interface MarketSnapshot {
  prices: PriceData[];
  timestamp: number;
  source: "coingecko" | "pyth" | "fallback";
}

const COINGECKO_IDS: Record<string, string> = {
  "USDC/USD": "usd-coin",
  "INIT/USD": "initia",
};

let cachedSnapshot: MarketSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

export async function fetchPrices(): Promise<MarketSnapshot> {
  if (cachedSnapshot && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSnapshot;
  }

  try {
    const result = await fetchFromCoinGecko();
    cachedSnapshot = result;
    cacheTimestamp = Date.now();
    return result;
  } catch (err) {
    console.warn("CoinGecko fetch failed:", err);
  }

  if (cachedSnapshot) return cachedSnapshot;
  return getFallbackPrices();
}

async function fetchFromCoinGecko(): Promise<MarketSnapshot> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

  const response = await fetch(url);
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
  return { prices, timestamp: Date.now(), source: "coingecko" };
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
