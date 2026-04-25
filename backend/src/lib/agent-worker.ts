import { getActiveAgents, StoredAgent } from "./agent-store";
import { batchGetDashboardStates, upsertDashboardState } from "./dashboard-store";
import { fetchPrices, MarketSnapshot } from "./price-feed";
import { analyzeMarketRules } from "./market-analyzer";
import { getAgentIntervalMs } from "@initia-agent/shared";
import {
  computeTradeExecution,
  computeProtocolFee,
  readAgentMetrics,
  writeAgentMetrics,
  entryPriceKey,
  isAgentCostBasisKey,
  MIN_TRADE_COOLDOWN_MS,
  MAX_TRADE_SIZE_PCT,
  DEFAULT_TRADE_SIZE_PCT,
  type PersistedDashboardState,
} from "@initia-agent/shared";

const lastRunAt: Record<string, number> = {};
let tickInFlight = false;

function getOwnerKey(agent: StoredAgent): string {
  return agent.creatorAddress?.toLowerCase() ?? "system";
}

async function runAgentCycle(
  agent: StoredAgent,
  ownerAgents: StoredAgent[],
  initPrice: number,
  snapshot: MarketSnapshot,
  state: PersistedDashboardState | null,
): Promise<PersistedDashboardState> {
  const base  = "INIT";
  const quote = agent.target === "USDC" ? "USDC" : "INIT";
  const owner = getOwnerKey(agent);
  const baseKey  = `${agent.id}_${base}`;
  const quoteKey = `${agent.id}_${quote}`;
  const entryKey = entryPriceKey(agent.id);

  const remainingBalance: Record<string, number> = { ...(state?.remainingBalance ?? {}) };
  const costBasis: Record<string, number>        = { ...(state?.costBasis ?? {}) };
  const lastAnalysisAt: Record<string, number>   = { ...(state?.lastAnalysisAt ?? {}) };
  const logs: unknown[] = Array.isArray(state?.logs) ? [...state!.logs] : [];
  const metrics = readAgentMetrics(costBasis);

  if (remainingBalance[baseKey] == null) {
    const capital = agent.initialCapital || 100;
    if (quote === "USDC") {
      remainingBalance[baseKey]  = capital * 0.5;
      remainingBalance[quoteKey] = capital * 0.5 * initPrice;
      costBasis[entryKey]        = initPrice;
    } else {
      remainingBalance[baseKey]  = capital;
      remainingBalance[quoteKey] = 0;
    }
    costBasis[agent.id] = capital;
  }

  const baseBal  = remainingBalance[baseKey]  ?? 0;
  const quoteBal = remainingBalance[quoteKey] ?? 0;

  const analysis = analyzeMarketRules(
    agent.strategy,
    { targetToken: base, pool: agent.pool, protocol: agent.protocol, vault: agent.vault, capital: agent.initialCapital, interval: agent.interval },
    snapshot,
  );

  const requestedPct  = agent.tradeSizePct ?? DEFAULT_TRADE_SIZE_PCT;
  const tradeSizePct  = Math.min(requestedPct, MAX_TRADE_SIZE_PCT) / 100;
  const minConfidence = agent.minConfidence ?? 50;

  let newBase   = baseBal;
  let newQuote  = quoteBal;
  let action    = "HOLD";
  let feeThisTrade = 0;
  let realizedThisTrade = 0;
  let isWin = false;
  let didTrade = false;

  if (analysis.confidence >= minConfidence) {
    if (analysis.signal === "BUY" && quoteBal > 0.001 && quote !== base) {
      const tradeUsdc = quoteBal * tradeSizePct;
      const exec = computeTradeExecution({
        amountIn: tradeUsdc,
        fromPriceUsd: 1,
        toPriceUsd: initPrice,
        confidence: analysis.confidence,
        strategy: agent.strategy,
      });

      newQuote = quoteBal - tradeUsdc;
      newBase  = baseBal  + exec.amountOut;
      feeThisTrade = exec.executionFee / initPrice;

      const existingInit   = baseBal;
      const existingEntry  = costBasis[entryKey] || initPrice;
      const blendedEntry   = existingInit + exec.amountOut > 0
        ? (existingInit * existingEntry + exec.amountOut * initPrice) / (existingInit + exec.amountOut)
        : initPrice;
      costBasis[entryKey] = blendedEntry;

      didTrade = true;
      action = `BUY ${exec.amountOut.toFixed(4)} INIT @ $${initPrice.toFixed(4)} (fee ${(exec.executionFee).toFixed(4)} USDC)`;
    }
    else if (analysis.signal === "SELL" && baseBal > 0.001 && quote !== base) {
      const tradeInit = baseBal * tradeSizePct;
      const exec = computeTradeExecution({
        amountIn: tradeInit,
        fromPriceUsd: initPrice,
        toPriceUsd: 1,
        confidence: analysis.confidence,
        strategy: agent.strategy,
      });

      newBase  = baseBal  - tradeInit;
      newQuote = quoteBal + exec.amountOut;
      feeThisTrade = exec.executionFee;

      const entryPrice = costBasis[entryKey] || initPrice;
      realizedThisTrade = (initPrice - entryPrice) * tradeInit;
      isWin = realizedThisTrade > 0;

      const protocolSkim = computeProtocolFee(realizedThisTrade);
      if (protocolSkim > 0) {
        newQuote -= protocolSkim;
        metrics.protocolFee += protocolSkim / initPrice;
        metrics.feesPaid    += protocolSkim / initPrice;
      }

      didTrade = true;
      action = `SELL ${tradeInit.toFixed(4)} INIT @ $${initPrice.toFixed(4)} (fee ${exec.executionFee.toFixed(4)} INIT, PnL ${realizedThisTrade >= 0 ? "+" : ""}${realizedThisTrade.toFixed(3)} USDC)`;
    }
    else if (quote === base && analysis.confidence >= minConfidence && analysis.signal !== "HOLD") {
      action = `HOLD ${analysis.signal} bias — yield position`;
    }
  }

  if (didTrade) {
    metrics.tradesExecuted += 1;
    metrics.feesPaid        += feeThisTrade;
    metrics.realizedProfit  += realizedThisTrade / Math.max(initPrice, 0.0001);
    if (isWin) metrics.winningTrades += 1;
  }

  remainingBalance[baseKey]  = newBase;
  remainingBalance[quoteKey] = newQuote;
  lastAnalysisAt[agent.id]   = Date.now();

  let totalPortfolio = 0;
  for (const a of ownerAgents) {
    const bk = `${a.id}_INIT`;
    const qk = `${a.id}_${a.target === "USDC" ? "USDC" : "INIT"}`;
    const b  = remainingBalance[bk] ?? (a.initialCapital || 0);
    const q  = remainingBalance[qk] ?? 0;
    totalPortfolio += b + (a.target === "USDC" ? q / initPrice : q);
  }

  const totalInitial = ownerAgents.reduce((s, a) => {
    const cb = costBasis[a.id];
    if (cb != null && isAgentCostBasisKey(a.id)) return s + cb;
    return s + (a.initialCapital || 0);
  }, 0);

  const totalProfit  = totalPortfolio - totalInitial;

  metrics.grossProfit = totalProfit + metrics.feesPaid;
  metrics.netProfit   = totalProfit;
  writeAgentMetrics(costBasis, metrics);

  const now = Date.now();
  const logEntry = {
    id:         now,
    timestamp:  now,
    time:       new Date().toLocaleTimeString(),
    agent:      agent.name,
    action,
    amount:     analysis.signal !== "HOLD" ? action : "HOLD",
    type:       analysis.signal === "BUY" ? "buy" : analysis.signal === "SELL" ? "sell" : "neutral",
    signal:     analysis.signal,
    reasoning:  analysis.reasoning,
    source:     "worker",
    feeInit:    feeThisTrade,
    realizedPnlUsdc: realizedThisTrade,
  };
  const newLogs = [logEntry, ...logs].slice(0, 50);

  const savedState = await upsertDashboardState({
    ownerAddress:    owner,
    livePortfolio:   totalPortfolio,
    liveProfit:      totalProfit,
    executionCount:  (state?.executionCount ?? 0) + 1,
    remainingBalance,
    costBasis,
    lastAnalysisAt,
    logs:            newLogs,
    source:          "worker",
  });

  const winPct = metrics.tradesExecuted > 0
    ? ((metrics.winningTrades / metrics.tradesExecuted) * 100).toFixed(1)
    : "—";
  console.log(
    `[worker] ${agent.name} → ${analysis.signal} (${analysis.confidence}%) | ${action} | ` +
    `portfolio ${totalPortfolio.toFixed(2)} INIT | net ${totalProfit.toFixed(3)} INIT | ` +
    `fees ${metrics.feesPaid.toFixed(3)} INIT | trades ${metrics.tradesExecuted} (${winPct}% win)`,
  );
  return savedState;
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;

  try {
    const agents = await getActiveAgents();
    const now    = Date.now();

    const dueAgents = agents.filter(agent => {
      const intervalMs = Math.max(getAgentIntervalMs(agent.interval), MIN_TRADE_COOLDOWN_MS);
      const last = lastRunAt[agent.id] ?? 0;
      return now - last >= intervalMs;
    });

    if (dueAgents.length === 0) return;

    for (const agent of dueAgents) {
      lastRunAt[agent.id] = now;
    }

    const priceSnapshot = await fetchPrices();
    const initPrice = priceSnapshot.prices.find(p => p.symbol.startsWith("INIT"))?.price ?? 1;

    const ownerAgentsByOwner = new Map<string, StoredAgent[]>();
    for (const agent of agents) {
      const owner = getOwnerKey(agent);
      const list = ownerAgentsByOwner.get(owner);
      if (list) {
        list.push(agent);
      } else {
        ownerAgentsByOwner.set(owner, [agent]);
      }
    }

    const uniqueOwners = [...new Set(dueAgents.map(getOwnerKey))];
    const states = await batchGetDashboardStates(uniqueOwners);

    const dueAgentsByOwner = new Map<string, StoredAgent[]>();
    for (const agent of dueAgents) {
      const owner = getOwnerKey(agent);
      const list = dueAgentsByOwner.get(owner);
      if (list) {
        list.push(agent);
      } else {
        dueAgentsByOwner.set(owner, [agent]);
      }
    }

    const results = await Promise.allSettled(
      [...dueAgentsByOwner.entries()].map(async ([owner, ownerDueAgents]) => {
        const ownerAgents = ownerAgentsByOwner.get(owner) ?? ownerDueAgents;
        let ownerState = states.get(owner) ?? null;

        for (const agent of ownerDueAgents) {
          ownerState = await runAgentCycle(
            agent,
            ownerAgents,
            initPrice,
            priceSnapshot,
            ownerState,
          );
        }
      }),
    );

    const owners = [...dueAgentsByOwner.keys()];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(`[worker] ${owners[i]} batch error:`, result.reason?.message || result.reason);
      }
    });
  } catch (err) {
    console.error("[worker] tick error:", (err as Error).message);
  } finally {
    tickInFlight = false;
  }
}

export function startAgentWorker(): void {
  console.log(`   Worker     \x1b[32m✓\x1b[0m  agent runner (15s poll)`);
  tick();
  setInterval(tick, 15_000);
}
