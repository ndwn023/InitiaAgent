// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IProfitSplitter} from "./interfaces/IProfitSplitter.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IAgentVault} from "./interfaces/IAgentVault.sol";
import {
    ProfitSplitter__EpochNotElapsed,
    ProfitSplitter__NoProfit,
    ProfitSplitter__VaultNotRegistered,
    ProfitSplitter__InvalidProtocolFeeBps,
    ProfitSplitter__InvalidCreatorShareBps,
    ProfitSplitter__ZeroRegistry,
    ProfitSplitter__ZeroAsset,
    ProfitSplitter__ZeroTreasury,
    ProfitSplitter__InvalidEpochDuration,
    ProfitSplitter__AlreadyRegistered,
    ProfitSplitter__Unauthorized
} from "./errors/Errors.sol";
import {
    ProfitDistributed,
    SnapshotTaken,
    VaultRegisteredInSplitter,
    ProtocolFeeUpdated,
    CreatorShareUpdated,
    TreasuryUpdated
} from "./events/Events.sol";

/// @title ProfitSplitter
/// @notice Distributes vault profits to protocol, creator, and subscribers each epoch
contract ProfitSplitter is IProfitSplitter, Ownable2Step {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────
    uint256 public constant BPS_DENOMINATOR       = 10_000;
    uint256 public constant MAX_PROTOCOL_FEE_BPS  = 1_000;  // 10% hard cap
    uint256 public constant MAX_CREATOR_SHARE_BPS = 5_000;  // 50% hard cap

    // ─── Immutables ───────────────────────────────────────────────────────
    IAgentRegistry public immutable registry;
    IERC20         public immutable asset;

    // ─── State ────────────────────────────────────────────────────────────
    address  public protocolTreasury;
    uint256  public protocolFeeBps;
    uint256  public creatorShareBps;
    uint256  public epochDuration;

    mapping(uint256 => address) public agentVault;
    mapping(uint256 => uint256) public lastSnapshot;
    mapping(uint256 => uint256) public lastEpochTs;

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        address _registry,
        address _asset,
        address _treasury,
        uint256 _protocolFeeBps,
        uint256 _creatorShareBps,
        uint256 _epochDuration
    ) Ownable(msg.sender) {
        if (_registry == address(0)) revert ProfitSplitter__ZeroRegistry();
        if (_asset    == address(0)) revert ProfitSplitter__ZeroAsset();
        if (_treasury == address(0)) revert ProfitSplitter__ZeroTreasury();
        if (_protocolFeeBps > MAX_PROTOCOL_FEE_BPS)
            revert ProfitSplitter__InvalidProtocolFeeBps(_protocolFeeBps, MAX_PROTOCOL_FEE_BPS);
        if (_creatorShareBps > MAX_CREATOR_SHARE_BPS)
            revert ProfitSplitter__InvalidCreatorShareBps(_creatorShareBps, MAX_CREATOR_SHARE_BPS);

        registry         = IAgentRegistry(_registry);
        asset            = IERC20(_asset);
        protocolTreasury = _treasury;
        protocolFeeBps   = _protocolFeeBps;
        creatorShareBps  = _creatorShareBps;
        epochDuration    = _epochDuration;
    }

    // ─── Vault registration ───────────────────────────────────────────────

    /// @notice Register a vault for epoch profit distribution
    /// @param agentId The agent ID
    /// @param vault   The vault address
    function registerVault(uint256 agentId, address vault) external override {
        if (agentVault[agentId] != address(0))
            revert ProfitSplitter__AlreadyRegistered(agentId);

        IAgentRegistry.AgentInfo memory info = registry.getAgent(agentId);
        if (vault != info.vaultAddress)
            revert ProfitSplitter__VaultNotRegistered(vault);

        agentVault[agentId] = vault;

        uint256 currentValue = IAgentVault(vault).snapshotValue();
        lastSnapshot[agentId] = currentValue;
        lastEpochTs[agentId]  = block.timestamp;

        // Lock the splitter address in the vault
        IAgentVault(vault).setSplitter(address(this));

        emit VaultRegisteredInSplitter(agentId, vault);
        emit SnapshotTaken(agentId, currentValue, block.timestamp);
    }

    // ─── Profit distribution ──────────────────────────────────────────────

    /// @notice Distribute profits for an agent after an epoch elapses
    /// @param agentId         The agent ID
    /// @return protocolFee    Amount sent to treasury
    /// @return creatorShare   Amount sent to creator
    /// @return subscriberShare Profit left in vault for subscribers
    function distributeProfit(uint256 agentId)
        external
        override
        returns (
            uint256 protocolFee,
            uint256 creatorShare,
            uint256 subscriberShare
        )
    {
        address vault = agentVault[agentId];
        if (vault == address(0)) revert ProfitSplitter__VaultNotRegistered(vault);
        if (block.timestamp < lastEpochTs[agentId] + epochDuration)
            revert ProfitSplitter__EpochNotElapsed(
                lastEpochTs[agentId] + epochDuration,
                block.timestamp
            );

        uint256 currentValue = IAgentVault(vault).snapshotValue();
        if (currentValue <= lastSnapshot[agentId]) revert ProfitSplitter__NoProfit();

        uint256 grossProfit = currentValue - lastSnapshot[agentId];

        // Multiply before divide to avoid rounding to zero
        protocolFee    = grossProfit * protocolFeeBps / BPS_DENOMINATOR;
        uint256 net    = grossProfit - protocolFee;
        creatorShare   = net * creatorShareBps / BPS_DENOMINATOR;
        subscriberShare = net - creatorShare;

        // Pay protocol fee via vault's controlled withdrawal function
        if (protocolFee > 0) {
            IAgentVault(vault).withdrawForSplitter(protocolTreasury, protocolFee);
        }

        // Pay creator via vault's controlled withdrawal function
        address creator_ = registry.getAgent(agentId).creator;
        if (creatorShare > 0) {
            IAgentVault(vault).withdrawForSplitter(creator_, creatorShare);
        }

        // Sync vault accounting after payouts
        IAgentVault(vault).reconcileAssets();

        // Update snapshot to post-payout vault value
        lastSnapshot[agentId] = currentValue - protocolFee - creatorShare;
        lastEpochTs[agentId]  = block.timestamp;

        emit ProfitDistributed(
            agentId,
            grossProfit,
            protocolFee,
            creatorShare,
            subscriberShare,
            block.timestamp
        );
        emit SnapshotTaken(agentId, lastSnapshot[agentId], block.timestamp);
    }

    // ─── View ─────────────────────────────────────────────────────────────

    /// @notice Check if profit distribution is available
    /// @param agentId           The agent ID
    /// @return ok               True if epoch has elapsed
    /// @return secondsRemaining Seconds until next distribution
    function canDistribute(uint256 agentId)
        external
        view
        override
        returns (bool ok, uint256 secondsRemaining)
    {
        uint256 nextEpoch = lastEpochTs[agentId] + epochDuration;
        ok = block.timestamp >= nextEpoch;
        secondsRemaining = ok ? 0 : nextEpoch - block.timestamp;
    }

    // ─── Owner setters ────────────────────────────────────────────────────

    /// @notice Update the protocol fee
    /// @param newBps New fee in basis points (max 1000)
    function setProtocolFee(uint256 newBps) external override onlyOwner {
        if (newBps > MAX_PROTOCOL_FEE_BPS)
            revert ProfitSplitter__InvalidProtocolFeeBps(newBps, MAX_PROTOCOL_FEE_BPS);
        emit ProtocolFeeUpdated(protocolFeeBps, newBps);
        protocolFeeBps = newBps;
    }

    /// @notice Update the creator share
    /// @param newBps New share in basis points (max 5000)
    function setCreatorShare(uint256 newBps) external override onlyOwner {
        if (newBps > MAX_CREATOR_SHARE_BPS)
            revert ProfitSplitter__InvalidCreatorShareBps(newBps, MAX_CREATOR_SHARE_BPS);
        emit CreatorShareUpdated(creatorShareBps, newBps);
        creatorShareBps = newBps;
    }

    /// @notice Update the protocol treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external override onlyOwner {
        if (newTreasury == address(0)) revert ProfitSplitter__ZeroTreasury();
        emit TreasuryUpdated(protocolTreasury, newTreasury);
        protocolTreasury = newTreasury;
    }

    /// @notice Update the epoch duration
    /// @param secs New duration in seconds (min 3600)
    function setEpochDuration(uint256 secs) external override onlyOwner {
        if (secs < 3600) revert ProfitSplitter__InvalidEpochDuration(secs, 3600);
        epochDuration = secs;
    }
}
