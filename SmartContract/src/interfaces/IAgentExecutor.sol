// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentExecutor
/// @notice Interface for the AgentExecutor contract
interface IAgentExecutor {
    /// @notice Authorize a runner address to execute swaps for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address to authorize
    function authorizeRunner(uint256 agentId, address runner) external;

    /// @notice Revoke a runner's authorization for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address to revoke
    function revokeRunner(uint256 agentId, address runner) external;

    /// @notice Execute a swap on behalf of an agent
    /// @param agentId      The agent ID
    /// @param tokenIn      Input token address
    /// @param tokenOut     Output token address
    /// @param amountIn     Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable output (slippage guard)
    /// @param deadline     Unix timestamp after which the tx reverts
    /// @return amountOut   Actual amount of tokenOut received
    function executeSwap(
        uint256 agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /// @notice Update the DEX contract address
    /// @param newDex New DEX address
    function updateDEX(address newDex) external;

    /// @notice Check if a runner is authorized for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    /// @return True if authorized
    function isRunnerAuthorized(uint256 agentId, address runner) external view returns (bool);
}
