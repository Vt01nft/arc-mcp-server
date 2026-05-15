// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EvaluatorRegistry.sol";
import "../src/MultiEvaluatorHook.sol";
import "../src/VoteEscrow.sol";

/// @notice Deploys EvaluatorRegistry → MultiEvaluatorHook → VoteEscrow
///         to Arc Testnet (chain ID 5042002).
///
/// The circular constructor dependency (registry needs hook address, hook needs
/// registry address) is resolved by predicting the hook's CREATE address from
/// the deployer nonce, so registry can be deployed first with the correct value.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint64 nonce = vm.getNonce(deployer);
        // Tx order under startBroadcast: registry at nonce, hook at nonce+1, escrow at nonce+2.
        address predictedHook = vm.computeCreateAddress(deployer, nonce + 1);

        vm.startBroadcast(deployerKey);

        EvaluatorRegistry registry = new EvaluatorRegistry(predictedHook);
        MultiEvaluatorHook hook = new MultiEvaluatorHook(address(registry));
        VoteEscrow voteEscrow = new VoteEscrow();

        vm.stopBroadcast();

        require(address(hook) == predictedHook, "Hook address mismatch");

        console.log("=== Arc Multi-Evaluator Deployment ===");
        console.log("EvaluatorRegistry:", address(registry));
        console.log("MultiEvaluatorHook:", address(hook));
        console.log("VoteEscrow:", address(voteEscrow));
        console.log("Deployer:", deployer);
    }
}
