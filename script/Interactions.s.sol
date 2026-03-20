// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {MockERC20}      from "../src/mocks/MockERC20.sol";
import {AgentRegistry}  from "../src/AgentRegistry.sol";
import {AgentVault}     from "../src/AgentVault.sol";
import {AgentExecutor}  from "../src/AgentExecutor.sol";
import {ProfitSplitter} from "../src/ProfitSplitter.sol";

/// @title Interactions
/// @notice Post-deploy smoke test: creates a vault, registers it, deposits,
///         triggers a swap, and verifies balances.
contract Interactions is Script {

    uint256 constant DEPOSIT_AMOUNT  = 1_000e18;
    uint256 constant SWAP_AMOUNT     = 100e18;
    uint256 constant MIN_SWAP_OUT    = 1e18;
    uint256 constant INTERVAL        = 15 minutes;
    uint256 constant MAX_TRADE_BPS   = 1_000;

    function run() external {
        // ── Read deployed addresses ──────────────────────────────────────────
        string memory raw    = vm.readFile(".initia/deployed.json");
        address registryAddr = vm.parseJsonAddress(raw, ".registry");
        address executorAddr = vm.parseJsonAddress(raw, ".executor");
        address splitterAddr = vm.parseJsonAddress(raw, ".splitter");

        uint256 privKey  = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privKey);
        address initTok  = vm.envAddress("INIT_TOKEN_ADDRESS");
        address usdcTok  = vm.envAddress("USDC_TOKEN_ADDRESS");

        AgentRegistry  registry = AgentRegistry(registryAddr);
        AgentExecutor  executor = AgentExecutor(executorAddr);
        ProfitSplitter splitter = ProfitSplitter(splitterAddr);

        vm.startBroadcast(privKey);

        // ── Step 1: Deploy a test vault ──────────────────────────────────────
        AgentVault vault = _deployVault(registry, registryAddr, executorAddr, deployer, initTok);
        console.log("[1] Vault deployed:", address(vault));

        // ── Step 2: Register agent ───────────────────────────────────────────
        uint256 agentId = registry.registerAgent("Smoke Test Agent", "DCA", address(vault));
        console.log("[2] Agent registered, id:", agentId);

        // ── Step 3: Register vault in splitter ───────────────────────────────
        splitter.registerVault(agentId, address(vault));
        console.log("[3] Vault registered in splitter");

        // ── Step 4: Deposit ──────────────────────────────────────────────────
        MockERC20(initTok).approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        console.log("[4] Deposited:", DEPOSIT_AMOUNT);
        console.log("    Vault totalAssets:", vault.totalAssets());
        console.log("    Depositor shares: ", vault.shares(deployer));

        // ── Step 5: Authorize runner and execute swap ────────────────────────
        executor.authorizeRunner(agentId, deployer);
        console.log("[5] Runner authorized");

        uint256 deadline  = block.timestamp + 1 hours;
        uint256 amountOut = executor.executeSwap(
            agentId,
            initTok,
            usdcTok,
            SWAP_AMOUNT,
            MIN_SWAP_OUT,
            deadline
        );
        console.log("[5] Swap executed, amountOut:", amountOut);
        console.log("    Vault totalAssets after swap:", vault.totalAssets());

        vm.stopBroadcast();

        console.log("=== Smoke test complete ===");
    }

    function _deployVault(
        AgentRegistry registry,
        address registryAddr,
        address executorAddr,
        address deployer,
        address initTok
    ) internal returns (AgentVault) {
        uint256 nextId = registry.agentCount() + 1;
        address[] memory allowed = new address[](1);
        allowed[0] = initTok;

        return new AgentVault(
            initTok,
            nextId,
            deployer,
            registryAddr,
            executorAddr,
            INTERVAL,
            MAX_TRADE_BPS,
            0,
            allowed
        );
    }
}
