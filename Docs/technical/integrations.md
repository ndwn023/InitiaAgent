# Integrations

InitiaAgent integrates with several external systems across the Initia ecosystem and beyond.

## InterwovenKit

**Package:** `@initia/interwovenkit-react`

InterwovenKit provides wallet connectivity and session management for the Initia ecosystem.

### Usage in InitiaAgent

- **Wallet connection** — connect to Initia-compatible wallets
- **Session UX / Ghost Wallet** — auto-signing for pre-approved message types
- **Chain management** — switching between Initia networks
- **Testnet configuration** — connects to `TESTNET` environment

### Auto-Signing Configuration

```typescript
// Approved message types for auto-signing
"/minievm.evm.v1.MsgCall"      // EVM contract calls
"/cosmos.bank.v1beta1.MsgSend" // Token transfers
```

## ICosmos Precompile

**Address:** `0x00000000000000000000000000000000000000f1`

The Initia Cosmos precompile enables EVM contracts to execute Cosmos SDK messages.

### Functions Used

| Function | Purpose |
|---|---|
| `execute_cosmos(msg)` | Execute a JSON-encoded Cosmos SDK message |
| `to_denom(erc20Address)` | Convert ERC-20 address to Cosmos IBC denom |
| `to_erc20(denom)` | Convert Cosmos denom to ERC-20 address |

### Swap Message Format

The `InitiaDEXAdapter` constructs a JSON-encoded `MsgSwap` for the Initia DEX module:

```json
{
  "@type": "/initia.dex.v1.MsgSwap",
  "sender": "<adapter_address>",
  "offer_coin": {
    "denom": "<cosmos_denom>",
    "amount": "<amount>"
  },
  "ask_denom": "<target_cosmos_denom>",
  "receiver": "<vault_address>"
}
```

## Wagmi + Viem

**Packages:** `wagmi@2.17.2`, `viem@2.47.6`

### Chain Configuration

```typescript
const evm1 = defineChain({
  id: 2124225178762456,
  name: "Initia evm-1",
  nativeCurrency: { name: "INIT", symbol: "INIT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz"]
    }
  }
})
```

### Contract Interactions

Wagmi hooks are used for all contract reads and writes:
- `useReadContract` — read vault balances, share counts, agent info
- `useWriteContract` — deposit, withdraw, approve, executeSwap
- `useSwitchChain` — ensure user is on evm-1 before transactions

## AI Model Cascade

InitiaAgent routes every AI request through a multi-model waterfall. The backend (`Express.js`) tries each model in order until one succeeds.

```
1. claude-sonnet-4-6     (Anthropic)  ← primary — best reasoning
2. gemini-2.5-flash      (Google)     ← fast fallback
3. claude-haiku-4-5      (Anthropic)  ← fast Anthropic fallback
4. gemini-2.5-pro        (Google)     ← deep fallback
5. Claude CLI (stdin)                 ← last resort, no API key required
```

### Anthropic Claude

**Package:** `@anthropic-ai/sdk`

| Model | Role |
|---|---|
| `claude-sonnet-4-6` | Primary — market analysis, chat, strategy optimization |
| `claude-haiku-4-5-20251001` | Fast Anthropic fallback |

Features enabled:
- **Adaptive thinking** — auto-enabled on Opus/Sonnet 4.6 for complex analysis
- **Prompt caching** — `cache_control` on system block reduces latency on repeat calls
- **SSE streaming** — real-time chat responses via `generateStream()`

### Google Gemini

**Package:** `@google/genai`

| Model | Role |
|---|---|
| `gemini-2.5-flash` | First Gemini fallback |
| `gemini-2.5-pro` | Deep analysis fallback |

### Claude CLI (stdin)

Last-resort fallback that pipes prompts via `stdin` to the `claude` CLI. Used when no API keys are available. Avoids the `ENAMETOOLONG` / `uv_spawn` error on Windows by never passing prompts as CLI arguments.

### Agent Skills (Backend API Endpoints)

| Endpoint | Description |
|---|---|
| `POST /api/agent/analyze` | Market analysis → BUY/SELL/HOLD signal |
| `POST /api/agent/chat` | Conversational portfolio strategist |
| `POST /api/agent/execute` | Simulated trade execution with real prices |
| `POST /api/agent/lp-fee` | LP fee calculation from live CoinGecko volume |
| `POST /api/agent/consensus` | Multi-model voting signal (all models vote, majority wins) |
| `POST /api/agent/optimize` | Strategy optimizer (take-profit, stop-loss, position sizing) |
| `POST /api/agent/risk` | Portfolio risk score 0–100 (concentration, smart contract, liquidity) |
| `POST /api/agent/epoch` | Epoch performance report with recommendations |

## Backend (Express.js)

**Port:** `4000` | **Package:** `express` + TypeScript

The backend is a standalone Express.js service that handles all AI, agent data, and analytics. The Next.js frontend proxies all `/api/*` requests to the backend via `next.config.ts` rewrites — no CORS, no duplication.

```typescript
// next.config.ts — all /api/* calls go to Express
async rewrites() {
  return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }]
}
```

## Neon PostgreSQL

**Package:** `@neondatabase/serverless`

Agent data is persisted in a Neon serverless PostgreSQL database. The backend gracefully degrades to in-memory state if `DATABASE_URL` is not set.

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

## Price Feeds

### CoinGecko (Primary)

Free API for token prices and 24-hour changes. Covers: ETH, BTC, SOL, ATOM, TIA, USDC, INIT.

### Pyth Network (Fallback)

Hermes API endpoint for high-fidelity price data with confidence intervals and EMA values. Used when CoinGecko is unavailable.

### Fallback Chain

```mermaid
flowchart LR
    CG["CoinGecko API"] -->|"success"| OK["Price Data"]
    CG -->|"fail"| PY["Pyth Network\n(Hermes API)"]
    PY -->|"success"| OK
    PY -->|"fail"| FB["Hardcoded\nDefaults"]
    FB --> OK

    style CG fill:#1a4d2e,stroke:#22c55e,color:#fff
    style PY fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style FB fill:#5c3d1a,stroke:#f59e0b,color:#fff
```

## Initia.js

**Package:** `@initia/initia.js`

Initia SDK for direct interaction with Initia L1 and L2 chains. Available for Cosmos-level operations beyond what EVM provides.
