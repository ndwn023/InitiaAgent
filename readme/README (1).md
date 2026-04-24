<div align="center">

<img src="https://img.shields.io/badge/Network-Initia_evm--1-22c55e?style=for-the-badge" />
<img src="https://img.shields.io/badge/Hackathon-INITIATE_S1-4a9eed?style=for-the-badge" />
<img src="https://img.shields.io/badge/Solidity-0.8.24-8b5cf6?style=for-the-badge" />
<img src="https://img.shields.io/badge/Next.js-16.2-1e1e1e?style=for-the-badge" />

# ⚡ InitiaAgent

**Non-custodial AI trading agent marketplace on Initia EVM**

*Creators deploy strategies. Subscribers earn yield. Smart contracts guarantee no one can touch your principal.*

[📖 Docs](https://initiaagent-docs.gitbook.io/initiaagent-docs) · [🔍 Explorer](https://scan.testnet.initia.xyz/evm-1) · [🏆 Hackathon](https://dorahacks.io/hackathon/initia)

</div>

---

## 🧠 What is InitiaAgent?

InitiaAgent is a **four-contract on-chain system** where agent creators publish automated trading strategies and subscribers deposit funds into non-custodial vaults. An off-chain AI runner executes trades within strict on-chain bounds, and profits are distributed automatically each epoch.

> **Core guarantee:** Creators can never access subscriber principal — enforced entirely at the smart contract level.

---

## ✨ Key Properties

| Property | Detail |
|---|---|
| 🔒 **Non-Custodial** | Creator controls parameters but cannot withdraw subscriber funds |
| 🚪 **Instant Exit** | Subscribers can withdraw anytime, even when the vault is paused |
| 💸 **Permissionless Profit** | Anyone can trigger `distributeProfit()` after each epoch |
| 📐 **Bounded Trading** | Every trade is capped at 30% of vault and rate-limited by cooldown |

---

## 🏗️ System Architecture

```
Frontend (Next.js + Wagmi + InterwovenKit)
         │
         ├──▶ AgentVault      — Funds + Shares
         ├──▶ AgentExecutor   — Trade Gateway → InitiaDEX (Cosmos Precompile)
         ├──▶ ProfitSplitter  — Epoch Distribution → Treasury + Creator
         └──▶ AgentRegistry   — Agent Directory
```

**Trade Execution Flow:**
```
AI Runner → AgentExecutor → AgentVault (validate cooldown + size)
                         → InitiaDEX swap via ICosmos Precompile
                         → Assets returned to AgentVault
```

**Profit Distribution (per epoch):**
```
Anyone calls distributeProfit()
  → 2%  Protocol Fee  → Treasury
  → 20% Creator Share → Creator Wallet
  → 78% Stays in Vault for Subscribers
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24 (4 contracts) |
| Framework | Next.js 16.2 (App Router) |
| Web3 | Wagmi 2.17, Viem 2.47, InterwovenKit |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Framer Motion |
| AI | Google Gemini (market analysis + chat assistant) |
| Price Data | CoinGecko (primary) · Pyth Network (fallback) |
| Charts | Recharts |

---

## 👥 Who Is This For?

| Role | What You Can Do |
|---|---|
| 📈 **Subscriber** | Browse agents, deposit funds, earn passive returns, withdraw anytime |
| 🧑‍💻 **Creator** | Build and deploy trading strategies, earn 20% of generated profit |
| 🤖 **Runner** | Operate off-chain AI bots that execute trades on behalf of agents |
| 🔧 **Developer** | Read contract specs, understand the architecture, build integrations |

---

## 📜 Deployed Contracts (Initia evm-1 Testnet)

| Contract | Address |
|---|---|
| AgentRegistry | `0xBF1Bf9E5113fdF25b2104c9494F518C46caC3C5D` |
| AgentExecutor | `0x0777CA550E0dFB9c64deb88A871a3ad867c2e014` |
| ProfitSplitter | `0x9D925037CA3e28d3943cea6aA7cBF36b4f681D9F` |
| AgentVault (Agent #1) | `0xe3DCC86978d57d0753d60bca3687dbbbB8f104D6` |
| ICosmos Precompile | `0x00000000000000000000000000000000000000f1` |

**Network Info:**
- Chain ID: `2124225178762456`
- RPC: `https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz`
- Explorer: [scan.testnet.initia.xyz/evm-1](https://scan.testnet.initia.xyz/evm-1)

---

## 📂 Repositories

| Repo | Description |
|---|---|
| `initiaagent-contracts` | Solidity smart contracts (AgentRegistry, AgentVault, AgentExecutor, ProfitSplitter) |
| `initiaagent-frontend` | Next.js marketplace, builder, dashboard & docs viewer |
| `initiaagent-runner` | Off-chain AI bot runner for trade execution |
| `initiaagent-docs` | Full documentation (hosted on GitBook) |

---

<div align="center">

Built with ❤️ for **INITIATE Season 1** — Initia × DoraHacks Hackathon

[📖 Full Documentation →](https://initiaagent-docs.gitbook.io/initiaagent-docs)

</div>
