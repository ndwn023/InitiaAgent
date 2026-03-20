// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
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
} from "./errors/Errors.sol";
import {
    AgentRegistered,
    AgentDeactivated,
    AgentReactivated,
    SubscriberCountUpdated
} from "./events/Events.sol";

/// @title AgentRegistry
/// @notice Directory of all registered trading agents
contract AgentRegistry is IAgentRegistry, Ownable2Step {
    // ─── Struct note ─────────────────────────────────────────────────────
    // AgentInfo is defined in IAgentRegistry. Storage layout (tight packing):
    //   Slot 0: creator (20 bytes) — own slot
    //   Slot 1: vaultAddress (20 bytes) + createdAt uint96 (12 bytes) = 32 bytes
    //   Slot 2: isActive (1) + pad0 (1) + pad1 (2) + totalSubscribers (4) +
    //           totalVolumeTraded (16) = 24 bytes — fits in one slot
    //   Slots 3+: name (dynamic) and strategyType (dynamic) each get their own slot

    // ─── State ───────────────────────────────────────────────────────────
    uint256 public agentCount;

    mapping(uint256 => AgentInfo)    private _agents;
    mapping(address => uint256)      private _vaultToId;
    mapping(address => uint256[])    private _creatorIds;
    mapping(address => bool)         private _knownVaults;
    address public executorAddress;

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address owner_) Ownable(owner_) {}

    /// @notice Set the executor address allowed to update volume
    /// @param executor_ The AgentExecutor contract address
    function setExecutor(address executor_) external onlyOwner {
        executorAddress = executor_;
    }

    // ─── External functions ───────────────────────────────────────────────

    /// @notice Register a new agent and vault
    /// @param name          Human-readable agent name
    /// @param strategyType  Strategy identifier
    /// @param vaultAddress  Address of the AgentVault
    /// @return agentId      The assigned agent ID
    function registerAgent(
        string calldata name,
        string calldata strategyType,
        address vaultAddress
    ) external override returns (uint256 agentId) {
        if (bytes(name).length == 0)         revert AgentRegistry__EmptyName();
        if (bytes(strategyType).length == 0) revert AgentRegistry__EmptyStrategyType();
        if (vaultAddress == address(0))      revert AgentRegistry__InvalidVaultAddress();
        if (_knownVaults[vaultAddress])      revert AgentRegistry__VaultAlreadyRegistered(vaultAddress);

        agentId = ++agentCount;

        _agents[agentId] = AgentInfo({
            creator:           msg.sender,
            vaultAddress:      vaultAddress,
            createdAt:         uint96(block.timestamp),
            isActive:          true,
            pad0:              0,
            pad1:              0,
            totalSubscribers:  0,
            totalVolumeTraded: 0,
            name:              name,
            strategyType:      strategyType
        });

        _vaultToId[vaultAddress]    = agentId;
        _knownVaults[vaultAddress]  = true;
        _creatorIds[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, vaultAddress, name, strategyType);
    }

    /// @notice Deactivate an agent
    /// @param agentId The agent to deactivate
    function deactivateAgent(uint256 agentId) external override {
        _requireExists(agentId);
        AgentInfo storage info = _agents[agentId];
        if (msg.sender != info.creator && msg.sender != owner())
            revert AgentRegistry__NotCreator(msg.sender, info.creator);
        if (!info.isActive) revert AgentRegistry__AgentNotActive(agentId);

        info.isActive = false;
        emit AgentDeactivated(agentId, msg.sender);
    }

    /// @notice Reactivate a previously deactivated agent
    /// @param agentId The agent to reactivate
    function reactivateAgent(uint256 agentId) external override {
        _requireExists(agentId);
        AgentInfo storage info = _agents[agentId];
        if (msg.sender != info.creator && msg.sender != owner())
            revert AgentRegistry__NotCreator(msg.sender, info.creator);
        if (info.isActive) revert AgentRegistry__AgentAlreadyActive(agentId);

        info.isActive = true;
        emit AgentReactivated(agentId, msg.sender);
    }

    /// @notice Update subscriber count; only callable by the registered vault
    /// @param agentId   The agent ID
    /// @param increment True to add, false to subtract
    function updateSubscriberCount(uint256 agentId, bool increment) external override {
        _requireExists(agentId);
        if (msg.sender != _agents[agentId].vaultAddress)
            revert AgentRegistry__Unauthorized(msg.sender);

        AgentInfo storage info = _agents[agentId];
        if (increment) {
            info.totalSubscribers++;
        } else {
            // underflow guard — totalSubscribers is uint32, subtraction is safe when > 0
            if (info.totalSubscribers > 0) info.totalSubscribers--;
        }

        emit SubscriberCountUpdated(agentId, info.totalSubscribers);
    }

    /// @notice Update volume traded; only callable by the registered vault
    /// @param agentId The agent ID
    /// @param volume  Volume to add
    function updateVolumeTraded(uint256 agentId, uint128 volume) external override {
        _requireExists(agentId);
        if (msg.sender != _agents[agentId].vaultAddress && msg.sender != executorAddress)
            revert AgentRegistry__Unauthorized(msg.sender);

        // uint128 addition — max ~3.4e38, overflow is practically impossible
        _agents[agentId].totalVolumeTraded += volume;
    }

    // ─── View functions ───────────────────────────────────────────────────

    /// @notice Get agent info by ID
    /// @param agentId The agent ID
    /// @return Agent info struct
    function getAgent(uint256 agentId) external view override returns (AgentInfo memory) {
        _requireExists(agentId);
        return _agents[agentId];
    }

    /// @notice Get agent info by vault address
    /// @param vault The vault address
    /// @return Agent info struct
    function getAgentByVault(address vault) external view override returns (AgentInfo memory) {
        uint256 id = _vaultToId[vault];
        _requireExists(id);
        return _agents[id];
    }

    /// @notice Get all agent IDs for a creator
    /// @param creator_ The creator address
    /// @return Array of agent IDs
    function getCreatorAgents(address creator_) external view override returns (uint256[] memory) {
        return _creatorIds[creator_];
    }

    /// @notice Check if an agent is currently active
    /// @param agentId The agent ID
    /// @return True if active
    function isActive(uint256 agentId) external view override returns (bool) {
        _requireExists(agentId);
        return _agents[agentId].isActive;
    }

    /// @notice Paginated query of active agents
    /// @param offset Starting index within the active set
    /// @param limit  Maximum number of results
    /// @return page  Slice of active AgentInfo structs
    /// @return total Total count of active agents
    function getActiveAgentsPaginated(uint256 offset, uint256 limit)
        external
        view
        override
        returns (AgentInfo[] memory page, uint256 total)
    {
        // First pass: count active agents
        for (uint256 i = 1; i <= agentCount; i++) {
            if (_agents[i].isActive) total++;
        }

        if (offset >= total || limit == 0) {
            return (new AgentInfo[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 pageLen = end - offset;

        page = new AgentInfo[](pageLen);
        uint256 activeIdx;
        uint256 pageIdx;

        for (uint256 i = 1; i <= agentCount && pageIdx < pageLen; i++) {
            if (_agents[i].isActive) {
                if (activeIdx >= offset) {
                    page[pageIdx++] = _agents[i];
                }
                activeIdx++;
            }
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    /// @dev Revert if agent does not exist
    function _requireExists(uint256 agentId) internal view {
        if (agentId == 0 || agentId > agentCount)
            revert AgentRegistry__AgentNotFound(agentId);
    }
}
