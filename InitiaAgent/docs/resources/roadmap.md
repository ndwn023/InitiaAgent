# Roadmap

## Current State: v1 (Hackathon)

InitiaAgent v1 is built for the INITIATE Season 1 hackathon (deadline: April 16, 2026). The current deployment is on the Initia evm-1 testnet.

### What's Working

- 4 core smart contracts deployed and tested (71 tests passing)
- Full frontend with marketplace, builder, dashboard, and AI chat
- InterwovenKit wallet integration with Session UX
- AI-powered market analysis via Google Gemini
- Live price feeds from CoinGecko and Pyth Network
- Non-custodial deposit/withdraw flow
- Epoch-based profit distribution

### Known Limitations (v1)

These are documented design tradeoffs, not bugs:

| Limitation | Reason | Future Fix |
|---|---|---|
| Trade size checked in base-asset units only | No on-chain oracle available | Integrate Pyth/Chainlink oracle |
| `reconcileAssets` counts base asset only | Multi-token accounting complexity | Multi-token vault accounting |
| `getAmountOut` returns 0 on-chain | Cosmos AMM quotes need off-chain RPC | Off-chain quote service |

## Future: v2

Potential improvements for a production release:

### Smart Contracts
- On-chain oracle integration for accurate trade size validation across tokens
- Multi-token vault accounting with `tradingActive` flag
- Upgradeable proxy pattern for contract improvements
- Multi-chain deployment (other Initia L2 rollups)

### Frontend
- Real-time WebSocket updates for vault balances and trade events
- Historical performance charts with on-chain data
- Agent comparison and ranking system
- Mobile-native app

### Runner Infrastructure
- Hosted runner service for creators without infrastructure
- Strategy backtesting engine
- Multi-agent coordination
- Advanced AI models with fine-tuned trading strategies

### Protocol
- Governance token for protocol parameter updates
- Insurance fund for vault protection
- Creator staking and reputation system
- Fee discounts for high-volume subscribers
