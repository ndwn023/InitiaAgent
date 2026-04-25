// SPDX-License-Identifier: MIT
pragma solidity >=0.4.16 >=0.6.2 ^0.8.20 ^0.8.24;

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

// src/interfaces/IAgentVault.sol

/// @title IAgentVault
/// @notice Interface for the AgentVault contract
interface IAgentVault {
    /// @notice Deposit assets and receive shares
    /// @param assets Amount of asset tokens to deposit
    function deposit(uint256 assets) external;

    /// @notice Redeem shares for underlying assets
    /// @param sharesToRedeem Number of shares to burn
    function withdraw(uint256 sharesToRedeem) external;

    /// @notice Approve executor to pull tokens for a trade
    /// @param token  Token to approve
    /// @param amount Amount to approve
    function approveForTrade(address token, uint256 amount) external;

    /// @notice Sync totalAssets with actual token balance
    function reconcileAssets() external;

    /// @notice Return current total asset value (used by splitter for snapshot)
    /// @return Current totalAssets
    function snapshotValue() external view returns (uint256);

    /// @notice Splitter calls this to transfer fees/shares out of the vault
    /// @param to     Recipient address
    /// @param amount Amount to transfer
    function withdrawForSplitter(address to, uint256 amount) external;

    /// @notice Set the splitter address (one-time, called by splitter itself)
    /// @param _splitter The splitter contract address
    function setSplitter(address _splitter) external;

    /// @notice Pause deposits and trades
    function pauseVault() external;

    /// @notice Unpause the vault
    function unpauseVault() external;

    /// @notice Update the executor address
    /// @param newExecutor New executor contract address
    function updateExecutor(address newExecutor) external;

    /// @notice Update the deposit cap
    /// @param newCap New cap (0 = unlimited)
    function updateDepositCap(uint256 newCap) external;

    /// @notice Preview shares for a given deposit amount
    /// @param assets Amount to deposit
    /// @return shares_ Expected shares
    function previewDeposit(uint256 assets) external view returns (uint256 shares_);

    /// @notice Preview assets for a given share redemption
    /// @param shares_ Shares to redeem
    /// @return assets_ Expected assets
    function previewWithdraw(uint256 shares_) external view returns (uint256 assets_);

    /// @notice Get the asset value owned by a subscriber
    /// @param sub Subscriber address
    /// @return assets_ Current asset value of subscriber's shares
    function getSubscriberAssets(address sub) external view returns (uint256 assets_);

    /// @notice Total assets held in the vault
    function totalAssets() external view returns (uint256);

    /// @notice Total shares outstanding
    function totalShares() external view returns (uint256);

    /// @notice Shares owned by an address
    /// @param account The address to query
    function shares(address account) external view returns (uint256);

    /// @notice The immutable agent ID
    function agentId() external view returns (uint256);

    /// @notice The immutable creator address
    function creator() external view returns (address);
}

// lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol

// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

// lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)

// lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)

// lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}

// lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)

/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

// lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol

// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/utils/SafeERC20.sol)

