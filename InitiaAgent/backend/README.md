# InitiaAgent — Backend API

Standalone Express.js + TypeScript REST API. Multi-model AI cascade with automatic fallback.

## AI Model Cascade

```
Anthropic Claude (claude-sonnet-4-6)   ← primary (best reasoning)
  ↓ fallback
Google Gemini (gemini-2.5-flash)       ← fast, capable
  ↓ fallback
Anthropic Claude Haiku                 ← fast fallback
  ↓ fallback
Google Gemini Pro                      ← deep fallback
  ↓ last resort
Claude CLI (stdin pipe)                ← local, no API key needed
```

**Claude CLI uses stdin piping to avoid `ENAMETOOLONG` / `uv_spawn` errors.**
The prompt is NEVER passed as a CLI argument — always written to `proc.stdin`.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Neon PostgreSQL (falls back to local JSON)
- **AI**: Anthropic SDK + Google Gemini SDK + Claude CLI
- **Prices**: CoinGecko (with fallback)

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY
npm run dev        # → http://localhost:4000
```

## API Reference

### Core routes (mirror Next.js API)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + model availability |
| GET | `/api/agents` | List all agents (marketplace) |
| POST | `/api/agents` | Create new agent |
| DELETE | `/api/agents/:id` | Remove agent + close subscriptions |
| PATCH | `/api/agents/:id` | Update agent fields |
| POST | `/api/agent/analyze` | Market analysis (`?mode=rules\|ai`) |
| POST | `/api/agent/execute` | Simulate trade execution |
| POST | `/api/agent/chat` | AI chat (portfolio strategist) |
| POST | `/api/agent/lp-fee` | LP fee from live volume |
| GET | `/api/dashboard-state` | Load dashboard (`?ownerAddress=`) |
| POST | `/api/dashboard-state` | Save dashboard state |

### Extended agent skills

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/consensus` | Multi-model voting signal |
| POST | `/api/agent/optimize` | Strategy optimizer |
| POST | `/api/agent/risk` | Portfolio risk assessment (0-100) |
| POST | `/api/agent/epoch` | Epoch performance report |

### Model selection

Add `"model": "claude-sonnet-4-6"` (or any model ID) to any AI request body to prefer that model. The cascade handles fallback automatically.

```bash
# Force Anthropic
curl -X POST localhost:4000/api/agent/analyze \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"DCA","model":"claude-opus-4-6"}'

# Multi-model consensus vote
curl -X POST localhost:4000/api/agent/consensus \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"DCA","targetToken":"INIT","capital":100}'

# Portfolio risk report
curl -X POST localhost:4000/api/agent/risk \
  -H 'Content-Type: application/json' \
  -d '{"ownerAddress":"0x123","agents":[{"name":"MyAgent","strategy":"DCA","contractAddress":"0xabc","initialCapital":100,"status":"Active"}]}'
```

## Scripts

```bash
npm run dev       # Dev with hot reload
npm run build     # Compile TypeScript
npm run start     # Run compiled build
npm run typecheck # Type-check only
```
