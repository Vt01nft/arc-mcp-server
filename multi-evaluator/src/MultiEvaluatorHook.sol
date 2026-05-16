// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EvaluatorRegistry.sol";

/// @title MultiEvaluatorHook
/// @notice ERC-8183 hook that replaces single-evaluator judgement with a 3-agent jury.
///         2-of-3 votes decide the outcome. 5% of job value is split among correct jurors.
///         Minority voters lose 10% of their stake to the majority as a penalty.
///
/// Integration:
///   - Deploy this contract and EvaluatorRegistry (pointing to each other)
///   - When creating an ERC-8183 job, pass this contract as the `hook` address
///   - The job client/provider interacts with the ERC-8183 contract as normal;
///     this hook intercepts evaluation calls and routes them through the jury
contract MultiEvaluatorHook {
    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant FEE_PERCENT = 5;     // 5% fee taken from job for jury
    uint256 public constant VOTE_WINDOW = 48 hours; // jury must vote within 48h

    // ── References / access control ───────────────────────────────────────────
    EvaluatorRegistry public immutable registry;
    address public immutable owner;     // can set the authorized job contract
    address public authorizedCaller;    // only this address may assign juries

    // ── Jury state ────────────────────────────────────────────────────────────
    enum Vote { Pending, Approve, Reject }

    struct Jury {
        address[3] members;      // selected evaluators
        Vote[3] votes;           // per-member vote
        uint256 deadline;        // block timestamp after which jury can be skipped
        uint256 jobAmount;       // escrowed USDC for fee calculation
        bool resolved;           // prevents double-resolution
        uint8 approves;          // running tally
        uint8 rejects;           // running tally
    }

    // jobId → jury
    mapping(uint256 => Jury) public juries;

    // ── Events ────────────────────────────────────────────────────────────────
    event JuryAssigned(uint256 indexed jobId, address[3] jurors, uint256 deadline);
    event VoteCast(uint256 indexed jobId, address indexed juror, Vote vote, uint8 approves, uint8 rejects);
    event JuryResolved(uint256 indexed jobId, bool approved, uint8 approves, uint8 rejects);
    event JuryExpired(uint256 indexed jobId);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _registry) {
        registry = EvaluatorRegistry(_registry);
        owner = msg.sender;
        authorizedCaller = msg.sender; // owner until reassigned to the job contract
    }

    /// @notice Set the only address allowed to assign juries (the ERC-8183
    ///         job contract in production). Owner-only.
    function setAuthorizedCaller(address caller) external {
        require(msg.sender == owner, "Only owner");
        authorizedCaller = caller;
    }

    // ── ERC-8183 Hook interface ───────────────────────────────────────────────

    /// @notice Called by ERC-8183 when a deliverable is submitted.
    ///         Assigns a 3-member jury to evaluate the job.
    /// @param jobId  ERC-8183 job ID
    /// @param amount Job value in native USDC (18 decimals)
    function onDeliverableSubmitted(uint256 jobId, uint256 amount) external {
        require(msg.sender == authorizedCaller, "Unauthorized");
        require(juries[jobId].deadline == 0, "Jury already assigned");

        address[3] memory jurors = registry.selectJury(
            uint256(keccak256(abi.encode(jobId, block.timestamp, block.prevrandao)))
        );

        Jury storage jury = juries[jobId];
        jury.members = jurors;
        jury.deadline = block.timestamp + VOTE_WINDOW;
        jury.jobAmount = amount;

        // Lock each juror's stake until the deadline so they cannot
        // deregister mid-vote to escape a potential slash.
        registry.lockEvaluator(jurors[0], jury.deadline);
        registry.lockEvaluator(jurors[1], jury.deadline);
        registry.lockEvaluator(jurors[2], jury.deadline);

        emit JuryAssigned(jobId, jurors, jury.deadline);
    }

    /// @notice Called by a jury member to cast their vote.
    /// @param jobId   ERC-8183 job ID
    /// @param approve true = approve & release USDC, false = reject & refund
    function castVote(uint256 jobId, bool approve) external {
        Jury storage jury = juries[jobId];
        require(jury.deadline > 0, "No jury for this job");
        require(!jury.resolved, "Already resolved");
        require(block.timestamp <= jury.deadline, "Voting window closed");

        uint8 memberIdx = _getMemberIndex(jury, msg.sender);
        require(jury.votes[memberIdx] == Vote.Pending, "Already voted");

        jury.votes[memberIdx] = approve ? Vote.Approve : Vote.Reject;
        if (approve) jury.approves++; else jury.rejects++;

        emit VoteCast(jobId, msg.sender, jury.votes[memberIdx], jury.approves, jury.rejects);

        // Resolve immediately if 2-of-3 reached
        if (jury.approves >= 2 || jury.rejects >= 2) {
            _resolve(jobId, jury);
        }
    }

    /// @notice Anyone can call this after the voting window to force resolution
    ///         with whatever votes were cast. If no quorum, defaults to reject.
    function forceResolve(uint256 jobId) external {
        Jury storage jury = juries[jobId];
        require(!jury.resolved, "Already resolved");
        require(block.timestamp > jury.deadline, "Window not closed");

        if (jury.approves == 0 && jury.rejects == 0) {
            jury.resolved = true;
            emit JuryExpired(jobId);
            return;
        }
        _resolve(jobId, jury);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _resolve(uint256 jobId, Jury storage jury) internal {
        jury.resolved = true;
        bool approved = jury.approves > jury.rejects;

        // Distribute fee and slash losers
        uint256 fee = (jury.jobAmount * FEE_PERCENT) / 100;
        uint256 perWinner = fee / (approved ? jury.approves : jury.rejects);
        uint256 slashAmount = (fee * EvaluatorRegistry(registry).SLASH_PERCENT()) / 100;

        for (uint8 i = 0; i < 3; i++) {
            if (jury.votes[i] == Vote.Pending) continue; // didn't vote - no reward or slash

            bool votedCorrectly = approved
                ? jury.votes[i] == Vote.Approve
                : jury.votes[i] == Vote.Reject;

            registry.recordVote(jury.members[i], votedCorrectly);

            if (votedCorrectly) {
                registry.reward{value: perWinner}(jury.members[i]);
            } else {
                registry.slash(jury.members[i], slashAmount);
            }
        }

        emit JuryResolved(jobId, approved, jury.approves, jury.rejects);
    }

    function _getMemberIndex(Jury storage jury, address member) internal view returns (uint8) {
        for (uint8 i = 0; i < 3; i++) {
            if (jury.members[i] == member) return i;
        }
        revert("Not a jury member");
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getJury(uint256 jobId) external view returns (
        address[3] memory members,
        Vote[3] memory votes,
        uint256 deadline,
        bool resolved,
        uint8 approves,
        uint8 rejects
    ) {
        Jury storage j = juries[jobId];
        return (j.members, j.votes, j.deadline, j.resolved, j.approves, j.rejects);
    }

    function getVoteStatus(uint256 jobId) external view returns (
        uint8 approves,
        uint8 rejects,
        uint8 pending,
        bool canResolve
    ) {
        Jury storage j = juries[jobId];
        for (uint8 i = 0; i < 3; i++) {
            if (j.votes[i] == Vote.Approve) approves++;
            else if (j.votes[i] == Vote.Reject) rejects++;
            else pending++;
        }
        canResolve = !j.resolved && (approves >= 2 || rejects >= 2 || block.timestamp > j.deadline);
    }

    // Accept ETH (native USDC on Arc) for fee distribution
    receive() external payable {}
}
