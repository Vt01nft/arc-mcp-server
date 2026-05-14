// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EvaluatorRegistry
/// @notice Tracks registered jury evaluators and their stake on Arc Testnet.
///         Evaluators must stake USDC (native, 18-decimal) to participate.
///         Stake is slashed for minority votes, rewarded for majority votes.
contract EvaluatorRegistry {
    // ── Constants ────────────────────────────────────────────────────────────
    uint256 public constant MIN_STAKE = 10 ether; // 10 USDC (18-decimal native)
    uint256 public constant SLASH_PERCENT = 10;   // 10% slashed for minority vote
    uint256 public constant REWARD_PERCENT = 5;   // 5% of job fee split among jury

    // ── State ─────────────────────────────────────────────────────────────────
    address public immutable hook; // only the MultiEvaluatorHook can slash/reward

    struct Evaluator {
        uint256 stake;       // native USDC staked (18 decimals)
        uint256 totalVotes;  // lifetime votes cast
        uint256 correctVotes;// votes that matched the jury majority
        bool active;         // can be assigned to juries
    }

    mapping(address => Evaluator) public evaluators;
    address[] public evaluatorList;

    // ── Events ────────────────────────────────────────────────────────────────
    event Registered(address indexed evaluator, uint256 stake);
    event Slashed(address indexed evaluator, uint256 amount);
    event Rewarded(address indexed evaluator, uint256 amount);
    event Deregistered(address indexed evaluator, uint256 stakeReturned);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _hook) {
        hook = _hook;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyHook() {
        require(msg.sender == hook, "Only hook");
        _;
    }

    // ── Registration ──────────────────────────────────────────────────────────
    /// @notice Register as an evaluator by staking at least MIN_STAKE USDC.
    function register() external payable {
        require(msg.value >= MIN_STAKE, "Stake below minimum");
        require(!evaluators[msg.sender].active, "Already registered");

        evaluators[msg.sender] = Evaluator({
            stake: msg.value,
            totalVotes: 0,
            correctVotes: 0,
            active: true
        });
        evaluatorList.push(msg.sender);

        emit Registered(msg.sender, msg.value);
    }

    /// @notice Deregister and withdraw stake. Cannot exit while assigned to an active jury.
    function deregister() external {
        Evaluator storage ev = evaluators[msg.sender];
        require(ev.active, "Not registered");
        ev.active = false;

        uint256 stakeOut = ev.stake;
        ev.stake = 0;
        payable(msg.sender).transfer(stakeOut);

        emit Deregistered(msg.sender, stakeOut);
    }

    // ── Hook-only: slash / reward ─────────────────────────────────────────────
    function slash(address evaluator, uint256 amount) external onlyHook {
        Evaluator storage ev = evaluators[evaluator];
        uint256 cut = amount > ev.stake ? ev.stake : amount;
        ev.stake -= cut;
        if (ev.stake == 0) ev.active = false;
        emit Slashed(evaluator, cut);
    }

    function reward(address evaluator) external payable onlyHook {
        evaluators[evaluator].stake += msg.value;
        emit Rewarded(evaluator, msg.value);
    }

    function recordVote(address evaluator, bool wasCorrect) external onlyHook {
        evaluators[evaluator].totalVotes++;
        if (wasCorrect) evaluators[evaluator].correctVotes++;
    }

    // ── View ──────────────────────────────────────────────────────────────────
    function isActive(address evaluator) external view returns (bool) {
        return evaluators[evaluator].active;
    }

    function getStake(address evaluator) external view returns (uint256) {
        return evaluators[evaluator].stake;
    }

    function getAccuracy(address evaluator) external view returns (uint256 numerator, uint256 denominator) {
        Evaluator memory ev = evaluators[evaluator];
        return (ev.correctVotes, ev.totalVotes);
    }

    function activeCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < evaluatorList.length; i++) {
            if (evaluators[evaluatorList[i]].active) count++;
        }
    }

    /// @notice Pseudo-random selection of 3 active evaluators for a jury.
    ///         Not truly random — replace with VRF in production.
    function selectJury(uint256 seed) external view returns (address[3] memory jury) {
        address[] memory pool = new address[](evaluatorList.length);
        uint256 poolSize;
        for (uint256 i = 0; i < evaluatorList.length; i++) {
            if (evaluators[evaluatorList[i]].active) {
                pool[poolSize++] = evaluatorList[i];
            }
        }
        require(poolSize >= 3, "Need at least 3 active evaluators");

        // Fisher-Yates shuffle of first 3 picks
        for (uint256 i = 0; i < 3; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (poolSize - i));
            address tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
            jury[i] = pool[i];
        }
    }
}
