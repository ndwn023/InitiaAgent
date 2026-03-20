// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IInitiaDEX
/// @notice Minimal interface for the Initia DEX used by AgentExecutor
interface IInitiaDEX {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMinimum; // slippage guard
        address recipient;        // always the vault
        uint256 deadline;         // unix timestamp
    }

    /// @notice Execute a token swap
    /// @param params Swap parameters
    /// @return amountOut Amount of tokenOut received
    function swap(SwapParams calldata params) external returns (uint256 amountOut);

    /// @notice Get the expected output amount for a swap
    /// @param tokenIn  Input token address
    /// @param tokenOut Output token address
    /// @param amountIn Amount of tokenIn
    /// @return amountOut Expected amount of tokenOut
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}
