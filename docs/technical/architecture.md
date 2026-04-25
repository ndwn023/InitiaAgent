# Architecture

## System Overview

InitiaAgent is composed of four smart contracts on Initia evm-1, a Next.js frontend, and off-chain AI runners.

```mermaid
graph TD
    FE["Frontend (Next.js + Wagmi + InterwovenKit)"]

    FE -->|"deposit / withdraw"| V["AgentVault\n(Funds + Shares)"]
    FE -->|"executeSwap"| E["AgentExecutor\n(Trade Gateway)"]
    FE -->|"distributeProfit"| PS["ProfitSplitter\n(Epoch Distribution)"]

    E -->|"approveForTrade"| V
    E -->|"swap via ICosmos"| DEX["InitiaDEX\n(Cosmos Precompile 0x...f1)"]
    DEX -->|"returns assets"| V
    E -->|"updateVolume"| R["AgentRegistry\n(Agent Directory)"]

    PS -->|"snapshotValue"| V
    PS -->|"protocol fee"| T["Protocol Treasury"]
    PS -->|"creator share"| C["Creator Wallet"]

    style V fill:#1a4d2e,stroke:#22c55e,color:#fff
    style E fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style PS fill:#5c1a1a,stroke:#ef4444,color:#fff
    style DEX fill:#5c3d1a,stroke:#f59e0b,color:#fff
    style R fill:#1a4d4d,stroke:#06b6d4,color:#fff
    style FE fill:#1e3a5f,stroke:#4a9eed,color:#fff
    style T fill:#5c3d1a,stroke:#f59e0b,color:#fff
    style C fill:#1a4d4d,stroke:#06b6d4,color:#fff
```

## Contract Interactions

### Trade Execution Flow

```mermaid
sequenceDiagram
    participant R as Runner (AI Bot)
    participant E as AgentExecutor
    participant V as AgentVault
    participant D as InitiaDEX
    participant Reg as AgentRegistry

    R->>E: executeSwap()
    E->>V: approveForTrade()
    Note over V: Validate cooldown + size
    V-->>E: Approved
    E->>V: Pull tokenIn
    E->>D: swap() via ICosmos
    D-->>V: Send tokenOut
    E->>V: reconcileAssets()
    E->>Reg: updateVolumeTraded()
```

### Profit Distribution Flow

```mermaid
sequenceDiagram
    participant A as Anyone
    participant PS as ProfitSplitter
    participant V as AgentVault
    participant T as Treasury
    participant C as Creator

    A->>PS: distributeProfit(agentId)
    PS->>V: snapshotValue()
    V-->>PS: currentValue
    Note over PS: Compute grossProfit, fees, shares
    PS->>V: withdrawForSplitter() → Treasury
    V-->>T: Protocol Fee (2%)
    PS->>V: withdrawForSplitter() → Creator
    V-->>C: Creator Share (20%)
    Note over V: 78% stays in vault
    PS->>V: reconcileAssets()
```

## Frontend Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Animations | Framer Motion |
| Charts | Recharts |
| Web3 | Wagmi 2.17, Viem 2.47 |
| Wallet | InterwovenKit (`@initia/interwovenkit-react`) |
| AI | Google Gemini (`@google/genai`) |
| State | React Query, React hooks, localStorage |

### Route Structure

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/app/marketplace` | Browse and subscribe to agents |
| `/app/builder` | Create and deploy new agents |
| `/app/dashboard` | Monitor portfolio, agents, and AI activity |
| `/docs` | Technical documentation viewer |

### API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agents` | GET | List all registered agents |
| `/api/agents` | POST | Create a new agent |
| `/api/agents/[id]` | DELETE | Remove an agent |
| `/api/agent/analyze` | POST | AI market analysis (signal, confidence, reasoning) |
| `/api/agent/chat` | POST | AI chat assistant with portfolio context |

### Data Flow

```mermaid
flowchart LR
    U["User Action"] --> W["Wagmi Hook"]
    W --> SC["Smart Contract"]
    SC --> EV["Event Emitted"]
    EV --> UI["Frontend Updates UI"]
    SC --> RQ["React Query Cache"]
    RQ --> UI
```

Agent metadata is persisted server-side in `/data/agents.json`. On-chain state (balances, shares, vault values) is read directly from contracts via Wagmi/Viem.

## AI Integration

The AI layer uses Google Gemini for two functions:

1. **Market Analysis** — analyzes strategy + market conditions → returns BUY/SELL/HOLD signal
2. **Chat Assistant** — conversational AI with portfolio context and live price data

Price data is sourced from CoinGecko (primary) and Pyth Network (fallback), covering ETH, BTC, SOL, ATOM, TIA, USDC, and INIT.

Model fallback chain: `gemini-3-flash-preview` → `gemini-2.0-flash` → simulation mode.
