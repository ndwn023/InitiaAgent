// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAgentVault} from "./interfaces/IAgentVault.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {
    AgentVault__ZeroAmount,
    AgentVault__ZeroShares,
    AgentVault__InsufficientShares,
    AgentVault__InsufficientAssets,
    AgentVault__DepositCapExceeded,
    AgentVault__TokenNotWhitelisted,
    AgentVault__ExceedsMaxTradePercent,
    AgentVault__CooldownNotElapsed,
    AgentVault__NotExecutor,
    AgentVault__NotCreator,
    AgentVault__NotSplitter,
    AgentVault__VaultPaused,
    AgentVault__SplitterAlreadySet,
    AgentVault__InvalidParam,
    AgentVault__MaxTradePercentOutOfRange,
    AgentVault__IntervalTooShort,
    AgentVault__UnauthorizedReconciler
} from "./errors/Errors.sol";
import {
    Deposited,
    Withdrawn,
    TradeApproved,
    TotalAssetsReconciled,
    VaultPaused,
    VaultUnpaused,
    DepositCapUpdated,
    ExecutorUpdated,
    SplitterSet,
    SplitterWithdrawal
} from "./events/Events.sol";

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
