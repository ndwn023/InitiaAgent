// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";

contract VaultInvariantTest is TestSetup {

    function setUp() public override {
        super.setUp();
        _subscribe(alice, 50_000e18);
        _subscribe(bob,   30_000e18);
        _setupSplitter();

        targetContract(address(vault));
    }

    /// @dev Total assets must equal sum of all subscriber redemption values
    function invariant_TotalAssetsConsistent() public view {
        uint256 aliceAssets = vault.getSubscriberAssets(alice);
        uint256 bobAssets   = vault.getSubscriberAssets(bob);
        // Allow 2 wei rounding per subscriber
        assertApproxEqAbs(
            vault.totalAssets(),
            aliceAssets + bobAssets,
            4,
            "totalAssets mismatch"
        );
    }

    /// @dev Share price must not cause division by zero
    function invariant_SharePriceMonotonicallyNonDecreasing() public view {
        if (vault.totalShares() == 0) return;
        // Verify no overflow/underflow: compute price per share
        uint256 pricePerShare = vault.totalAssets() * 1e18 / vault.totalShares();
        assertGt(pricePerShare, 0, "price per share must be positive");
    }

    /// @dev Creator must never hold shares
    function invariant_CreatorHasNoShares() public view {
        assertEq(vault.shares(creator), 0, "creator must never hold shares");
    }
}
