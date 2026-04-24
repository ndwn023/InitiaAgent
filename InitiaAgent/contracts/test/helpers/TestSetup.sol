// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockERC20}     from "../../src/mocks/MockERC20.sol";
import {MockInitiaDEX} from "../../src/mocks/MockInitiaDEX.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {AgentVault}    from "../../src/AgentVault.sol";
import {AgentExecutor} from "../../src/AgentExecutor.sol";
import {ProfitSplitter} from "../../src/ProfitSplitter.sol";

contract TestSetup is Test {
    // ─── Actors ───────────────────────────────────────────────────────────
    address internal owner    = makeAddr("owner");
    address internal creator  = makeAddr("creator");
    address internal runner   = makeAddr("runner");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");
    address internal carol    = makeAddr("carol");
    address internal treasury = makeAddr("treasury");

    // ─── Contracts ────────────────────────────────────────────────────────
    MockERC20      internal initToken;
    MockERC20      internal usdcToken;
    MockInitiaDEX  internal dex;
    AgentRegistry  internal registry;
    AgentVault     internal vault;
    AgentExecutor  internal executor;
    ProfitSplitter internal splitter;

    uint256 internal agentId;

    uint256 constant INTERVAL      = 15 minutes;
    uint256 constant MAX_TRADE_BPS = 1_000; // 10%
    uint256 constant DEPOSIT_CAP   = 0;     // unlimited

    function setUp() public virtual {
        vm.startPrank(owner);

        // Deploy tokens
        initToken = new MockERC20("INIT", "INIT");
        usdcToken = new MockERC20("USDC", "USDC");

        // Mint to actors
        initToken.mint(alice,  100_000e18);
        initToken.mint(bob,    100_000e18);
        initToken.mint(carol,   50_000e18);

        // DEX: 1 INIT = 2 USDC, 1 USDC = 0.5 INIT
        dex = new MockInitiaDEX();
        dex.setRate(address(initToken), address(usdcToken), 2e18);
        dex.setRate(address(usdcToken), address(initToken), 0.5e18);
        initToken.mint(address(dex), 10_000_000e18);
        usdcToken.mint(address(dex), 10_000_000e18);

        // Core contracts
        registry = new AgentRegistry(owner);
        executor = new AgentExecutor(address(registry), address(dex), owner);
        splitter = new ProfitSplitter(
            address(registry),
            address(initToken),
            treasury,
            200,    // 2% protocol fee
            2000,   // 20% creator share
            7 days
        );

        vm.stopPrank();

        // ── Deploy vault then register agent ──────────────────────────────
        // agentCount starts at 0; first registration will be id=1.
        // We pre-compute agentId=1 and pass it to the vault constructor.
        address[] memory allowed = new address[](2);
        allowed[0] = address(initToken);
        allowed[1] = address(usdcToken);

        vm.startPrank(creator);

        vault = new AgentVault(
            address(initToken),
            1,                   // pre-computed agentId
            creator,
            address(registry),
            address(executor),
            INTERVAL,
            MAX_TRADE_BPS,
            DEPOSIT_CAP,
            allowed
        );

        agentId = registry.registerAgent("DCA Alpha", "DCA", address(vault));
        assertEq(agentId, 1, "pre-computed agentId mismatch");

        executor.authorizeRunner(agentId, runner);

        vm.stopPrank();

        // Advance past the initial cooldown so trade tests start clean
        vm.warp(block.timestamp + INTERVAL + 1);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    /// @dev Register vault in splitter (snapshot captures current vault value).
    ///      Call this AFTER any initial subscriptions so deposits aren't counted as profit.
    function _setupSplitter() internal {
        splitter.registerVault(agentId, address(vault));
    }

    /// @dev Subscribe a user to the vault with a given amount
    function _subscribe(address user, uint256 amount) internal {
        vm.startPrank(user);
        initToken.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    /// @dev Advance block timestamp by secs
    function _advance(uint256 secs) internal {
        vm.warp(block.timestamp + secs);
    }
}
