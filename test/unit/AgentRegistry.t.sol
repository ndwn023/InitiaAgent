// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "../helpers/TestSetup.sol";
import {AgentRegistry} from "../../src/AgentRegistry.sol";
import {AgentVault}    from "../../src/AgentVault.sol";
import {IAgentRegistry} from "../../src/interfaces/IAgentRegistry.sol";
import {
    AgentRegistry__EmptyName,
    AgentRegistry__EmptyStrategyType,
    AgentRegistry__InvalidVaultAddress,
    AgentRegistry__VaultAlreadyRegistered,
    AgentRegistry__AgentNotFound,
    AgentRegistry__NotCreator,
    AgentRegistry__AgentNotActive,
    AgentRegistry__AgentAlreadyActive,
    AgentRegistry__Unauthorized
} from "../../src/errors/Errors.sol";

contract AgentRegistryTest is TestSetup {

    // ── registerAgent ────────────────────────────────────────────────────

    function test_RegisterAgent_Success() public view {
        assertEq(registry.agentCount(), 1);
        IAgentRegistry.AgentInfo memory info = registry.getAgent(1);
        assertEq(info.creator,      creator);
        assertEq(info.vaultAddress, address(vault));
        assertTrue(info.isActive);

        IAgentRegistry.AgentInfo memory byVault = registry.getAgentByVault(address(vault));
        assertEq(byVault.creator, creator);
    }

    function test_RegisterAgent_Revert_EmptyName() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry__EmptyName.selector));
        registry.registerAgent("", "DCA", address(0xBEEF));
    }

    function test_RegisterAgent_Revert_EmptyStrategy() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry__EmptyStrategyType.selector));
        registry.registerAgent("Test", "", address(0xBEEF));
    }

    function test_RegisterAgent_Revert_ZeroVault() public {
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry__InvalidVaultAddress.selector));
        registry.registerAgent("Test", "DCA", address(0));
    }

    function test_RegisterAgent_Revert_DuplicateVault() public {
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry__VaultAlreadyRegistered.selector, address(vault))
        );
        registry.registerAgent("Dup", "DCA", address(vault));
    }

    // ── deactivateAgent ──────────────────────────────────────────────────

    function test_DeactivateAgent_Success() public {
        vm.prank(creator);
        registry.deactivateAgent(agentId);
        assertFalse(registry.isActive(agentId));
    }

    function test_DeactivateAgent_Revert_NotCreator() public {
        IAgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry__NotCreator.selector, alice, info.creator)
        );
        registry.deactivateAgent(agentId);
    }

    function test_DeactivateAgent_Revert_AlreadyInactive() public {
        vm.startPrank(creator);
        registry.deactivateAgent(agentId);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry__AgentNotActive.selector, agentId)
        );
        registry.deactivateAgent(agentId);
        vm.stopPrank();
    }

    // ── reactivateAgent ──────────────────────────────────────────────────

    function test_ReactivateAgent_Success() public {
        vm.startPrank(creator);
        registry.deactivateAgent(agentId);
        registry.reactivateAgent(agentId);
        vm.stopPrank();
        assertTrue(registry.isActive(agentId));
    }

    function test_ReactivateAgent_Revert_AlreadyActive() public {
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry__AgentAlreadyActive.selector, agentId)
        );
        registry.reactivateAgent(agentId);
    }

    // ── updateSubscriberCount ────────────────────────────────────────────

    function test_UpdateSubscriberCount_Success() public {
        // Vault calls updateSubscriberCount when alice deposits
        _subscribe(alice, 1_000e18);
        IAgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        assertEq(info.totalSubscribers, 1);
    }

    function test_UpdateSubscriberCount_Revert_NotVault() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry__Unauthorized.selector, alice)
        );
        registry.updateSubscriberCount(agentId, true);
    }

    // ── pagination ───────────────────────────────────────────────────────

    function test_GetActiveAgentsPaginated() public {
        // Already have agentId=1 active. Register 4 more (total 5).
        address[] memory allowed = new address[](1);
        allowed[0] = address(initToken);

        vm.startPrank(creator);
        for (uint256 i = 2; i <= 5; i++) {
            // Each needs a unique vault address
            AgentVault v = new AgentVault(
                address(initToken),
                i,
                creator,
                address(registry),
                address(executor),
                INTERVAL,
                MAX_TRADE_BPS,
                0,
                allowed
            );
            registry.registerAgent(
                string(abi.encodePacked("Agent", i)),
                "DCA",
                address(v)
            );
        }
        // Deactivate agents 2 and 3
        registry.deactivateAgent(2);
        registry.deactivateAgent(3);
        vm.stopPrank();

        (IAgentRegistry.AgentInfo[] memory page, uint256 total) =
            registry.getActiveAgentsPaginated(0, 3);

        assertEq(total, 3, "3 active agents");
        assertEq(page.length, 3, "page size 3");
    }
}
