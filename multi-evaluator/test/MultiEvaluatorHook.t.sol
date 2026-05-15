// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EvaluatorRegistry.sol";
import "../src/MultiEvaluatorHook.sol";
import "../src/VoteEscrow.sol";

contract MultiEvaluatorHookTest is Test {
    EvaluatorRegistry public registry;
    MultiEvaluatorHook public hook;
    VoteEscrow public voteEscrow;

    address deployer = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant STAKE = 10 ether; // 10 USDC native
    uint256 constant JOB_VALUE = 100 ether; // 100 USDC

    function setUp() public {
        // Predict the hook's CREATE address (registry deploys at current nonce, hook at nonce+1)
        address predictedHook = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        registry = new EvaluatorRegistry(predictedHook);
        hook = new MultiEvaluatorHook(address(registry));
        require(address(hook) == predictedHook, "Hook address mismatch");
        voteEscrow = new VoteEscrow();

        // Fund test accounts with native USDC
        vm.deal(alice, STAKE * 2);
        vm.deal(bob, STAKE * 2);
        vm.deal(carol, STAKE * 2);
        vm.deal(address(hook), JOB_VALUE); // pre-fund hook for fee distribution
    }

    function test_RegisterEvaluators() public {
        vm.prank(alice);
        registry.register{value: STAKE}();
        assertTrue(registry.isActive(alice));
        assertEq(registry.getStake(alice), STAKE);
    }

    function test_SelectJuryRequires3() public {
        // Only 2 evaluators - should revert
        vm.prank(alice);
        registry.register{value: STAKE}();
        vm.prank(bob);
        registry.register{value: STAKE}();

        vm.expectRevert("Need at least 3 active evaluators");
        registry.selectJury(12345);
    }

    function test_SelectJuryWith3() public {
        _registerAll();

        address[3] memory jury = registry.selectJury(42);
        // All 3 jury members must be distinct and active
        assertTrue(registry.isActive(jury[0]));
        assertTrue(registry.isActive(jury[1]));
        assertTrue(registry.isActive(jury[2]));
        assertTrue(jury[0] != jury[1] && jury[1] != jury[2] && jury[0] != jury[2]);
    }

    function test_JuryAssignment() public {
        _registerAll();

        uint256 jobId = 1;
        hook.onDeliverableSubmitted(jobId, JOB_VALUE);

        (address[3] memory members,,uint256 deadline, bool resolved,,) = hook.getJury(jobId);
        assertFalse(resolved);
        assertTrue(deadline > block.timestamp);
        assertTrue(members[0] != address(0));
    }

    function test_2of3ApproveResolves() public {
        _registerAll();

        uint256 jobId = 1;
        hook.onDeliverableSubmitted(jobId, JOB_VALUE);

        (address[3] memory members,,,,, ) = hook.getJury(jobId);

        // Two approvals should resolve immediately
        vm.prank(members[0]);
        hook.castVote(jobId, true);
        vm.prank(members[1]);
        hook.castVote(jobId, true);

        (,,, bool resolved,,) = hook.getJury(jobId);
        assertTrue(resolved);
    }

    function test_2of3RejectResolves() public {
        _registerAll();

        uint256 jobId = 1;
        hook.onDeliverableSubmitted(jobId, JOB_VALUE);

        (address[3] memory members,,,,,) = hook.getJury(jobId);

        vm.prank(members[0]);
        hook.castVote(jobId, false);
        vm.prank(members[1]);
        hook.castVote(jobId, false);

        (,,, bool resolved,,) = hook.getJury(jobId);
        assertTrue(resolved);
    }

    function test_ForceResolveAfterDeadline() public {
        _registerAll();

        uint256 jobId = 1;
        hook.onDeliverableSubmitted(jobId, JOB_VALUE);

        // Skip past vote window
        vm.warp(block.timestamp + 49 hours);

        hook.forceResolve(jobId);

        (,,, bool resolved,,) = hook.getJury(jobId);
        assertTrue(resolved);
    }

    function test_VoteEscrowLock() public {
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        voteEscrow.lock{value: 50 ether}(30 days);

        (uint256 amount, uint256 unlockAt,,) = voteEscrow.getLock(alice);
        assertEq(amount, 50 ether);
        assertTrue(unlockAt > block.timestamp);
    }

    function test_VoteEscrowUnlockAfterExpiry() public {
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        voteEscrow.lock{value: 50 ether}(7 days);

        vm.warp(block.timestamp + 8 days);

        uint256 before = alice.balance;
        vm.prank(alice);
        voteEscrow.unlock();

        assertEq(alice.balance, before + 50 ether);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _registerAll() internal {
        vm.prank(alice);
        registry.register{value: STAKE}();
        vm.prank(bob);
        registry.register{value: STAKE}();
        vm.prank(carol);
        registry.register{value: STAKE}();
    }
}
