// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IInitiaDEX} from "../interfaces/IInitiaDEX.sol";
import {MockERC20} from "./MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockInitiaDEX
/// @notice Configurable mock DEX for testing
contract MockInitiaDEX is IInitiaDEX {
    /// @notice Exchange rates: tokenIn → tokenOut → rate (scaled 1e18)
    mapping(address => mapping(address => uint256)) public rates;

    struct SwapRecord {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
    }

    SwapRecord[] public swapHistory;

    /// @notice When true, DEX skips its own slippage check (to test executor-level slippage)
    bool public skipSlippageCheck;

    /// @notice Set the exchange rate between two tokens
    /// @param tokenIn  Input token
    /// @param tokenOut Output token
    /// @param rate18   Rate scaled by 1e18 (e.g. 2e18 = 2 tokenOut per tokenIn)
    function setRate(address tokenIn, address tokenOut, uint256 rate18) public {
        rates[tokenIn][tokenOut] = rate18;
    }

    /// @notice Toggle the DEX-level slippage enforcement
    function setSkipSlippageCheck(bool skip) public {
        skipSlippageCheck = skip;
    }

    /// @notice Execute a swap using configured rates
    /// @param params Swap parameters
    /// @return amountOut Amount of tokenOut minted to recipient
    function swap(SwapParams calldata params) external override returns (uint256 amountOut) {
        amountOut = params.amountIn * rates[params.tokenIn][params.tokenOut] / 1e18;
        if (!skipSlippageCheck) {
            require(amountOut >= params.amountOutMinimum, "MockDEX: insufficient output");
        }
        require(block.timestamp <= params.deadline, "MockDEX: deadline expired");

        // Pull tokenIn from executor (msg.sender)
        MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Mint tokenOut to recipient (the vault)
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);

        swapHistory.push(SwapRecord({
            tokenIn:   params.tokenIn,
            tokenOut:  params.tokenOut,
            amountIn:  params.amountIn,
            amountOut: amountOut
        }));

        return amountOut;
    }

    /// @notice Get expected output for a swap
    /// @param tokenIn  Input token
    /// @param tokenOut Output token
    /// @param amountIn Input amount
    /// @return Expected output amount
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        override
        returns (uint256)
    {
        return amountIn * rates[tokenIn][tokenOut] / 1e18;
    }

    /// @notice Number of swaps recorded
    function getSwapCount() external view returns (uint256) {
        return swapHistory.length;
    }

    /// @notice Get swap record by index
    /// @param i Index
    /// @return Swap record
    function getSwap(uint256 i) external view returns (SwapRecord memory) {
        return swapHistory[i];
    }
}
