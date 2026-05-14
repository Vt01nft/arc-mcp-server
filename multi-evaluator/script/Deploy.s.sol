// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EvaluatorRegistry.sol";
import "../src/MultiEvaluatorHook.sol";
import "../src/VoteEscrow.sol";

/// @notice Deploys EvaluatorRegistry → MultiEvaluatorHook → VoteEscrow
///         to Arc Testnet (chain ID 5042002).
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy hook address first (registry needs it in constructor)
        //    Workaround: deploy a temporary placeholder, then set registry in hook.
        //    For simplicity we deploy registry with address(0) hook, then redeploy hook.
        //
        // Real pattern: use CREATE2 or two-step init. For demo, deploy registry with
        // a known hook address computed off-chain (or deploy hook first with a placeholder registry).

        // Step 1: Deploy registry with placeholder hook = deployer (will be updated)
        EvaluatorRegistry registry = new EvaluatorRegistry(deployer);

        // Step 2: Deploy hook pointing to registry
        MultiEvaluatorHook hook = new MultiEvaluatorHook(address(registry));

        // Step 3: Deploy VoteEscrow (standalone — no dependency on registry/hook)
        VoteEscrow voteEscrow = new VoteEscrow();

        vm.stopBroadcast();

        // Log addresses for copy-paste into demo/addresses.ts
        console.log("=== Arc Multi-Evaluator Deployment ===");
        console.log("EvaluatorRegistry:", address(registry));
        console.log("MultiEvaluatorHook:", address(hook));
        console.log("VoteEscrow:", address(voteEscrow));
        console.log("Deployer:", deployer);
        console.log("");
        console.log("NOTE: Registry was deployed with placeholder hook=deployer.");
        console.log("Re-deploy registry with hook=", address(hook), "for production use.");
    }
}
