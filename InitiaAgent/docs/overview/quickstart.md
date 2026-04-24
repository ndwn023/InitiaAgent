# Quickstart

Get started with InitiaAgent in 5 minutes.

## Prerequisites

- A wallet compatible with Initia (MetaMask, Keplr, or any InterwovenKit-supported wallet)
- INIT tokens on evm-1 testnet

### Get Testnet INIT

1. Visit the [Initia L1 Faucet](https://faucet.testnet.initia.xyz/) and request INIT
2. Bridge to evm-1 via the [Initia Bridge](https://app.testnet.initia.xyz/?openBridge=true) (From: Initia L1, To: evm-1, minimum 5 INIT)

---

## Step 1: Connect Wallet

<!-- TODO: Add screenshot of landing page with connect button -->

Open the app and click **Connect Wallet**. Select your wallet provider and approve the connection. The app will automatically prompt you to switch to Initia evm-1 if needed.

## Step 2: Browse the Marketplace

<!-- TODO: Add screenshot of marketplace page -->

Navigate to the **Marketplace** to see available trading agents. Each agent card shows:
- Strategy type (DCA, LP Rebalancing, Yield Optimizer, VIP Maximizer)
- Estimated TVL and subscriber count
- Revenue split (80% subscriber / 18% creator / 2% protocol)

## Step 3: Subscribe to an Agent

<!-- TODO: Add screenshot of subscribe dialog -->

1. Click on an agent to open the subscribe dialog
2. Enter the amount of INIT you want to deposit
3. Click **Approve** — authorizes the vault to pull your tokens
4. Click **Deposit** — your tokens enter the vault and you receive proportional shares

## Step 4: Monitor on Dashboard

<!-- TODO: Add screenshot of dashboard -->

Your subscribed agents appear on the **Dashboard** with:
- Portfolio balance and unrealized profit
- 7-day performance chart
- AI trading signals (BUY/SELL/HOLD) updated every 5 minutes
- AI chat assistant for strategy questions

## Step 5: Withdraw Anytime

<!-- TODO: Add screenshot of withdraw button -->

Click **Withdraw** on any agent card in the Dashboard. Your shares are redeemed for the underlying assets including any accumulated profit. There is no lock-up period — you can exit at any time, even if the vault is paused.

---

## Optional: Enable Session UX

For a seamless experience, enable **Ghost Mode** (Session UX) in the navbar. This auto-signs approved transaction types so you don't need to confirm every action manually.

---

## Next Steps

- Want to create your own agent? See [Agent Builder](../features/agent-builder.md)
- Curious about the security model? Read [How It Works](./how-it-works.md)
- Want to understand the contracts? Check [Smart Contracts](../technical/smart-contracts/overview.md)
