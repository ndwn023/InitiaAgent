# InitiaAgent

> [!IMPORTANT]
> **NON-COMMERCIAL HACKATHON PROJECT** — This repository is submitted exclusively for the **INITIATE Season 1 Hackathon** (Initia x DoraHacks). It is an educational and competitive submission only. No real funds are involved. Not intended for commercial use.

> **Non-custodial AI trading agent marketplace on Initia EVM** — creators deploy automated strategies, subscribers earn yield, and smart contracts guarantee that no one can ever touch your principal.

[![Hackathon](https://img.shields.io/badge/Hackathon-INITIATE_S1-4a9eed)](https://dorahacks.io/hackathon/initia)
[![Network](https://img.shields.io/badge/Network-Initia_evm--1-22c55e)](https://scan.testnet.initia.xyz/evm-1)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-8b5cf6)](https://soliditylang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-1e1e1e)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Overview

InitiaAgent lets anyone deploy an AI-powered trading strategy on Initia's EVM L2. Subscribers fund a non-custodial vault; the AI agent trades on their behalf. Profits are distributed automatically each epoch. The core security guarantee — **creators can never access subscriber funds** — is enforced entirely at the smart contract level.

## Repository Structure

```
InitiaAgent/                 ← npm workspace root
├── package.json             ← root scripts + concurrently orchestration
├── .env.example             ← unified env template
├── frontend/                ← Next.js 16 app (App Router · Tailwind · wagmi)
├── backend/                 ← Express.js REST API (TypeScript · standalone)
├── contracts/               ← Solidity smart contracts (Foundry)
└── docs/                    ← Project documentation
```

## Quick Start

```bash
# 1. Clone
git clone https://github.com/initiatiHacksUKDW/InitiaAgent.git
cd InitiaAgent

# 2. Install all dependencies (frontend + backend) at once
npm install

# 3. Set up environment variables
cp .env.example frontend/.env.local
cp .env.example backend/.env
# → Fill in ANTHROPIC_API_KEY, GEMINI_API_KEY, DATABASE_URL

# 4. Run frontend + backend together
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |

## Scripts (run from root)

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Run frontend + backend simultaneously |
| `npm run build` | Build backend (TS→JS) then frontend (Next.js) |
| `npm run start` | Run production builds together |
| `npm run dev:be` | Backend only → localhost:4000 |
| `npm run dev:fe` | Frontend only → localhost:3000 |
| `npm run typecheck` | TypeScript check (backend) |
| `npm run lint` | ESLint (frontend) |
| `npm run contracts:build` | `forge build` (requires Foundry) |
| `npm run contracts:test` | `forge test --summary` |

> `npm run dev` uses `concurrently` with `--kill-others-on-fail` — if either service crashes, both stop together.

## AI Model Cascade

Every AI request automatically falls back to the next available model:

```
1. Anthropic Claude Sonnet 4.6      ← primary (best reasoning)
2. Google Gemini 2.5 Flash          ← fast fallback
3. Anthropic Claude Haiku 4.5       ← fast Anthropic fallback
4. Google Gemini 2.5 Pro            ← deep fallback
5. Claude CLI (stdin pipe)           ← last resort, no API key required
```

> **Claude CLI** writes the prompt to `stdin` — never passed as a CLI argument. This prevents the `ENAMETOOLONG` / `uv_spawn` error that occurs when the OS argument limit (~128 KB on Windows) is exceeded.

## Agent Skills

| Endpoint | Description |
|----------|-------------|
| `POST /api/agent/analyze?mode=rules\|ai` | Market analysis (rule-based or AI-powered) |
| `POST /api/agent/chat` | Conversational AI portfolio strategist |
| `POST /api/agent/execute` | Simulated trade execution with real prices |
| `POST /api/agent/lp-fee` | LP fee calculation from live CoinGecko volume |
| `POST /api/agent/consensus` | **Multi-model voting signal** (all models vote, majority wins) |
| `POST /api/agent/optimize` | **Strategy optimizer** (take-profit, stop-loss, position sizing) |
| `POST /api/agent/risk` | **Portfolio risk score 0–100** (concentration, smart contract, liquidity) |
| `POST /api/agent/epoch` | **Epoch performance report** with recommendations |

## Smart Contracts

Deployed on **Initia evm-1** (MiniEVM L2):

| Contract | Description |
|----------|-------------|
| `AgentRegistry` | Registers agent strategies and manages subscriptions |
| `AgentVault` | Non-custodial vault — creator can never withdraw subscriber funds |
| `AgentExecutor` | Executes trades on behalf of agents |
| `ProfitSplitter` | Distributes epoch profits between creator and subscribers |

## Tech Stack

| Layer | Tech |
|-------|------|
| Smart Contracts | Solidity 0.8.24 · Foundry · OpenZeppelin |
| Frontend | Next.js 16 · React 19 · Tailwind CSS · wagmi · viem |
| Backend | Express.js · TypeScript · ts-node-dev |
| AI | Anthropic Claude · Google Gemini · Claude CLI |
| Database | Neon serverless PostgreSQL |
| Prices | CoinGecko multi-asset feed + market regime summary (with fallback) |

## Environment Variables

Copy `.env.example` to both `frontend/.env.local` and `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# AI (at least one required; Claude CLI works without any key)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Frontend (Next.js public vars)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional: custom API origin (without trailing /api)
# NEXT_PUBLIC_API_URL=http://localhost:4000

# Backend
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

## Hackathon

Built for **INITIATE Season 1** by Initia × DoraHacks.