/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        if (!_safeTransfer(token, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        if (!_safeTransferFrom(token, from, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _safeTransfer(token, to, value, false);
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _safeTransferFrom(token, from, to, value, false);
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        if (!_safeApprove(token, spender, value, false)) {
            if (!_safeApprove(token, spender, 0, true)) revert SafeERC20FailedOperation(address(token));
            if (!_safeApprove(token, spender, value, true)) revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Oppositely, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity `token.transfer(to, value)` call, relaxing the requirement on the return value: the
     * return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransfer(IERC20 token, address to, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.transfer.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(to, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }

    /**
     * @dev Imitates a Solidity `token.transferFrom(from, to, value)` call, relaxing the requirement on the return
     * value: the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param from The sender of the tokens
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value,
        bool bubble
    ) private returns (bool success) {
        bytes4 selector = IERC20.transferFrom.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(from, shr(96, not(0))))
            mstore(0x24, and(to, shr(96, not(0))))
            mstore(0x44, value)
            success := call(gas(), token, 0, 0x00, 0x64, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
            mstore(0x60, 0)
        }
    }

    /**
     * @dev Imitates a Solidity `token.approve(spender, value)` call, relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param spender The spender of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeApprove(IERC20 token, address spender, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.approve.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(spender, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }
}

// src/AgentVault.sol

/// @title AgentVault
/// @notice Holds subscriber funds and coordinates trading approvals
contract AgentVault is IAgentVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_TRADE_BPS   = 3_000;  // 30% hard cap per trade
    uint256 public constant MIN_INTERVAL    = 60;      // 1 minute minimum cooldown

    // ─── Immutables ───────────────────────────────────────────────────────
    IERC20          public immutable asset;
    uint256         public immutable agentId;
    address         public immutable creator;
    IAgentRegistry  public immutable registry;

    // ─── State ────────────────────────────────────────────────────────────
    address  public executor;
    address  public splitter;
    bool     public splitterSet;

    uint256  public totalShares;
    uint256  public totalAssets;
    mapping(address => uint256) public shares;

    uint256  public intervalSeconds;
    uint256  public maxTradeBps;
    uint256  public depositCap;
    uint256  public lastExecutionTs;

    mapping(address => bool) public allowedTokens;
    address[]                public allowedTokenList;

    bool public paused;

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyExecutor() {
        if (msg.sender != executor) revert AgentVault__NotExecutor(msg.sender);
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert AgentVault__NotCreator(msg.sender);
        _;
    }

    modifier onlySplitter() {
        if (msg.sender != splitter) revert AgentVault__NotSplitter(msg.sender);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert AgentVault__VaultPaused();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        address _asset,
        uint256 _agentId,
        address _creator,
        address _registry,
        address _executor,
        uint256 _intervalSeconds,
        uint256 _maxTradeBps,
        uint256 _depositCap,
        address[] memory _allowedTokens
    ) {
        if (_asset    == address(0)) revert AgentVault__InvalidParam("asset");
        if (_agentId  == 0)          revert AgentVault__InvalidParam("agentId");
        if (_creator  == address(0)) revert AgentVault__InvalidParam("creator");
        if (_registry == address(0)) revert AgentVault__InvalidParam("registry");
        if (_executor == address(0)) revert AgentVault__InvalidParam("executor");
        if (_maxTradeBps > MAX_TRADE_BPS)
            revert AgentVault__MaxTradePercentOutOfRange(_maxTradeBps);
        if (_intervalSeconds < MIN_INTERVAL)
            revert AgentVault__IntervalTooShort(_intervalSeconds, MIN_INTERVAL);
        if (_allowedTokens.length == 0)
            revert AgentVault__InvalidParam("allowedTokens");

        asset           = IERC20(_asset);
        agentId         = _agentId;
        creator         = _creator;
        registry        = IAgentRegistry(_registry);
        executor        = _executor;
        intervalSeconds = _intervalSeconds;
        maxTradeBps     = _maxTradeBps;
        depositCap      = _depositCap;

        for (uint256 i; i < _allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
            allowedTokenList.push(_allowedTokens[i]);
        }
    }

    // ─── Deposit ──────────────────────────────────────────────────────────

    /// @notice Deposit assets and receive proportional shares
    /// @param assets Amount of asset tokens to deposit
    function deposit(uint256 assets) external override nonReentrant whenNotPaused {
        if (assets == 0) revert AgentVault__ZeroAmount();
        if (depositCap > 0 && totalAssets + assets > depositCap)
            revert AgentVault__DepositCapExceeded(assets, depositCap);

        uint256 newShares;
        if (totalShares == 0) {
            newShares = assets; // 1:1 on first deposit
        } else {
            newShares = assets * totalShares / totalAssets;
            if (newShares == 0) revert AgentVault__ZeroShares();
        }

        bool isFirstDeposit = (shares[msg.sender] == 0);

        // Effects before interactions
        shares[msg.sender] += newShares;
        totalShares        += newShares;
        totalAssets        += assets;

        asset.safeTransferFrom(msg.sender, address(this), assets);

        if (isFirstDeposit) {
            registry.updateSubscriberCount(agentId, true);
        }

        emit Deposited(agentId, msg.sender, assets, newShares);
    }

    // ─── Withdraw ─────────────────────────────────────────────────────────

    /// @notice Redeem shares for underlying assets; allowed even when paused
    /// @param sharesToRedeem Number of shares to burn
    function withdraw(uint256 sharesToRedeem) external override nonReentrant {
        if (sharesToRedeem == 0) revert AgentVault__ZeroShares();
        if (shares[msg.sender] < sharesToRedeem)
            revert AgentVault__InsufficientShares(sharesToRedeem, shares[msg.sender]);

        uint256 assetsOut = sharesToRedeem * totalAssets / totalShares;
        bool wasLastShare = (shares[msg.sender] == sharesToRedeem);

        // Effects before interaction
        shares[msg.sender] -= sharesToRedeem;
        totalShares        -= sharesToRedeem;
        totalAssets        -= assetsOut;

        asset.safeTransfer(msg.sender, assetsOut);

        if (wasLastShare) {
            registry.updateSubscriberCount(agentId, false);
        }

        emit Withdrawn(agentId, msg.sender, assetsOut, sharesToRedeem);
    }

    // ─── Trade approval ───────────────────────────────────────────────────

    /// @notice Approve executor to pull tokens for a trade
    /// @param token  Token to approve
    /// @param amount Amount to approve
    function approveForTrade(address token, uint256 amount)
        external
        override
        onlyExecutor
        whenNotPaused
    {
        if (!allowedTokens[token]) revert AgentVault__TokenNotWhitelisted(token);

        uint256 maxAllowed = totalAssets * maxTradeBps / BPS_DENOMINATOR;
        if (amount > maxAllowed)
            revert AgentVault__ExceedsMaxTradePercent(amount, maxAllowed);

        if (block.timestamp < lastExecutionTs + intervalSeconds)
            revert AgentVault__CooldownNotElapsed(
                lastExecutionTs + intervalSeconds,
                block.timestamp
            );

        lastExecutionTs = block.timestamp;

        // forceApprove handles tokens that require resetting to 0 before re-approving
        IERC20(token).forceApprove(msg.sender, amount);

        emit TradeApproved(agentId, token, amount, block.timestamp);
    }

    // ─── Asset reconciliation ─────────────────────────────────────────────

    /// @notice Sync totalAssets with actual token balance
    function reconcileAssets() external override {
        if (msg.sender != executor && msg.sender != splitter)
            revert AgentVault__UnauthorizedReconciler(msg.sender);

        totalAssets = asset.balanceOf(address(this));
        emit TotalAssetsReconciled(agentId, totalAssets);
    }

    // ─── Splitter functions ───────────────────────────────────────────────

    /// @notice Return current vault value for snapshot; callable by splitter
    /// @return Current totalAssets
    function snapshotValue() external view override returns (uint256) {
        return totalAssets;
    }

    /// @notice Transfer assets to a recipient on behalf of the splitter
    /// @param to     Recipient (treasury or creator)
    /// @param amount Amount of asset to transfer
    function withdrawForSplitter(address to, uint256 amount)
        external
        override
        onlySplitter
    {
        if (to == address(0))    revert AgentVault__InvalidParam("to");
        if (amount == 0)         revert AgentVault__ZeroAmount();
        if (amount > totalAssets) revert AgentVault__InsufficientAssets(amount, totalAssets);

        // Effects before interaction
        totalAssets -= amount;

        asset.safeTransfer(to, amount);

        emit SplitterWithdrawal(agentId, to, amount);
    }

    /// @notice Set the splitter address (one-time, must be called by the splitter itself)
    /// @param _splitter The splitter contract address
    function setSplitter(address _splitter) external override {
        if (splitterSet)                    revert AgentVault__SplitterAlreadySet();
        if (_splitter == address(0))        revert AgentVault__InvalidParam("splitter");
        if (msg.sender != _splitter)        revert AgentVault__NotSplitter(msg.sender);

        splitter    = _splitter;
        splitterSet = true;

        emit SplitterSet(agentId, _splitter);
    }

    // ─── Creator admin ────────────────────────────────────────────────────

    /// @notice Pause deposits and trades
    function pauseVault() external override onlyCreator {
        paused = true;
        emit VaultPaused(agentId);
    }

    /// @notice Unpause the vault
    function unpauseVault() external override onlyCreator {
        paused = false;
        emit VaultUnpaused(agentId);
    }

    /// @notice Update the executor address
    /// @param newExecutor New executor contract address
    function updateExecutor(address newExecutor) external override onlyCreator {
        if (newExecutor == address(0)) revert AgentVault__InvalidParam("executor");
        executor = newExecutor;
        emit ExecutorUpdated(agentId, newExecutor);
    }

    /// @notice Update the deposit cap
    /// @param newCap New cap (0 = unlimited)
    function updateDepositCap(uint256 newCap) external override onlyCreator {
        depositCap = newCap;
        emit DepositCapUpdated(agentId, newCap);
    }

    // ─── View helpers ─────────────────────────────────────────────────────

    /// @notice Preview shares for a given deposit amount
    /// @param assets Amount to deposit
    /// @return shares_ Expected shares
    function previewDeposit(uint256 assets) external view override returns (uint256 shares_) {
        if (totalShares == 0) return assets;
        return assets * totalShares / totalAssets;
    }

    /// @notice Preview assets for a given share redemption
    /// @param shares_ Shares to redeem
    /// @return assets_ Expected assets
    function previewWithdraw(uint256 shares_) external view override returns (uint256 assets_) {
        if (totalShares == 0) return 0;
        return shares_ * totalAssets / totalShares;
    }

    /// @notice Get the asset value owned by a subscriber
    /// @param sub Subscriber address
    /// @return assets_ Current asset value
    function getSubscriberAssets(address sub) external view override returns (uint256 assets_) {
        if (totalShares == 0) return 0;
        return shares[sub] * totalAssets / totalShares;
    }
}
