// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IProfitSplitter
/// @notice Interface for the ProfitSplitter contract
interface IProfitSplitter {
    /// @notice Register a vault with the splitter for profit distribution
    /// @param agentId The agent ID
    /// @param vault   The vault address
    function registerVault(uint256 agentId, address vault) external;

    /// @notice Distribute profit for an agent after an epoch elapses
    /// @param agentId        The agent ID
    /// @return protocolFee   Amount sent to protocol treasury
    /// @return creatorShare  Amount sent to creator
    /// @return subscriberShare Profit remaining in vault for subscribers
    function distributeProfit(uint256 agentId)
        external
        returns (
            uint256 protocolFee,
            uint256 creatorShare,
            uint256 subscriberShare
        );

    /// @notice Check if profit distribution is available for an agent
    /// @param agentId          The agent ID
    /// @return ok              True if epoch has elapsed
    /// @return secondsRemaining Seconds until next distribution is allowed
    function canDistribute(uint256 agentId)
        external
        view
        returns (bool ok, uint256 secondsRemaining);

    /// @notice Update the protocol fee in basis points
    /// @param newBps New fee (max 1000 = 10%)
    function setProtocolFee(uint256 newBps) external;

    /// @notice Update the creator share in basis points
    /// @param newBps New share (max 5000 = 50%)
    function setCreatorShare(uint256 newBps) external;

    /// @notice Update the protocol treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external;

    /// @notice Update the epoch duration
    /// @param secs New duration in seconds (min 3600)
    function setEpochDuration(uint256 secs) external;
}
