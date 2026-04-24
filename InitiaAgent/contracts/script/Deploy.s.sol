// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {AgentRegistry}  from "../src/AgentRegistry.sol";
import {AgentExecutor}  from "../src/AgentExecutor.sol";
import {ProfitSplitter} from "../src/ProfitSplitter.sol";

/// @title Deploy
/// @notice Production deploy of AgentRegistry, AgentExecutor, ProfitSplitter.
///         AgentVault is deployed per-agent by creators (not in this script).
contract Deploy is Script {

    function run() external {
        uint256 privKey  = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privKey);

        address initToken        = vm.envAddress("INIT_TOKEN_ADDRESS");
        address dex              = vm.envAddress("DEX_ADDRESS");
        address treasury         = vm.envAddress("PROTOCOL_TREASURY");
        uint256 protocolFeeBps   = vm.envUint("PROTOCOL_FEE_BPS");
        uint256 creatorShareBps  = vm.envUint("CREATOR_SHARE_BPS");
        uint256 epochDuration    = vm.envUint("EPOCH_DURATION_SECONDS");

        vm.startBroadcast(privKey);

        AgentRegistry  registry = new AgentRegistry(deployer);
        AgentExecutor  executor = new AgentExecutor(address(registry), dex, deployer);
        ProfitSplitter splitter = new ProfitSplitter(
            address(registry),
            initToken,
            treasury,
            protocolFeeBps,
            creatorShareBps,
            epochDuration
        );

        vm.stopBroadcast();

        console.log("=== InitiaAgent Production Deploy ===");
        console.log("Registry:  ", address(registry));
        console.log("Executor:  ", address(executor));
        console.log("Splitter:  ", address(splitter));

        // ── Write deployed addresses ─────────────────────────────────────────
        string memory json = string(abi.encodePacked(
            '{"registry":"', vm.toString(address(registry)),
            '","executor":"', vm.toString(address(executor)),
            '","splitter":"', vm.toString(address(splitter)),
            '","deployer":"', vm.toString(deployer), '"}'
        ));

        vm.createDir(".initia", true);
        vm.writeJson(json, ".initia/deployed.json");
        console.log("Addresses written to .initia/deployed.json");
    }
}
