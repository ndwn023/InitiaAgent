# InitiaAgent

> Non-custodial AI trading agent marketplace on Initia EVM

[![Hackathon](https://img.shields.io/badge/Hackathon-INITIATE_S1-4a9eed)](https://dorahacks.io/hackathon/initia)
[![Network](https://img.shields.io/badge/Network-Initia_evm--1-22c55e)](https://scan.testnet.initia.xyz/evm-1)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-8b5cf6)](https://soliditylang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-1e1e1e)](https://nextjs.org)

---

## Initia Hackathon Submission

**Project Name:** InitiaAgent

**Project Overview:**
InitiaAgent is a non-custodial AI trading agent marketplace built on Initia's EVM L2. Creators deploy automated trading strategies backed by smart contracts; subscribers fund individual vaults and earn yield each epoch. The core security guarantee — creators can never access subscriber principal — is enforced entirely on-chain by the AgentVault contract.

**Implementation Detail:**

- **Custom Logic:** Four Solidity contracts implement a full principal-agent marketplace with epoch-based profit distribution and non-custodial vault architecture:
  - `AgentVault` — holds subscriber funds; creator has zero withdrawal access
  - `AgentRegistry` — registers strategies and tracks subscriber counts
  - `AgentExecutor` — validates and dispatches trades to the DEX
  - `ProfitSplitter` — distributes epoch profits to protocol, creator, and subscribers

  Source: [`SmartContract/src/`](SmartContract/src/)

- **Native Feature (auto-signing):** Session UX / "Ghost Mode" implemented via `@initia/interwovenkit-react` `enableAutoSign` config and `autoSign.enable()`/`disable()` toggle in [`FrontEnd/src/components/AutoSigningNavbar.tsx`](FrontEnd/src/components/AutoSigningNavbar.tsx). Enables seamless repeated trade approvals for `/minievm.evm.v1.MsgCall` messages without per-transaction wallet prompts.

**How to Run Locally:**

```bash
# 1. Clone and enter the workspace
git clone https://github.com/initiatiHacksUKDW/initiateHacksUKDW.git
cd initiateHacksUKDW/InitiaAgent

# 2. Install all dependencies (frontend + backend)
npm install

# 3. Configure environment variables
cp .env.example frontend/.env.local
cp .env.example backend/.env
# Fill in: ANTHROPIC_API_KEY, GEMINI_API_KEY, DATABASE_URL

# 4. Run frontend + backend together
npm run dev
# Frontend → http://localhost:3000
# Backend  → http://localhost:4000
```

---

## Repository Structure

```
initiateHacksUKDW/
├── .initia/
│   └── submission.json       ← Hackathon submission metadata
├── SmartContract/            ← Foundry project (Solidity 0.8.24)
│   └── src/
│       ├── AgentVault.sol
│       ├── AgentRegistry.sol
│       ├── AgentExecutor.sol
│       └── ProfitSplitter.sol
├── FrontEnd/                 ← Next.js 16 app (App Router · Tailwind · wagmi)
│   └── src/
│       ├── components/
│       │   ├── AutoSigningNavbar.tsx   ← Native feature: auto-signing
│       │   └── providers/WalletProvider.tsx
│       └── lib/hooks/use-interwoven-evm.ts
├── InitiaAgent/              ← npm workspace (frontend + backend + contracts)
│   ├── frontend/
│   ├── backend/
│   └── contracts/
└── Backend/                  ← Standalone backend (Express.js)
```

## Deployed Contracts (Initia evm-1 Testnet)

| Contract | Address |
|---|---|
| AgentRegistry | `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D` |
| AgentExecutor | `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014` |
| ProfitSplitter | `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F` |
| AgentVault | `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6` |
