// SPDX-License-Identifier: MIT
pragma solidity >=0.4.16 >=0.6.2 ^0.8.20 ^0.8.24;

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

// src/interfaces/IAgentExecutor.sol

/// @title IAgentExecutor
/// @notice Interface for the AgentExecutor contract
interface IAgentExecutor {
    /// @notice Authorize a runner address to execute swaps for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address to authorize
    function authorizeRunner(uint256 agentId, address runner) external;

    /// @notice Revoke a runner's authorization for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address to revoke
    function revokeRunner(uint256 agentId, address runner) external;

    /// @notice Execute a swap on behalf of an agent
    /// @param agentId      The agent ID
    /// @param tokenIn      Input token address
    /// @param tokenOut     Output token address
    /// @param amountIn     Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable output (slippage guard)
    /// @param deadline     Unix timestamp after which the tx reverts
    /// @return amountOut   Actual amount of tokenOut received
    function executeSwap(
        uint256 agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /// @notice Update the DEX contract address
    /// @param newDex New DEX address
    function updateDEX(address newDex) external;

    /// @notice Check if a runner is authorized for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    /// @return True if authorized
    function isRunnerAuthorized(uint256 agentId, address runner) external view returns (bool);
}

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

// src/interfaces/IInitiaDEX.sol

/// @title IInitiaDEX
/// @notice Minimal interface for the Initia DEX used by AgentExecutor
interface IInitiaDEX {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMinimum; // slippage guard
        address recipient;        // always the vault
        uint256 deadline;         // unix timestamp
    }

    /// @notice Execute a token swap
    /// @param params Swap parameters
    /// @return amountOut Amount of tokenOut received
    function swap(SwapParams calldata params) external returns (uint256 amountOut);

    /// @notice Get the expected output amount for a swap
    /// @param tokenIn  Input token address
    /// @param tokenOut Output token address
    /// @param amountIn Amount of tokenIn
    /// @return amountOut Expected amount of tokenOut
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}

// lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)

// lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)

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

// src/AgentExecutor.sol

/// @title AgentExecutor
/// @notice Gatekeeper for agent trade commands; dispatches swaps to the DEX
contract AgentExecutor is IAgentExecutor, Ownable2Step {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────
    IAgentRegistry public immutable registry;
    IInitiaDEX     public dex;

    /// @notice agentId → runner address → authorized
    mapping(uint256 => mapping(address => bool)) private _runners;

    /// @notice agentId → vault address (cached for gas)
    mapping(uint256 => address) public agentVault;

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address _registry, address _dex, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert AgentExecutor__InvalidRegistry(_registry);
        if (_dex      == address(0)) revert AgentExecutor__InvalidDEX(_dex);

        registry = IAgentRegistry(_registry);
        dex      = IInitiaDEX(_dex);
    }

    // ─── Runner management ────────────────────────────────────────────────

    /// @notice Authorize a runner to execute swaps for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    function authorizeRunner(uint256 agentId, address runner) external override {
        _requireCreator(agentId, msg.sender);
        if (_runners[agentId][runner]) revert AgentExecutor__RunnerAlreadyAuthorized(runner, agentId);

        _runners[agentId][runner] = true;

        // Cache vault address on first authorization
        if (agentVault[agentId] == address(0)) {
            agentVault[agentId] = registry.getAgent(agentId).vaultAddress;
        }

        emit RunnerAuthorized(agentId, runner);
    }

    /// @notice Revoke a runner's authorization for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    function revokeRunner(uint256 agentId, address runner) external override {
        _requireCreator(agentId, msg.sender);
        if (!_runners[agentId][runner]) revert AgentExecutor__RunnerNotAuthorized(runner, agentId);

        _runners[agentId][runner] = false;

        emit RunnerRevoked(agentId, runner);
    }

    // ─── Swap execution ───────────────────────────────────────────────────

    /// @notice Execute a swap on behalf of a registered agent
    /// @param agentId      The agent ID
    /// @param tokenIn      Input token address
    /// @param tokenOut     Output token address
    /// @param amountIn     Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable output
    /// @param deadline     Unix timestamp deadline
    /// @return amountOut   Actual tokenOut received
    function executeSwap(
        uint256 agentId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external override returns (uint256 amountOut) {
        // ── Checks ──────────────────────────────────────────────────────
        if (!_runners[agentId][msg.sender])
            revert AgentExecutor__NotAuthorizedRunner(msg.sender, agentId);
        if (!registry.isActive(agentId))
            revert AgentExecutor__AgentNotActive(agentId);
        if (block.timestamp > deadline)
            revert AgentExecutor__DeadlineExpired(deadline, block.timestamp);
        if (tokenIn == tokenOut)
            revert AgentExecutor__SameToken(tokenIn);
        if (minAmountOut == 0)
            revert AgentExecutor__ZeroMinOutput();

        // ── Load vault (cache if missing) ────────────────────────────────
        address vault = agentVault[agentId];
        if (vault == address(0)) {
            vault = registry.getAgent(agentId).vaultAddress;
            agentVault[agentId] = vault;
        }

        // ── Interactions ─────────────────────────────────────────────────
        // 1. Vault approves executor to pull tokenIn
        IAgentVault(vault).approveForTrade(tokenIn, amountIn);

        // 2. Pull tokenIn from vault to executor
        IERC20(tokenIn).safeTransferFrom(vault, address(this), amountIn);

        // 3. Approve DEX to spend tokenIn
        IERC20(tokenIn).forceApprove(address(dex), amountIn);

        // 4. Execute swap; output goes directly to vault
        IInitiaDEX.SwapParams memory params = IInitiaDEX.SwapParams({
            tokenIn:          tokenIn,
            tokenOut:         tokenOut,
            amountIn:         amountIn,
            amountOutMinimum: minAmountOut,
            recipient:        vault,
            deadline:         deadline
        });

        try dex.swap(params) returns (uint256 out) {
            amountOut = out;
        } catch {
            revert AgentExecutor__SwapFailed();
        }

        if (amountOut < minAmountOut)
            revert AgentExecutor__SlippageExceeded(amountOut, minAmountOut);

        // 5. Sync vault accounting
        IAgentVault(vault).reconcileAssets();

        // 6. Update volume tracking (non-critical; ignore revert)
        try registry.updateVolumeTraded(agentId, uint128(amountOut)) {} catch {}

        emit SwapExecuted(agentId, msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    // ─── Owner admin ─────────────────────────────────────────────────────

    /// @notice Update the DEX contract address
    /// @param newDex New DEX address
    function updateDEX(address newDex) external override onlyOwner {
        if (newDex == address(0)) revert AgentExecutor__InvalidDEX(newDex);
        emit DEXUpdated(address(dex), newDex);
        dex = IInitiaDEX(newDex);
    }

    // ─── View ─────────────────────────────────────────────────────────────

    /// @notice Check if a runner is authorized for an agent
    /// @param agentId The agent ID
    /// @param runner  The runner address
    /// @return True if authorized
    function isRunnerAuthorized(uint256 agentId, address runner)
        external
        view
        override
        returns (bool)
    {
        return _runners[agentId][runner];
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    /// @dev Revert if caller is not the agent creator
    function _requireCreator(uint256 agentId, address caller) internal view {
        IAgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (caller != info.creator) revert AgentExecutor__NotCreator(caller, agentId);
    }
}
