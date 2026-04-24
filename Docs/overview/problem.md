# Problem Statement

## The Rise of Automated Trading

Automated trading strategies — bots that execute dollar-cost averaging, liquidity rebalancing, or yield optimization — have become a dominant force in on-chain markets. However, the infrastructure for deploying these strategies **on behalf of other users** remains either fully custodial or limited to a single vault owner with no marketplace and no composability.

This creates three well-documented problems.

## 1. Principal-Agent Problem in DeFi

When a subscriber delegates trading authority to an agent creator, the creator gains informational and operational advantages over the subscriber.

Jensen and Meckling (1976) formalized this misalignment: the agent (creator) may act in their own interest at the expense of the principal (subscriber). In DeFi, this manifests as:

- **Rug pulls** — creators draining subscriber funds
- **Excessive fee extraction** — hidden or disproportionate fees
- **Unauthorized fund movement** — funds used for purposes not agreed upon

These problems cannot be solved by reputation alone.

## 2. Custodial Risk in Automated Fund Management

Academic work on DeFi security consistently identifies custody as the highest-risk surface.

> "The degree of decentralization and the associated risks and opportunities depend critically on which layers of the stack remain centralized." — Schár (2021)

Werner et al. (2022) further document that the majority of DeFi exploits target centralized control points — admin keys, upgradeable proxies, and fund custodians. Existing solutions such as copy-trading platforms and yield aggregators typically rely on off-chain escrow or multisig arrangements that **reintroduce the same custodial risk** they claim to eliminate.

## 3. No Non-Custodial Agent Marketplace Exists

No production system today allows an arbitrary agent creator to:

1. Publish a strategy
2. Attract subscribers into a permissionless vault
3. Execute trades through that vault
4. Distribute profits

...all **without ever touching subscriber funds directly**.

The gap between what is technically possible with smart contracts and what is commercially deployed represents the problem InitiaAgent addresses.

## References

1. Jensen, M. C., & Meckling, W. H. (1976). *Theory of the firm: Managerial behavior, agency costs and ownership structure.* Journal of Financial Economics, 3(4), 305-360.
2. Schár, F. (2021). *Decentralized finance: On blockchain- and smart contract-based financial markets.* Federal Reserve Bank of St. Louis Review, 103(2), 153-174.
3. Werner, S. M., et al. (2022). *SoK: Decentralized finance (DeFi).* Proceedings of the 4th ACM Conference on Advances in Financial Technologies, 30-46.
