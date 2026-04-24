// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {AgentVault} from "../../src/AgentVault.sol";
import {
    AgentVault__ZeroAmount,
    AgentVault__ZeroShares,
    AgentVault__InsufficientShares,
    AgentVault__InsufficientAssets,
    AgentVault__DepositCapExceeded,
    AgentVault__TokenNotWhitelisted,
    AgentVault__ExceedsMaxTradePercent,
    AgentVault__CooldownNotElapsed,
    AgentVault__NotExecutor,
    AgentVault__NotCreator,
    AgentVault__NotSplitter,
    AgentVault__VaultPaused,
    AgentVault__SplitterAlreadySet,
    AgentVault__UnauthorizedReconciler
} from "../../src/errors/Errors.sol";

contract AgentVaultTest is TestSetup {

    // ── Deposit ───────────────────────────────────────────────────────────

    function test_Deposit_FirstDeposit_1to1Shares() public {
        _subscribe(alice, 1_000e18);
        assertEq(vault.shares(alice), 1_000e18);
        assertEq(vault.totalShares(), 1_000e18);
        assertEq(vault.totalAssets(), 1_000e18);
    }

    function test_Deposit_SubsequentDeposit_ProportionalShares() public {
        _subscribe(alice, 1_000e18);
        _subscribe(bob, 500e18);
        // bob gets 500 * 1000/1000 = 500 shares
        assertEq(vault.shares(bob), 500e18);
        assertEq(vault.totalShares(), 1_500e18);
        assertEq(vault.totalAssets(), 1_500e18);
    }

    function test_Deposit_MultipleSubscribers_IndependentShares() public {
        _subscribe(alice, 60_000e18);
        _subscribe(bob,   40_000e18);
        assertEq(vault.shares(alice), 60_000e18);
        assertEq(vault.shares(bob),   40_000e18);
        assertEq(vault.totalShares(), 100_000e18);
    }

    function test_Deposit_Revert_ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentVault__ZeroAmount.selector));
        vault.deposit(0);
    }

    function test_Deposit_Revert_CapExceeded() public {
        vm.prank(creator);
        vault.updateDepositCap(50_000e18);

        vm.startPrank(alice);
        initToken.approve(address(vault), 50_001e18);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__DepositCapExceeded.selector, 50_001e18, 50_000e18)
        );
        vault.deposit(50_001e18);
        vm.stopPrank();
    }

    function test_Deposit_Revert_Paused() public {
        vm.prank(creator);
        vault.pauseVault();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentVault__VaultPaused.selector));
        vault.deposit(1_000e18);
    }

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e18);
        initToken.mint(alice, amount);

        uint256 expectedShares = vault.previewDeposit(amount);

        vm.startPrank(alice);
        initToken.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        assertApproxEqAbs(vault.shares(alice), expectedShares, 1);
    }

    // ── Withdraw ──────────────────────────────────────────────────────────

    function test_Withdraw_FullWithdraw_ReturnsAllAssets() public {
        _subscribe(alice, 10_000e18);
        uint256 sharesBefore = vault.shares(alice);

        vm.prank(alice);
        vault.withdraw(sharesBefore);

        assertEq(vault.shares(alice), 0);
        assertEq(initToken.balanceOf(alice), 100_000e18); // full refund
    }

    function test_Withdraw_PartialWithdraw() public {
        _subscribe(alice, 10_000e18);

        vm.prank(alice);
        vault.withdraw(5_000e18);

        assertEq(vault.shares(alice), 5_000e18);
        assertEq(vault.totalAssets(), 5_000e18);
    }

    function test_Withdraw_AfterPriceIncrease_ReturnsMore() public {
        _subscribe(alice, 1_000e18);

        // Simulate vault earning 100 INIT
        initToken.mint(address(vault), 100e18);
        vm.prank(address(executor));
        vault.reconcileAssets();

        assertEq(vault.totalAssets(), 1_100e18);

        uint256 aliceShares = vault.shares(alice);
        vm.prank(alice);
        vault.withdraw(aliceShares);

        // Alice should receive ~1100 INIT
        assertApproxEqAbs(initToken.balanceOf(alice), 100_100e18, 10);
    }

    function test_Withdraw_Revert_ZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentVault__ZeroShares.selector));
        vault.withdraw(0);
    }

    function test_Withdraw_Revert_InsufficientShares() public {
        _subscribe(alice, 1_000e18);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__InsufficientShares.selector, 2_000e18, 1_000e18)
        );
        vault.withdraw(2_000e18);
    }

    function test_Withdraw_AllowedWhenPaused() public {
        _subscribe(alice, 1_000e18);

        vm.prank(creator);
        vault.pauseVault();

        uint256 shares_ = vault.shares(alice);
        vm.prank(alice);
        vault.withdraw(shares_);

        assertEq(vault.shares(alice), 0);
    }

    function testFuzz_Withdraw(uint256 depositAmount, uint256 withdrawFraction) public {
        depositAmount    = bound(depositAmount, 1e18, 50_000e18);
        withdrawFraction = bound(withdrawFraction, 1, 100);

        _subscribe(alice, depositAmount);
        uint256 totalShares_ = vault.shares(alice);
        uint256 redeemShares = totalShares_ * withdrawFraction / 100;

        vm.prank(alice);
        vault.withdraw(redeemShares);

        // Withdrawn amount must be <= original deposit
        uint256 received = initToken.balanceOf(alice) - (100_000e18 - depositAmount);
        assertLt(received, depositAmount + 1);
    }

    // ── Security ──────────────────────────────────────────────────────────

    function test_Security_CreatorCannotWithdrawSubscriberFunds() public {
        _subscribe(alice, 1_000e18);
        uint256 aliceShares = vault.shares(alice);

        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__InsufficientShares.selector, aliceShares, 0)
        );
        vault.withdraw(aliceShares);
    }

    function test_Security_RandomAddressCannotApproveForTrade() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__NotExecutor.selector, alice)
        );
        vault.approveForTrade(address(initToken), 100e18);
    }

    function test_Security_MaxTradeBpsEnforced() public {
        _subscribe(alice, 100_000e18);
        // maxTradeBps = 10% = 10_000e18 max → 11_001e18 exceeds it
        uint256 overAmount = 11_001e18;
        uint256 maxAllowed = 100_000e18 * MAX_TRADE_BPS / 10_000;

        vm.prank(address(executor));
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentVault__ExceedsMaxTradePercent.selector,
                overAmount,
                maxAllowed
            )
        );
        vault.approveForTrade(address(initToken), overAmount);
    }

    function test_Security_CooldownEnforced() public {
        _subscribe(alice, 100_000e18);

        // First trade succeeds
        vm.prank(address(executor));
        vault.approveForTrade(address(initToken), 1_000e18);

        // Second trade too soon
        _advance(INTERVAL - 1);
        vm.prank(address(executor));
        vm.expectRevert(); // CooldownNotElapsed
        vault.approveForTrade(address(initToken), 1_000e18);

        // Third trade at exactly INTERVAL succeeds
        _advance(1);
        vm.prank(address(executor));
        vault.approveForTrade(address(initToken), 1_000e18);
    }

    function test_Security_AllowedTokensEnforced() public {
        _subscribe(alice, 100_000e18);
        MockERC20 rando = new MockERC20("RANDO", "RANDO");

        vm.prank(address(executor));
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__TokenNotWhitelisted.selector, address(rando))
        );
        vault.approveForTrade(address(rando), 100e18);
    }

    function test_Security_SplitterSetOnlyOnce() public {
        // Register vault (calls setSplitter on vault)
        _setupSplitter();
        // Second attempt must revert
        vm.prank(address(splitter));
        vm.expectRevert(abi.encodeWithSelector(AgentVault__SplitterAlreadySet.selector));
        vault.setSplitter(address(splitter));
    }

    // ── Preview ───────────────────────────────────────────────────────────

    function test_PreviewDeposit_MatchesActual() public {
        _subscribe(alice, 5_000e18);
        uint256 preview = vault.previewDeposit(1_000e18);

        vm.startPrank(bob);
        initToken.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18);
        vm.stopPrank();

        assertApproxEqAbs(vault.shares(bob), preview, 1);
    }

    function test_PreviewWithdraw_MatchesActual() public {
        _subscribe(alice, 5_000e18);
        uint256 preview = vault.previewWithdraw(2_500e18);

        uint256 balBefore = initToken.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw(2_500e18);

        assertApproxEqAbs(initToken.balanceOf(alice) - balBefore, preview, 1);
    }

    // ── WithdrawForSplitter ───────────────────────────────────────────────

    function test_WithdrawForSplitter_Success() public {
        _setupSplitter();
        _subscribe(alice, 10_000e18);

        uint256 treaBefore = initToken.balanceOf(treasury);
        vm.prank(address(splitter));
        vault.withdrawForSplitter(treasury, 200e18);

        assertEq(initToken.balanceOf(treasury) - treaBefore, 200e18);
        assertEq(vault.totalAssets(), 9_800e18);
    }

    function test_WithdrawForSplitter_Revert_NotSplitter() public {
        _setupSplitter();
        _subscribe(alice, 1_000e18);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__NotSplitter.selector, alice)
        );
        vault.withdrawForSplitter(treasury, 100e18);
    }

    function test_WithdrawForSplitter_Revert_InsufficientAssets() public {
        _setupSplitter();
        _subscribe(alice, 100e18);
        vm.prank(address(splitter));
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__InsufficientAssets.selector, 101e18, 100e18)
        );
        vault.withdrawForSplitter(treasury, 101e18);
    }

    // ── reconcileAssets ───────────────────────────────────────────────────

    function test_ReconcileAssets_ByExecutor() public {
        _subscribe(alice, 1_000e18);
        initToken.mint(address(vault), 100e18);

        vm.prank(address(executor));
        vault.reconcileAssets();

        assertEq(vault.totalAssets(), 1_100e18);
    }

    function test_ReconcileAssets_Revert_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentVault__UnauthorizedReconciler.selector, alice)
        );
        vault.reconcileAssets();
    }
}
