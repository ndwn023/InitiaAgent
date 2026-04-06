// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";
import {
    ProfitSplitter__EpochNotElapsed,
    ProfitSplitter__NoProfit,
    ProfitSplitter__VaultNotRegistered,
    ProfitSplitter__InvalidProtocolFeeBps,
    ProfitSplitter__InvalidCreatorShareBps,
    ProfitSplitter__ZeroTreasury,
    ProfitSplitter__AlreadyRegistered
} from "../../src/errors/Errors.sol";

contract ProfitSplitterTest is TestSetup {

    /// @dev Subscribe alice and bob, then register with splitter so snapshot
    ///      captures post-deposit value (deposits are not counted as profit).
    function _splitterSetup() internal {
        _subscribe(alice, 6_000e18);
        _subscribe(bob,   4_000e18);
        _setupSplitter();
    }

    // ── registerVault ─────────────────────────────────────────────────────

    function test_RegisterVault_Success() public {
        _setupSplitter();
        assertEq(splitter.agentVault(agentId), address(vault));
    }

    function test_RegisterVault_Revert_AlreadyRegistered() public {
        _setupSplitter();
        vm.prank(address(splitter));
        vm.expectRevert(
            abi.encodeWithSelector(ProfitSplitter__AlreadyRegistered.selector, agentId)
        );
        splitter.registerVault(agentId, address(vault));
    }

    // ── distributeProfit ──────────────────────────────────────────────────

    function test_DistributeProfit_Success() public {
        _splitterSetup(); // subscribe 10_000 then snapshot

        // Simulate vault earning 1000 INIT
        initToken.mint(address(vault), 1_000e18);
        vm.prank(address(executor));
        vault.reconcileAssets();

        _advance(7 days + 1);

        (uint256 pFee, uint256 cShare, uint256 sShare) = splitter.distributeProfit(agentId);

        // 2% of 1000 = 20
        assertApproxEqAbs(pFee,   20e18,  10);
        // 20% of (1000 - 20) = 196
        assertApproxEqAbs(cShare, 196e18, 10);
        // remainder = 784
        assertApproxEqAbs(sShare, 784e18, 10);

        assertApproxEqAbs(initToken.balanceOf(treasury), 20e18,  10);
        assertApproxEqAbs(initToken.balanceOf(creator),  196e18, 10);
    }

    function test_DistributeProfit_Revert_EpochNotElapsed() public {
        _splitterSetup();
        initToken.mint(address(vault), 100e18);
        vm.prank(address(executor));
        vault.reconcileAssets();

        _advance(6 days);

        vm.expectRevert(); // ProfitSplitter__EpochNotElapsed
        splitter.distributeProfit(agentId);
    }

    function test_DistributeProfit_Revert_NoProfit() public {
        _splitterSetup();
        _advance(7 days + 1);

        vm.expectRevert(abi.encodeWithSelector(ProfitSplitter__NoProfit.selector));
        splitter.distributeProfit(agentId);
    }

    function test_DistributeProfit_CorrectSplit_MathVerification() public {
        _subscribe(alice, 10_000e18);
        _setupSplitter();

        initToken.mint(address(vault), 1_000e18);
        vm.prank(address(executor));
        vault.reconcileAssets();

        _advance(7 days + 1);

        (uint256 pFee, uint256 cShare, uint256 sShare) = splitter.distributeProfit(agentId);

        uint256 expectedProtocol   = 1_000e18 * 200 / 10_000;           // 20e18
        uint256 expectedNet        = 1_000e18 - expectedProtocol;        // 980e18
        uint256 expectedCreator    = expectedNet * 2_000 / 10_000;       // 196e18
        uint256 expectedSubscriber = expectedNet - expectedCreator;       // 784e18

        assertApproxEqAbs(pFee,   expectedProtocol,   10);
        assertApproxEqAbs(cShare, expectedCreator,     10);
        assertApproxEqAbs(sShare, expectedSubscriber,  10);
    }

    function test_CanDistribute_ReturnsFalseBeforeEpoch() public {
        _setupSplitter();
        (bool ok, uint256 remaining) = splitter.canDistribute(agentId);
        assertFalse(ok);
        assertGt(remaining, 0);
    }

    function test_CanDistribute_ReturnsTrueAfterEpoch() public {
        _setupSplitter();
        _advance(7 days + 1);
        (bool ok, uint256 remaining) = splitter.canDistribute(agentId);
        assertTrue(ok);
        assertEq(remaining, 0);
    }

    // ── Admin setters ─────────────────────────────────────────────────────

    function test_AdminSetters_ProtocolFee() public {
        vm.prank(owner);
        splitter.setProtocolFee(500);
        assertEq(splitter.protocolFeeBps(), 500);
    }

    function test_AdminSetters_CreatorShare() public {
        vm.prank(owner);
        splitter.setCreatorShare(3_000);
        assertEq(splitter.creatorShareBps(), 3_000);
    }

    function test_AdminSetters_Treasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        splitter.setTreasury(newTreasury);
        assertEq(splitter.protocolTreasury(), newTreasury);
    }

    function test_AdminSetters_Revert_ExceedsCap() public {
        vm.startPrank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                ProfitSplitter__InvalidProtocolFeeBps.selector,
                1_001, 1_000
            )
        );
        splitter.setProtocolFee(1_001);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProfitSplitter__InvalidCreatorShareBps.selector,
                5_001, 5_000
            )
        );
        splitter.setCreatorShare(5_001);
        vm.stopPrank();
    }
}
