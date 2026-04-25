// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentVault
/// @notice Interface for the AgentVault contract
interface IAgentVault {
    /// @notice Deposit assets and receive shares
    /// @param assets Amount of asset tokens to deposit
    function deposit(uint256 assets) external;

    /// @notice Redeem shares for underlying assets
    /// @param sharesToRedeem Number of shares to burn
    function withdraw(uint256 sharesToRedeem) external;

    /// @notice Approve executor to pull tokens for a trade
    /// @param token  Token to approve
    /// @param amount Amount to approve
    function approveForTrade(address token, uint256 amount) external;

    /// @notice Sync totalAssets with actual token balance
    function reconcileAssets() external;

    /// @notice Return current total asset value (used by splitter for snapshot)
    /// @return Current totalAssets
    function snapshotValue() external view returns (uint256);

    /// @notice Splitter calls this to transfer fees/shares out of the vault
    /// @param to     Recipient address
    /// @param amount Amount to transfer
    function withdrawForSplitter(address to, uint256 amount) external;

    /// @notice Set the splitter address (one-time, called by splitter itself)
    /// @param _splitter The splitter contract address
    function setSplitter(address _splitter) external;

    /// @notice Pause deposits and trades
    function pauseVault() external;

    /// @notice Unpause the vault
    function unpauseVault() external;

    /// @notice Update the executor address
    /// @param newExecutor New executor contract address
    function updateExecutor(address newExecutor) external;

    /// @notice Update the deposit cap
    /// @param newCap New cap (0 = unlimited)
    function updateDepositCap(uint256 newCap) external;

    /// @notice Preview shares for a given deposit amount
    /// @param assets Amount to deposit
    /// @return shares_ Expected shares
    function previewDeposit(uint256 assets) external view returns (uint256 shares_);

    /// @notice Preview assets for a given share redemption
    /// @param shares_ Shares to redeem
    /// @return assets_ Expected assets
    function previewWithdraw(uint256 shares_) external view returns (uint256 assets_);

    /// @notice Get the asset value owned by a subscriber
    /// @param sub Subscriber address
    /// @return assets_ Current asset value of subscriber's shares
    function getSubscriberAssets(address sub) external view returns (uint256 assets_);

    /// @notice Total assets held in the vault
    function totalAssets() external view returns (uint256);

    /// @notice Total shares outstanding
    function totalShares() external view returns (uint256);

    /// @notice Shares owned by an address
    /// @param account The address to query
    function shares(address account) external view returns (uint256);

    /// @notice The immutable agent ID
    function agentId() external view returns (uint256);

    /// @notice The immutable creator address
    function creator() external view returns (address);
}
