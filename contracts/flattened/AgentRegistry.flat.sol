// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20 ^0.8.24;

// lib/openzeppelin-contracts/contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// src/errors/Errors.sol

// ── AgentRegistry ──────────────────────────────────────────────────────
error AgentRegistry__EmptyName();
error AgentRegistry__EmptyStrategyType();
error AgentRegistry__InvalidVaultAddress();
error AgentRegistry__VaultAlreadyRegistered(address vault);
error AgentRegistry__AgentNotFound(uint256 agentId);
error AgentRegistry__NotCreator(address caller, address expected);
error AgentRegistry__AgentNotActive(uint256 agentId);
error AgentRegistry__AgentAlreadyActive(uint256 agentId);
error AgentRegistry__Unauthorized(address caller);

// ── AgentVault ─────────────────────────────────────────────────────────
error AgentVault__ZeroAmount();
error AgentVault__ZeroShares();
error AgentVault__InsufficientShares(uint256 requested, uint256 available);
error AgentVault__InsufficientAssets(uint256 requested, uint256 available);
error AgentVault__DepositCapExceeded(uint256 attempted, uint256 cap);
error AgentVault__TokenNotWhitelisted(address token);
error AgentVault__ExceedsMaxTradePercent(uint256 bps, uint256 maxBps);
error AgentVault__CooldownNotElapsed(uint256 earliest, uint256 now_);
error AgentVault__NotExecutor(address caller);
error AgentVault__NotCreator(address caller);
error AgentVault__NotSplitter(address caller);
error AgentVault__VaultPaused();
error AgentVault__SplitterAlreadySet();
error AgentVault__InvalidParam(string param);
error AgentVault__MaxTradePercentOutOfRange(uint256 bps);
error AgentVault__IntervalTooShort(uint256 given, uint256 min);
error AgentVault__UnauthorizedReconciler(address caller);

// ── AgentExecutor ──────────────────────────────────────────────────────
error AgentExecutor__NotAuthorizedRunner(address caller, uint256 agentId);
error AgentExecutor__AgentNotActive(uint256 agentId);
error AgentExecutor__DeadlineExpired(uint256 deadline, uint256 blockTs);
error AgentExecutor__SameToken(address token);
error AgentExecutor__ZeroMinOutput();
error AgentExecutor__SlippageExceeded(uint256 received, uint256 minimum);
error AgentExecutor__InvalidDEX(address dex);
error AgentExecutor__InvalidRegistry(address registry);
error AgentExecutor__SwapFailed();
error AgentExecutor__NotCreator(address caller, uint256 agentId);
error AgentExecutor__RunnerAlreadyAuthorized(address runner, uint256 agentId);
error AgentExecutor__RunnerNotAuthorized(address runner, uint256 agentId);

// ── ProfitSplitter ─────────────────────────────────────────────────────
error ProfitSplitter__EpochNotElapsed(uint256 earliest, uint256 now_);
error ProfitSplitter__NoProfit();
error ProfitSplitter__VaultNotRegistered(address vault);
error ProfitSplitter__InvalidProtocolFeeBps(uint256 bps, uint256 max);
error ProfitSplitter__InvalidCreatorShareBps(uint256 bps, uint256 max);
error ProfitSplitter__ZeroRegistry();
error ProfitSplitter__ZeroAsset();
error ProfitSplitter__ZeroTreasury();
error ProfitSplitter__InvalidEpochDuration(uint256 given, uint256 min);
error ProfitSplitter__AlreadyRegistered(uint256 agentId);
error ProfitSplitter__Unauthorized(address caller);

// src/events/Events.sol

// ── AgentRegistry ──────────────────────────────────────────────────────
event AgentRegistered(
    uint256 indexed agentId,
    address indexed creator,
    address indexed vaultAddress,
    string  name,
    string  strategyType
);
event AgentDeactivated(uint256 indexed agentId, address indexed by);
event AgentReactivated(uint256 indexed agentId, address indexed by);
event SubscriberCountUpdated(uint256 indexed agentId, uint256 newCount);

// ── AgentVault ─────────────────────────────────────────────────────────
event Deposited(
    uint256 indexed agentId,
    address indexed subscriber,
    uint256 assets,
    uint256 shares
);
event Withdrawn(
    uint256 indexed agentId,
    address indexed subscriber,
    uint256 assets,
    uint256 shares
);
event TradeApproved(
    uint256 indexed agentId,
    address indexed token,
    uint256 amount,
    uint256 timestamp
);
event TotalAssetsReconciled(uint256 indexed agentId, uint256 newTotal);
event VaultPaused(uint256 indexed agentId);
event VaultUnpaused(uint256 indexed agentId);
event DepositCapUpdated(uint256 indexed agentId, uint256 newCap);
event ExecutorUpdated(uint256 indexed agentId, address newExecutor);
event SplitterSet(uint256 indexed agentId, address splitter);
event SplitterWithdrawal(
    uint256 indexed agentId,
    address indexed to,
    uint256 amount
);

// ── AgentExecutor ──────────────────────────────────────────────────────
event SwapExecuted(
    uint256 indexed agentId,
    address indexed runner,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
);
event RunnerAuthorized(uint256 indexed agentId, address indexed runner);
event RunnerRevoked(uint256 indexed agentId, address indexed runner);
event DEXUpdated(address oldDex, address newDex);

// ── ProfitSplitter ─────────────────────────────────────────────────────
event ProfitDistributed(
    uint256 indexed agentId,
    uint256 grossProfit,
    uint256 protocolFee,
    uint256 creatorShare,
    uint256 subscriberShare,
    uint256 epochTimestamp
);
event SnapshotTaken(uint256 indexed agentId, uint256 value, uint256 ts);
event VaultRegisteredInSplitter(uint256 indexed agentId, address vault);
event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);
event CreatorShareUpdated(uint256 oldBps, uint256 newBps);
event TreasuryUpdated(address oldTreasury, address newTreasury);

// src/interfaces/IAgentRegistry.sol

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

// lib/openzeppelin-contracts/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// lib/openzeppelin-contracts/contracts/access/Ownable2Step.sol

// OpenZeppelin Contracts (last updated v5.1.0) (access/Ownable2Step.sol)

/**
 * @dev Contract module which provides access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This extension of the {Ownable} contract includes a two-step mechanism to transfer
 * ownership, where the new owner must call {acceptOwnership} in order to replace the
 * old one. This can help prevent common mistakes, such as transfers of ownership to
 * incorrect accounts, or to contracts that are unable to interact with the
 * permission system.
 *
 * The initial owner is specified at deployment time in the constructor for `Ownable`. This
 * can later be changed with {transferOwnership} and {acceptOwnership}.
 *
 * This module is used through inheritance. It will make available all functions
 * from parent (Ownable).
 */
abstract contract Ownable2Step is Ownable {
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Returns the address of the pending owner.
     */
    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    /**
     * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
     * Can only be called by the current owner.
     *
     * Setting `newOwner` to the zero address is allowed; this can be used to cancel an initiated ownership transfer.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`) and deletes any pending owner.
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual override {
        delete _pendingOwner;
        super._transferOwnership(newOwner);
    }

    /**
     * @dev The new owner accepts the ownership transfer.
     */
    function acceptOwnership() public virtual {
        address sender = _msgSender();
        if (pendingOwner() != sender) {
            revert OwnableUnauthorizedAccount(sender);
        }
        _transferOwnership(sender);
    }
}

// src/AgentRegistry.sol

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
