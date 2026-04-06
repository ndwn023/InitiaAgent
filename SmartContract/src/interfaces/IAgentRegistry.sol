// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentRegistry
/// @notice Interface for the AgentRegistry contract
interface IAgentRegistry {
    struct AgentInfo {
        address  creator;
        address  vaultAddress;
        uint96   createdAt;
        bool     isActive;
        uint8    pad0;
        uint16   pad1;
        uint32   totalSubscribers;
        uint128  totalVolumeTraded;
        string   name;
        string   strategyType;
    }

    /// @notice Register a new agent
    /// @param name          Human-readable agent name
    /// @param strategyType  Strategy identifier (e.g. "DCA")
    /// @param vaultAddress  Address of the AgentVault contract
    /// @return agentId The assigned agent ID
    function registerAgent(
        string calldata name,
        string calldata strategyType,
        address vaultAddress
    ) external returns (uint256 agentId);

    /// @notice Deactivate an agent
    /// @param agentId The agent to deactivate
    function deactivateAgent(uint256 agentId) external;

    /// @notice Reactivate a previously deactivated agent
    /// @param agentId The agent to reactivate
    function reactivateAgent(uint256 agentId) external;

    /// @notice Update subscriber count; callable only by the registered vault
    /// @param agentId   The agent ID
    /// @param increment True to increment, false to decrement
    function updateSubscriberCount(uint256 agentId, bool increment) external;

    /// @notice Update volume traded; callable only by the registered vault
    /// @param agentId The agent ID
    /// @param volume  Volume amount to add
    function updateVolumeTraded(uint256 agentId, uint128 volume) external;

    /// @notice Get agent info by ID
    /// @param agentId The agent ID
    /// @return Agent info struct
    function getAgent(uint256 agentId) external view returns (AgentInfo memory);

    /// @notice Get agent info by vault address
    /// @param vault The vault address
    /// @return Agent info struct
    function getAgentByVault(address vault) external view returns (AgentInfo memory);

    /// @notice Get all agent IDs created by a given address
    /// @param creator The creator address
    /// @return Array of agent IDs
    function getCreatorAgents(address creator) external view returns (uint256[] memory);

    /// @notice Check if an agent is active
    /// @param agentId The agent ID
    /// @return True if active
    function isActive(uint256 agentId) external view returns (bool);

    /// @notice Paginated list of active agents
    /// @param offset Starting index
    /// @param limit  Max results
    /// @return page  Slice of active AgentInfo
    /// @return total Total number of active agents
    function getActiveAgentsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (AgentInfo[] memory page, uint256 total);
}
