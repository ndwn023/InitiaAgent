// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";
import {
    AgentExecutor__NotAuthorizedRunner,
    AgentExecutor__AgentNotActive,
    AgentExecutor__DeadlineExpired,
    AgentExecutor__SameToken,
    AgentExecutor__ZeroMinOutput,
    AgentExecutor__SlippageExceeded,
    AgentExecutor__NotCreator,
    AgentExecutor__RunnerAlreadyAuthorized,
    AgentExecutor__RunnerNotAuthorized
} from "../../src/errors/Errors.sol";

contract AgentExecutorTest is TestSetup {

    // ── executeSwap ───────────────────────────────────────────────────────

    function test_ExecuteSwap_Success() public {
        _subscribe(alice, 10_000e18);

        uint256 deadline = block.timestamp + 1 hours;
        vm.prank(runner);
        uint256 out = executor.executeSwap(
            agentId,
            address(initToken),
            address(usdcToken),
            1_000e18,
            1_999e18,
            deadline
        );

        assertGt(out, 0);
        assertEq(dex.getSwapCount(), 1);
        // vault totalAssets is synced by reconcileAssets
        assertGt(vault.totalAssets(), 0);
    }

    function test_ExecuteSwap_Revert_NotAuthorizedRunner() public {
        _subscribe(alice, 10_000e18);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentExecutor__NotAuthorizedRunner.selector, alice, agentId)
        );
        executor.executeSwap(
            agentId, address(initToken), address(usdcToken),
            1_000e18, 1e18, block.timestamp + 1 hours
        );
    }

    function test_ExecuteSwap_Revert_AgentNotActive() public {
        _subscribe(alice, 10_000e18);

        vm.prank(creator);
        registry.deactivateAgent(agentId);

        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentExecutor__AgentNotActive.selector, agentId)
        );
        executor.executeSwap(
            agentId, address(initToken), address(usdcToken),
            1_000e18, 1e18, block.timestamp + 1 hours
        );
    }

    function test_ExecuteSwap_Revert_DeadlineExpired() public {
        _subscribe(alice, 10_000e18);
        uint256 expired = block.timestamp - 1;
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentExecutor__DeadlineExpired.selector,
                expired,
                block.timestamp
            )
        );
        executor.executeSwap(
            agentId, address(initToken), address(usdcToken),
            1_000e18, 1e18, expired
        );
    }

    function test_ExecuteSwap_Revert_SameToken() public {
        _subscribe(alice, 10_000e18);
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentExecutor__SameToken.selector, address(initToken))
        );
        executor.executeSwap(
            agentId, address(initToken), address(initToken),
            1_000e18, 1e18, block.timestamp + 1 hours
        );
    }

    function test_ExecuteSwap_Revert_ZeroMinOutput() public {
        _subscribe(alice, 10_000e18);
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(AgentExecutor__ZeroMinOutput.selector));
        executor.executeSwap(
            agentId, address(initToken), address(usdcToken),
            1_000e18, 0, block.timestamp + 1 hours
        );
    }

    function test_ExecuteSwap_Revert_SlippageExceeded() public {
        _subscribe(alice, 10_000e18);
        // Disable DEX-level slippage check so executor's own guard triggers
        dex.setSkipSlippageCheck(true);
        // Rate is 2:1 so 1000 INIT → 2000 USDC; requesting 3000 min → executor slippage
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentExecutor__SlippageExceeded.selector, 2_000e18, 3_000e18)
        );
        executor.executeSwap(
            agentId, address(initToken), address(usdcToken),
            1_000e18, 3_000e18, block.timestamp + 1 hours
        );
    }

    // ── Runner management ─────────────────────────────────────────────────

    function test_AuthorizeRunner_Success() public {
        address newRunner = makeAddr("newRunner");
        vm.prank(creator);
        executor.authorizeRunner(agentId, newRunner);
        assertTrue(executor.isRunnerAuthorized(agentId, newRunner));
    }

    function test_AuthorizeRunner_Revert_NotCreator() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentExecutor__NotCreator.selector, alice, agentId)
        );
        executor.authorizeRunner(agentId, alice);
    }

    function test_AuthorizeRunner_Revert_AlreadyAuthorized() public {
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentExecutor__RunnerAlreadyAuthorized.selector, runner, agentId
            )
        );
        executor.authorizeRunner(agentId, runner);
    }

    function test_RevokeRunner_Success() public {
        vm.prank(creator);
        executor.revokeRunner(agentId, runner);
        assertFalse(executor.isRunnerAuthorized(agentId, runner));
    }

    function test_RevokeRunner_Revert_NotAuthorized() public {
        address notRunner = makeAddr("notRunner");
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentExecutor__RunnerNotAuthorized.selector, notRunner, agentId
            )
        );
        executor.revokeRunner(agentId, notRunner);
    }
}
