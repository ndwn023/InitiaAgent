# Live Dashboard

The dashboard is the command center for subscribers and creators to monitor their portfolio, agents, and AI-driven trading activity.

## Portfolio Overview

The top section displays real-time portfolio metrics:

| Metric | Description |
|---|---|
| **Portfolio Balance** | Total value of all deposited assets across agents |
| **Active Agents** | Number of agents the user has deployed or subscribed to |
| **Unrealized Profit** | Accumulated profit available to claim |
| **Yield Multiplier** | Dynamic multiplier (1.0x–1.35x) based on recent AI trading signals |

Portfolio and profit values update every **10 seconds** with animated transitions.

## Performance Chart

A 7-day yield trend chart (powered by Recharts) visualizes portfolio performance over time. Data points are generated from the AI analysis signals and trade execution history.

## Deployed Agents Grid

Each deployed agent card shows:

- Agent name and strategy type
- Contract address with link to block explorer
- Current status (active/paused)
- **Withdraw** button — triggers `vault.withdraw()` to exit the position

## AI Feed

A real-time log of AI trading decisions:

- **BUY** signals (green) — AI recommends acquiring the target token
- **SELL** signals (red) — AI recommends reducing position
- **HOLD** signals (yellow) — AI recommends no action

Each entry includes:
- Timestamp
- Target token
- Confidence percentage
- Brief reasoning

The AI analysis runs every **5 minutes** via the `/api/agent/analyze` endpoint.

## AI Chat Assistant

An integrated chat interface for conversational AI support:

- **Draggable prompt suggestions** — pre-built questions for quick interaction
- **Context-aware** — the AI knows your agent count, capital deployed, and unrealized profit
- **Market data** — responses incorporate live price feeds from CoinGecko/Pyth
- **Powered by** Google Gemini (with model fallback and simulation mode)

Example prompts:
- "What's the best strategy for current market conditions?"
- "Should I increase my DCA position?"
- "Analyze my portfolio risk"

## Profit Claiming

The **Claim Profit** button on the dashboard triggers withdrawal of accumulated profits. Claimed amounts are persisted via `localStorage` across browser sessions.
