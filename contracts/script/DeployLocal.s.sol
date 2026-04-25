// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {MockERC20}      from "../src/mocks/MockERC20.sol";
import {MockInitiaDEX}  from "../src/mocks/MockInitiaDEX.sol";
import {AgentRegistry}  from "../src/AgentRegistry.sol";
import {AgentVault}     from "../src/AgentVault.sol";
import {AgentExecutor}  from "../src/AgentExecutor.sol";
import {ProfitSplitter} from "../src/ProfitSplitter.sol";

/// @title DeployLocal
/// @notice Deploys the full InitiaAgent stack with mock tokens for local/testnet use.
///         Creates one test agent and registers its vault in the splitter.
contract DeployLocal is Script {

    uint256 constant PROTOCOL_FEE_BPS    = 200;    // 2%
    uint256 constant CREATOR_SHARE_BPS   = 2_000;  // 20%
    uint256 constant EPOCH_DURATION      = 7 days;
    uint256 constant INTERVAL            = 15 minutes;
    uint256 constant MAX_TRADE_BPS       = 1_000;  // 10%
    uint256 constant DEPOSIT_CAP         = 0;       // unlimited

    function run() external {
        uint256 privKey  = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privKey);

        vm.startBroadcast(privKey);

        // ── Tokens ──────────────────────────────────────────────────────────
        MockERC20 initToken = new MockERC20("INIT", "INIT");
        MockERC20 usdcToken = new MockERC20("USDC", "USDC");
        initToken.mint(deployer, 10_000_000e18);
        usdcToken.mint(deployer, 10_000_000e18);

        // ── DEX ─────────────────────────────────────────────────────────────
        MockInitiaDEX dex = new MockInitiaDEX();
        dex.setRate(address(initToken), address(usdcToken), 2e18);  // 1 INIT = 2 USDC
        dex.setRate(address(usdcToken), address(initToken), 0.5e18);
        initToken.mint(address(dex), 5_000_000e18);
        usdcToken.mint(address(dex), 5_000_000e18);

        // ── Core contracts ───────────────────────────────────────────────────
        AgentRegistry  registry = new AgentRegistry(deployer);
        AgentExecutor  executor = new AgentExecutor(address(registry), address(dex), deployer);
        ProfitSplitter splitter = new ProfitSplitter(
            address(registry),
            address(initToken),
            deployer,           // treasury = deployer for local
            PROTOCOL_FEE_BPS,
            CREATOR_SHARE_BPS,
            EPOCH_DURATION
        );

        // ── Agent vault ──────────────────────────────────────────────────────
        // Agent ID 1 is deterministic (first registration)
        address[] memory allowed = new address[](2);
        allowed[0] = address(initToken);
        allowed[1] = address(usdcToken);

        AgentVault vault = new AgentVault(
            address(initToken),
            1,              // pre-computed agentId
            deployer,       // creator
            address(registry),
            address(executor),
            INTERVAL,
            MAX_TRADE_BPS,
            DEPOSIT_CAP,
            allowed
        );

        uint256 agentId = registry.registerAgent("DCA Alpha", "DCA", address(vault));
        require(agentId == 1, "agentId mismatch");

        executor.authorizeRunner(agentId, deployer); // deployer acts as runner locally
        splitter.registerVault(agentId, address(vault));

        vm.stopBroadcast();

        // ── Log addresses ────────────────────────────────────────────────────
        console.log("=== InitiaAgent Local Deploy ===");
        console.log("INIT Token:   ", address(initToken));
        console.log("USDC Token:   ", address(usdcToken));
        console.log("DEX:          ", address(dex));
        console.log("Registry:     ", address(registry));
        console.log("Executor:     ", address(executor));
        console.log("Splitter:     ", address(splitter));
        console.log("Vault:        ", address(vault));
        console.log("AgentId:      ", agentId);
        console.log("Deployer:     ", deployer);

        // ── Write output JSON ────────────────────────────────────────────────
        string memory json = string(abi.encodePacked(
            '{"initToken":"', vm.toString(address(initToken)),
            '","usdcToken":"', vm.toString(address(usdcToken)),
            '","dex":"', vm.toString(address(dex)),
            '","registry":"', vm.toString(address(registry)),
            '","executor":"', vm.toString(address(executor)),
            '","splitter":"', vm.toString(address(splitter)),
            '","vault":"', vm.toString(address(vault)),
            '","agentId":"1"}'
        ));
        vm.writeFile("broadcast/local-addresses.json", json);
    }
}

/*
─────────────────────────────────────────────────────────────────────────────
POST-DEPLOY SMOKE TEST (minitiad CLI)

# 1. Approve and deposit 1 INIT
minitiad tx evm call $INIT_TOKEN_ADDRESS \
  --data "$(cast calldata 'approve(address,uint256)' $VAULT_ADDRESS 1000000000000000000)" \
  --from $DEPLOYER --gas auto --gas-adjustment 1.4

minitiad tx evm call $VAULT_ADDRESS \
  --data "$(cast calldata 'deposit(uint256)' 1000000000000000000)" \
  --from $DEPLOYER --gas auto --gas-adjustment 1.4

# 2. Withdraw 0.5 INIT (500000000000000000 wei = preview of half shares)
minitiad tx evm call $VAULT_ADDRESS \
  --data "$(cast calldata 'withdraw(uint256)' 500000000000000000)" \
  --from $DEPLOYER --gas auto --gas-adjustment 1.4
─────────────────────────────────────────────────────────────────────────────
*/
