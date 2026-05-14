// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VoteEscrow
/// @notice Time-locked stake escrow for evaluator rewards.
///         Evaluators can lock USDC for a defined period to boost their jury selection
///         weight and earn compound rewards from fees. Locked stake cannot be slashed
///         while in the lock period - acts as a commitment device.
contract VoteEscrow {
    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant MIN_LOCK_DURATION = 7 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant MAX_BOOST = 4e18;   // 4× weight at max lock (1 year)

    // ── State ─────────────────────────────────────────────────────────────────
    struct Lock {
        uint256 amount;     // native USDC locked (18 decimals)
        uint256 unlockAt;   // timestamp when stake can be withdrawn
        uint256 weight;     // voting weight (amount × time_boost)
    }

    mapping(address => Lock) public locks;

    // ── Events ────────────────────────────────────────────────────────────────
    event Locked(address indexed user, uint256 amount, uint256 unlockAt, uint256 weight);
    event Unlocked(address indexed user, uint256 amount);
    event Extended(address indexed user, uint256 newUnlockAt, uint256 newWeight);

    // ── Lock ──────────────────────────────────────────────────────────────────

    /// @notice Lock native USDC for `duration` seconds to earn jury selection weight.
    function lock(uint256 duration) external payable {
        require(msg.value > 0, "No value sent");
        require(duration >= MIN_LOCK_DURATION, "Lock too short");
        require(duration <= MAX_LOCK_DURATION, "Lock too long");
        require(locks[msg.sender].amount == 0, "Already locked - extend instead");

        uint256 unlockAt = block.timestamp + duration;
        uint256 weight = _computeWeight(msg.value, duration);

        locks[msg.sender] = Lock({ amount: msg.value, unlockAt: unlockAt, weight: weight });

        emit Locked(msg.sender, msg.value, unlockAt, weight);
    }

    /// @notice Extend an existing lock. New duration must be longer than remaining.
    function extend(uint256 newDuration) external {
        Lock storage l = locks[msg.sender];
        require(l.amount > 0, "Nothing locked");
        uint256 remaining = l.unlockAt > block.timestamp ? l.unlockAt - block.timestamp : 0;
        require(newDuration > remaining, "New duration must be longer");
        require(newDuration <= MAX_LOCK_DURATION, "Lock too long");

        l.unlockAt = block.timestamp + newDuration;
        l.weight = _computeWeight(l.amount, newDuration);

        emit Extended(msg.sender, l.unlockAt, l.weight);
    }

    /// @notice Withdraw stake after the lock period expires.
    function unlock() external {
        Lock storage l = locks[msg.sender];
        require(l.amount > 0, "Nothing locked");
        require(block.timestamp >= l.unlockAt, "Still locked");

        uint256 amt = l.amount;
        delete locks[msg.sender];
        payable(msg.sender).transfer(amt);

        emit Unlocked(msg.sender, amt);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getWeight(address user) external view returns (uint256) {
        return locks[user].weight;
    }

    function getLock(address user) external view returns (uint256 amount, uint256 unlockAt, uint256 weight, uint256 remaining) {
        Lock memory l = locks[user];
        uint256 rem = l.unlockAt > block.timestamp ? l.unlockAt - block.timestamp : 0;
        return (l.amount, l.unlockAt, l.weight, rem);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /// @dev Weight = amount × boost, where boost scales from 1× (7 days) to 4× (365 days).
    function _computeWeight(uint256 amount, uint256 duration) internal pure returns (uint256) {
        uint256 boost = 1e18 + (MAX_BOOST - 1e18) * (duration - MIN_LOCK_DURATION) / (MAX_LOCK_DURATION - MIN_LOCK_DURATION);
        return amount * boost / 1e18;
    }

    receive() external payable {}
}
