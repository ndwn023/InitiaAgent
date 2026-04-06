// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICosmos
/// @notice Interface for the Initia Cosmos precompile at 0x00000000000000000000000000000000000000f1
interface ICosmos {
    /// @notice Execute an arbitrary Cosmos SDK message encoded as JSON
    /// @param msg JSON-encoded Cosmos message (e.g. MsgSwap)
    /// @return success True if the message was executed successfully
    function execute_cosmos(string calldata msg) external returns (bool success);

    /// @notice Convert an ERC-20 token address to its Cosmos IBC denom
    /// @param erc20Address The ERC-20 token address
    /// @return denom The corresponding Cosmos denom string
    function to_denom(address erc20Address) external view returns (string memory denom);

    /// @notice Convert a Cosmos IBC denom to its ERC-20 token address
    /// @param denom The Cosmos denom string
    /// @return erc20Address The corresponding ERC-20 address
    function to_erc20(string calldata denom) external view returns (address erc20Address);
}
