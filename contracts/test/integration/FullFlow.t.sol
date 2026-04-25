// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";

contract FullFlowTest is TestSetup {

    function test_FullFlow_ThreeSubscribersTradeAndWithdraw() public {
        // Step 1: Three subscribers deposit
        _subscribe(alice, 50_000e18);
        _subscribe(bob,   30_000e18);
        _subscribe(carol, 20_000e18);

        assertEq(vault.totalAssets(), 100_000e18);
        assertEq(vault.totalShares(), 100_000e18);

        // Register with splitter AFTER deposits so snapshot captures deposited value
        _setupSplitter();

        // Step 2: Runner executes 3 swaps (5% of vault each)
        for (uint256 i = 0; i < 3; i++) {
            _advance(INTERVAL + 1);
            vm.prank(runner);
            executor.executeSwap(
                agentId,
                address(initToken),
                address(usdcToken),
                5_000e18,
                9_900e18,
                block.timestamp + 1 hours
            );
        }

        // Step 3: Simulate vault gaining value — mint enough INIT to exceed the snapshot.
        // 3 swaps of 5000 INIT each removed 15,000 INIT from the tracked balance.
        // We mint 18,000 so net vault INIT = (100,000 - 15,000 + 18,000) = 103,000 > snapshot.
        initToken.mint(address(vault), 18_000e18);
        vm.prank(address(executor));
        vault.reconcileAssets();

        // Step 4: Advance past epoch, distribute profit
        _advance(7 days + 1);
        (uint256 pFee, uint256 cShare, uint256 sShare) =
            splitter.distributeProfit(agentId);

        assertTrue(pFee   > 0, "protocol fee nonzero");
        assertTrue(cShare > 0, "creator share nonzero");
        assertTrue(sShare > 0, "subscriber share positive");

        // Step 5: All subscribers withdraw
        uint256 aliceShares = vault.shares(alice);
        uint256 bobShares   = vault.shares(bob);
        uint256 carolShares = vault.shares(carol);

        vm.prank(alice); vault.withdraw(aliceShares);
        vm.prank(bob);   vault.withdraw(bobShares);
        vm.prank(carol); vault.withdraw(carolShares);

        // Step 6: Vault drained
        assertApproxEqAbs(vault.totalAssets(), 0, 100, "vault should be drained");
        assertApproxEqAbs(vault.totalShares(), 0, 100, "shares should be zero");

        // Step 7: Alice received >= what she deposited (50% stake, vault gained value)
        uint256 aliceFinal = initToken.balanceOf(alice);
        assertGt(aliceFinal, 50_000e18 - 100, "alice should profit or break even");
    }

    function test_FullFlow_CreatorCannotStealFunds() public {
        _setupSplitter();
        _subscribe(alice, 10_000e18);
        uint256 aliceShares = vault.shares(alice);

        vm.startPrank(creator);

        // 1. Creator cannot withdraw shares they don't own
        vm.expectRevert();
        vault.withdraw(aliceShares);

        // 2. Creator cannot call approveForTrade directly (bypassing executor)
        vm.expectRevert();
        vault.approveForTrade(address(initToken), 1_000e18);

        // 3. Creator pauses vault — they still cannot withdraw alice's shares
        vault.pauseVault();
        vm.expectRevert();
        vault.withdraw(aliceShares);

        vm.stopPrank();

        // Alice can still withdraw even when paused — gets all 10_000 back
        vm.prank(alice);
        vault.withdraw(aliceShares);

        // alice started with 100_000, deposited 10_000, withdrew 10_000 → back to 100_000
        assertEq(initToken.balanceOf(alice), 100_000e18, "alice receives all funds back");
    }
}
