// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Unrestricted ERC20 for testing purposes only
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mint tokens to any address (test only)
    /// @param to     Recipient
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /// @notice Burn tokens from any address (test only)
    /// @param from   Address to burn from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
}
