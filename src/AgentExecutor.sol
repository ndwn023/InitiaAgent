// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAgentExecutor} from "./interfaces/IAgentExecutor.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IAgentVault} from "./interfaces/IAgentVault.sol";
import {IInitiaDEX} from "./interfaces/IInitiaDEX.sol";
import {
    AgentExecutor__NotAuthorizedRunner,
    AgentExecutor__AgentNotActive,
    AgentExecutor__DeadlineExpired,
    AgentExecutor__SameToken,
    AgentExecutor__ZeroMinOutput,
    AgentExecutor__SlippageExceeded,
    AgentExecutor__InvalidDEX,
    AgentExecutor__InvalidRegistry,
    AgentExecutor__SwapFailed,
    AgentExecutor__NotCreator,
    AgentExecutor__RunnerAlreadyAuthorized,
    AgentExecutor__RunnerNotAuthorized
} from "./errors/Errors.sol";
import {
    SwapExecuted,
    RunnerAuthorized,
    RunnerRevoked,
    DEXUpdated
} from "./events/Events.sol";

/// @title AgentExecutor
/// @notice Gatekeeper for agent trade commands; dispatches swaps to the DEX
contract AgentExecutor is IAgentExecutor, Ownable2Step {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────
    IAgentRegistry public immutable registry;
    IInitiaDEX     public dex;

    /// @notice agentId → runner address → authorized
    mapping(uint256 => mapping(address => bool)) private _runners;

    /// @notice agentId → vault address (cached for gas)
    mapping(uint256 => address) public agentVault;

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address _registry, address _dex, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert AgentExecutor__InvalidRegistry(_registry);
        if (_dex      == address(0)) revert AgentExecutor__InvalidDEX(_dex);

        registry = IAgentRegistry(_registry);
        dex      = IInitiaDEX(_dex);
    }

    // ─── Runner management ────────────────────────────────────────────────

    /// @notice Authorize a runner to execute swaps for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    function authorizeRunner(uint256 agentId, address runner) external override {
        _requireCreator(agentId, msg.sender);
        if (_runners[agentId][runner]) revert AgentExecutor__RunnerAlreadyAuthorized(runner, agentId);

        _runners[agentId][runner] = true;

        // Cache vault address on first authorization
        if (agentVault[agentId] == address(0)) {
            agentVault[agentId] = registry.getAgent(agentId).vaultAddress;
        }

        emit RunnerAuthorized(agentId, runner);
    }

    /// @notice Revoke a runner's authorization for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    function revokeRunner(uint256 agentId, address runner) external override {
        _requireCreator(agentId, msg.sender);
        if (!_runners[agentId][runner]) revert AgentExecutor__RunnerNotAuthorized(runner, agentId);

        _runners[agentId][runner] = false;

        emit RunnerRevoked(agentId, runner);
    }

    // ─── Swap execution ───────────────────────────────────────────────────

    /// @notice Execute a swap on behalf of a registered agent
    /// @param agentId      The agent ID
    /// @param tokenIn      Input token address
    /// @param tokenOut     Output token address
    /// @param amountIn     Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable output
    /// @param deadline     Unix timestamp deadline
    /// @return amountOut   Actual tokenOut received
    function executeSwap(
        uint256 agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external override returns (uint256 amountOut) {
        // ── Checks ──────────────────────────────────────────────────────
        if (!_runners[agentId][msg.sender])
            revert AgentExecutor__NotAuthorizedRunner(msg.sender, agentId);
        if (!registry.isActive(agentId))
            revert AgentExecutor__AgentNotActive(agentId);
        if (block.timestamp > deadline)
            revert AgentExecutor__DeadlineExpired(deadline, block.timestamp);
        if (tokenIn == tokenOut)
            revert AgentExecutor__SameToken(tokenIn);
        if (minAmountOut == 0)
            revert AgentExecutor__ZeroMinOutput();

        // ── Load vault (cache if missing) ────────────────────────────────
        address vault = agentVault[agentId];
        if (vault == address(0)) {
            vault = registry.getAgent(agentId).vaultAddress;
            agentVault[agentId] = vault;
        }

        // ── Interactions ─────────────────────────────────────────────────
        // 1. Vault approves executor to pull tokenIn
        IAgentVault(vault).approveForTrade(tokenIn, amountIn);

        // 2. Pull tokenIn from vault to executor
        IERC20(tokenIn).safeTransferFrom(vault, address(this), amountIn);

        // 3. Approve DEX to spend tokenIn
        IERC20(tokenIn).forceApprove(address(dex), amountIn);

        // 4. Execute swap; output goes directly to vault
        IInitiaDEX.SwapParams memory params = IInitiaDEX.SwapParams({
            tokenIn:          tokenIn,
            tokenOut:         tokenOut,
            amountIn:         amountIn,
            amountOutMinimum: minAmountOut,
            recipient:        vault,
            deadline:         deadline
        });

        try dex.swap(params) returns (uint256 out) {
            amountOut = out;
        } catch {
            revert AgentExecutor__SwapFailed();
        }

        if (amountOut < minAmountOut)
            revert AgentExecutor__SlippageExceeded(amountOut, minAmountOut);

        // 5. Sync vault accounting
        IAgentVault(vault).reconcileAssets();

        // 6. Update volume tracking (non-critical; ignore revert)
        try registry.updateVolumeTraded(agentId, uint128(amountOut)) {} catch {}

        emit SwapExecuted(agentId, msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    // ─── Owner admin ─────────────────────────────────────────────────────

    /// @notice Update the DEX contract address
    /// @param newDex New DEX address
    function updateDEX(address newDex) external override onlyOwner {
        if (newDex == address(0)) revert AgentExecutor__InvalidDEX(newDex);
        emit DEXUpdated(address(dex), newDex);
        dex = IInitiaDEX(newDex);
    }

    // ─── View ─────────────────────────────────────────────────────────────

    /// @notice Check if a runner is authorized for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    /// @return True if authorized
    function isRunnerAuthorized(uint256 agentId, address runner)
        external
        view
        override
        returns (bool)
    {
        return _runners[agentId][runner];
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    /// @dev Revert if caller is not the agent creator
    function _requireCreator(uint256 agentId, address caller) internal view {
        IAgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (caller != info.creator) revert AgentExecutor__NotCreator(caller, agentId);
    }
}
