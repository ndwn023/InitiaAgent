// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IInitiaDEX} from "../interfaces/IInitiaDEX.sol";
import {ICosmos}    from "../interfaces/ICosmos.sol";

/// @title InitiaDEXAdapter
/// @notice Implements IInitiaDEX by routing swaps through the Initia Cosmos precompile.
///         Drop-in replacement for MockInitiaDEX on real Initia networks.
///
/// @dev The ICosmos precompile lives at the well-known address below. Any call to
///      `swap()` will:
///        1. Resolve ERC-20 addresses to Cosmos denoms via `to_denom`
///        2. Build a JSON-encoded `MsgSwap` for the Initia DEX module
///        3. Dispatch it via `execute_cosmos`
///        4. Return the balance delta of tokenOut in the recipient as amountOut
///
///      `getAmountOut` is a stub — AMM quotes require an off-chain RPC call to
///      the Initia query layer and cannot be computed purely on-chain.
contract InitiaDEXAdapter is IInitiaDEX {

    // Initia Cosmos precompile — fixed address on all Initia EVM chains
    ICosmos public constant COSMOS = ICosmos(0x00000000000000000000000000000000000000f1);

    /// @inheritdoc IInitiaDEX
    function swap(SwapParams calldata params) external override returns (uint256 amountOut) {
        // Resolve Cosmos denoms
        string memory denomIn  = COSMOS.to_denom(params.tokenIn);
        string memory denomOut = COSMOS.to_denom(params.tokenOut);

        // Snapshot recipient's tokenOut balance before the swap
        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(params.recipient);

        // Build JSON-encoded MsgSwap for the Initia DEX module
        string memory msgJson = string(abi.encodePacked(
            '{"@type":"/initia.dex.v1.MsgSwap",',
            '"sender":"', _addressToString(address(this)), '",',
            '"offer_coin":{"denom":"', denomIn, '","amount":"', _uint256ToString(params.amountIn), '"},',
            '"demand_coin_denom":"', denomOut, '",',
            '"offer_coin_fee":{"denom":"', denomIn, '","amount":"0"},',
            '"order_price":"0",',
            '"recipient":"', _addressToString(params.recipient), '"}'
        ));

        bool ok = COSMOS.execute_cosmos(msgJson);
        require(ok, "InitiaDEXAdapter: cosmos swap failed");

        // Compute amountOut as balance delta
        uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(params.recipient);
        amountOut = balanceAfter - balanceBefore;

        require(amountOut >= params.amountOutMinimum, "InitiaDEXAdapter: insufficient output");
    }

    /// @inheritdoc IInitiaDEX
    /// @dev Not computable on-chain; returns 0. Use off-chain RPC for quotes.
    function getAmountOut(address, address, uint256) external pure override returns (uint256) {
        return 0;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(42);
        result[0] = "0";
        result[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            result[2 + i * 2]     = hexChars[uint8(data[i] >> 4)];
            result[2 + i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(result);
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
