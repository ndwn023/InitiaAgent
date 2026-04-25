# Agent Builder

The Agent Builder is a no-code interface for creating and deploying custom trading strategies.

## Strategy Types

| Strategy | Description |
|---|---|
| **DCA (Dollar-Cost Averaging)** | Periodic purchases of a target token at fixed intervals |
| **LP Auto-Rebalancing** | Automated liquidity position rebalancing based on price movements |
| **Yield Optimizer** | Cross-protocol yield farming with automatic compounding |
| **VIP Maximizer** | Aggressive multi-strategy approach for higher risk tolerance |

## Configuration

### Required Fields

| Field | Description |
|---|---|
| Agent Name | Display name shown in the marketplace |
| Strategy | One of the four strategy types above |
| Target Token | The token the strategy trades (e.g., INIT, ETH) |
| Pool | Target liquidity pool |
| Protocol | DeFi protocol to interact with |
| Vault | Vault identifier |

### Optional Fields

| Field | Description |
|---|---|
| Risk Level | Conservative, Moderate, or Aggressive |
| Initial Capital | Amount of INIT to seed the vault |

## AI Simulation

Before deploying, creators can run an **AI-powered simulation** of their strategy:

1. Click "Simulate with AI"
2. The system calls the `/api/agent/analyze` endpoint
3. Google Gemini analyzes the strategy against current market conditions
4. Returns:
   - **Signal** — BUY, SELL, or HOLD
   - **Confidence** — percentage confidence in the signal
   - **Reasoning** — explanation of the analysis
   - **Risk Assessment** — evaluation of the strategy's risk profile
5. A performance chart visualizes projected outcomes

## Deployment Workflow

Deploying an agent is a multi-step process:

```mermaid
flowchart LR
    A["Prepare\nConfig"] --> B["Fund\nERC20.approve()"]
    B --> C["Sign\nVault.deposit()"]
    C --> D["Broadcast\nTx to evm-1"]
    D --> E["Success\nAgent Live"]

    style A fill:#1a4d4d,stroke:#06b6d4,color:#fff
    style B fill:#5c3d1a,stroke:#f59e0b,color:#fff
    style C fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style D fill:#1e3a5f,stroke:#4a9eed,color:#fff
    style E fill:#1a4d2e,stroke:#22c55e,color:#fff
```

1. **Prepare** — validate configuration, generate deployment parameters
2. **Fund** — `ERC20.approve(vaultAddress, initialCapital)` — authorize the vault
3. **Sign** — `AgentVault.deposit(initialCapital)` — seed the vault with initial capital
4. **Broadcast** — transaction is submitted to evm-1
5. **Success** — agent is registered and appears in the marketplace

After deployment, the agent is stored via the `/api/agents` endpoint and becomes visible to all marketplace visitors.
