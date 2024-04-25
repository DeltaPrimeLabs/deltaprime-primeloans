// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {vPrimeController} from "./vPrimeController.sol";

/**
 * @dev Extension of ERC20 to support Compound-like voting and delegation. This version is more generic than Compound's,
 * and supports token supply up to 2^224^ - 1, while COMP is limited to 2^96^ - 1.
 *
 * NOTE: If exact COMP compatibility is required, use the {ERC20VotesComp} variant of this module.
 *
 * This extension keeps a history (checkpoints) of each account's vote power. Vote power can be delegated either
 * by calling the {delegate} function directly, or by providing a signature to be used with {delegateBySig}. Voting
 * power can be queried through the public accessors {getVotes} and {getPastVotes}.
 *
 * By default, token balance does not account for voting power. This makes transfers cheaper. The downside is that it
 * requires users to delegate to themselves in order to activate checkpoints and have their voting power tracked.
 *
 * _Available since v4.2._
 */
contract vPrime is OwnableUpgradeable {
    struct Checkpoint {
        uint32 blockTimestamp;
        uint256 balance;
        int256 rate; // Tokens per second
        uint256 maxVPrimeCap;
    }

    mapping(address => Checkpoint[]) private _checkpoints; // _checkpoints[address(this)] serves as a total supply checkpoint
    address public vPrimeControllerAddress;

    function initialize() external initializer {
        __Ownable_init();
    }

    /**
    * @notice Sets the address of the vPrimeController contract.
    * @dev Can only be called by the contract owner.
    * @param _vPrimeControllerAddress The address of the vPrimeController contract.
    */
    function setVPrimeControllerAddress(address _vPrimeControllerAddress) external onlyOwner {
        vPrimeControllerAddress = _vPrimeControllerAddress;
    }

    /**
    * @notice Checks if an address is whitelisted.
    * @param account The address to check.
    * @return bool Returns true if the address is whitelisted, false otherwise.
    */
    function isWhitelisted(address account) public virtual view returns (bool) {
        return account == vPrimeControllerAddress;
    }


    // Function to adjust balance for a whitelisted address
    // It will be called either by PrimeAccount contract (upon deposit/withdrawal) or by any of the whitelisted pools (for despositors)
    // Those calls will assume that the caller already did all the necessary calculations to calculate what should be the new "target balance" (newMaxVPrimeCap)
    // and at which rate it should be adjusted (number of votes received/lost per second)
    // PA will call this function in case of borrow/repay/mintSPrime/redeemSPrime
    // Pools will call this function in case of deposit/withdraw
    // sPrime can also call this function in case of mint/redeem (both for PAs and depositors, but checking different conditions for each)
    function adjustRateAndCap(address user, int256 rate, uint256 newMaxVPrimeCap) external {
        require(isWhitelisted(_msgSender()), "Caller is not whitelisted");

        uint256 lastRecordedVotes = getVotes(user);
        uint256 currentVotesBalance = balanceOf(user);
        int256 votesDiff = int256(currentVotesBalance) - int256(lastRecordedVotes);

        if(votesDiff > 0) {
            increaseTotalSupply(uint256(votesDiff));
            _writeCheckpoint(_checkpoints[user], _add, uint256(votesDiff), rate, newMaxVPrimeCap);
        } else if(votesDiff < 0) {
            decreaseTotalSupply(uint256(-votesDiff));
            _writeCheckpoint(_checkpoints[user], _subtract, uint256(-votesDiff), rate, newMaxVPrimeCap);
        } else {
            _writeCheckpoint(_checkpoints[user], _add, 0, rate, newMaxVPrimeCap);
        }
    }

    function adjustRateCapAndBalance(address user, int256 rate, uint256 newMaxVPrimeCap, uint256 balance) external {
        require(isWhitelisted(_msgSender()), "Caller is not whitelisted");

        uint256 lastRecordedVotes = getVotes(user);
        int256 votesDiff = int256(balance) - int256(lastRecordedVotes);

        if(votesDiff > 0) {
            increaseTotalSupply(uint256(votesDiff));
            _writeCheckpointOverwriteBalance(_checkpoints[user], balance, rate, newMaxVPrimeCap);
        } else if(votesDiff < 0) {
            decreaseTotalSupply(uint256(-votesDiff));
            _writeCheckpointOverwriteBalance(_checkpoints[user], balance, rate, newMaxVPrimeCap);
        } else {
            _writeCheckpointOverwriteBalance(_checkpoints[user], lastRecordedVotes, rate, newMaxVPrimeCap);
        }
    }


    /**
     * @dev Clock used for flagging checkpoints. Can be overridden to implement timestamp based checkpoints (and voting).
     */
    // Overrides IERC6372 functions to make the token & governor timestamp-based
    function clock() public view returns (uint48) {
        return uint48(block.timestamp);
    }
    /**
     * @dev Description of the clockx
     */
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @dev Get the `pos`-th checkpoint for `account`.
     */
    function checkpoints(address account, uint32 pos) public view virtual returns (Checkpoint memory) {
        return _checkpoints[account][pos];
    }

    /**
     * @dev Get number of checkpoints for `account`.
     */
    function numCheckpoints(address account) public view virtual returns (uint32) {
        return SafeCast.toUint32(_checkpoints[account].length);
    }

    /**
     * @dev Gets the last recorded votes balance for `account`
     */
    function getVotes(address account) public view virtual  returns (uint256) {
        uint256 pos = _checkpoints[account].length;
        unchecked {
            return pos == 0 ? 0 : _checkpoints[account][pos - 1].balance;
        }
    }

    /**
     * @dev Retrieve the number of votes for `account` at the end of `timestamp`.
     *
     * Requirements:
     *
     * - `timestamp` must be in the past
     */
    function getPastVotes(address account, uint256 timestamp) public view virtual returns (uint256) {
        require(timestamp < clock(), "Future lookup");
        return _checkpointsLookup(_checkpoints[account], timestamp);
    }

    /**
     * @dev Retrieve the `totalSupply` at the end of `timestamp`. Note, this value is the sum of all balances.
     * It is NOT the sum of all the delegated votes!
     *
     * Requirements:
     *
     * - `timestamp` must be in the past
     */
    function getPastTotalSupply(uint256 timestamp) public view virtual returns (uint256) {
        require(timestamp < clock(), "Future lookup");
        return _checkpointsLookup(_checkpoints[address(this)], timestamp);
    }

    function getLastRecordedTotalSupply() public view virtual returns (uint256) {
        uint256 pos = _checkpoints[address(this)].length;
        unchecked {
            return pos == 0 ? 0 : _checkpoints[address(this)][pos - 1].balance;
        }
    }

    /**
     * @dev Lookup a value in a list of (sorted) checkpoints.
     */
    function _checkpointsLookup(Checkpoint[] storage ckpts, uint256 timestamp) private view returns (uint256) {
        // We run a binary search to look for the last (most recent) checkpoint taken before (or at) `timestamp`.
        //
        // Initially we check if the block is recent to narrow the search range.
        // During the loop, the index of the wanted checkpoint remains in the range [low-1, high).
        // With each iteration, either `low` or `high` is moved towards the middle of the range to maintain the invariant.
        // - If the middle checkpoint is after `timestamp`, we look in [low, mid)
        // - If the middle checkpoint is before or equal to `timestamp`, we look in [mid+1, high)
        // Once we reach a single value (when low == high), we've found the right checkpoint at the index high-1, if not
        // out of bounds (in which case we're looking too far in the past and the result is 0).
        // Note that if the latest checkpoint available is exactly for `timestamp`, we end up with an index that is
        // past the end of the array, so we technically don't find a checkpoint after `timestamp`, but it works out
        // the same.
        uint256 length = ckpts.length;

        uint256 low = 0;
        uint256 high = length;

        if (length > 5) {
            uint256 mid = length - Math.sqrt(length);
            if (_unsafeAccess(ckpts, mid).blockTimestamp > timestamp) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        while (low < high) {
            uint256 mid = Math.average(low, high);
            if (_unsafeAccess(ckpts, mid).blockTimestamp > timestamp) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        unchecked {
            return high == 0 ? 0 : _unsafeAccess(ckpts, high - 1).balance;
        }
    }

    /**
     * @dev Maximum token supply. Defaults to `type(uint224).max` (2^224^ - 1).
     */
    function _maxSupply() internal view virtual returns (uint224) {
        return type(uint224).max;
    }

    function increaseTotalSupply(uint256 amount) internal {
        require(getLastRecordedTotalSupply() + amount <= _maxSupply(), "Total supply risks overflowing votes");
        _writeCheckpointWithoutRateAndCap(_checkpoints[address(this)], _add, amount);
    }

    function decreaseTotalSupply(uint256 amount) internal {
        _writeCheckpointWithoutRateAndCap(_checkpoints[address(this)], _subtract, amount);
    }

    // Override balanceOf to compute balance dynamically
    function balanceOf(address account) public view returns (uint256) {
        if(_checkpoints[account].length == 0) {
            return 0;
        }
        Checkpoint memory cp = _checkpoints[account][_checkpoints[account].length - 1];

        uint256 elapsedTime = block.timestamp - cp.blockTimestamp;
        uint256 newBalance;

        if (cp.rate >= 0) {
            uint256 balanceIncrease = uint256(cp.rate) * elapsedTime;
            newBalance = cp.balance + balanceIncrease;
            if (newBalance > cp.maxVPrimeCap) {
                return cp.maxVPrimeCap;
            } else {
                return newBalance;
            }
        } else {
            // If rate is negative, convert to positive for calculation, then subtract
            uint256 balanceDecrease = uint256(-cp.rate) * elapsedTime;
            if (balanceDecrease > cp.balance) {
                // Prevent underflow, setting balance to min cap if decrease exceeds current balance
                return cp.maxVPrimeCap;
            } else {
                newBalance = cp.balance - balanceDecrease;
                if (newBalance < cp.maxVPrimeCap) {
                    return cp.maxVPrimeCap;
                } else {
                    return newBalance;
                }
            }
        }
    }

    function _writeCheckpointWithoutRateAndCap(
        Checkpoint[] storage ckpts,
        function(uint256, uint256) view returns (uint256) op,
        uint256 delta
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        _writeCheckpoint(ckpts, op, delta, 0, 0);
    }

    function _writeCheckpoint(
        Checkpoint[] storage ckpts,
        function(uint256, uint256) view returns (uint256) op,
        uint256 delta,
        int256 rate,
        uint256 maxVPrimeCap
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        uint256 pos = ckpts.length;
        Checkpoint memory oldCkpt = pos == 0 ? Checkpoint(0, 0, 0, 0) : ckpts[pos - 1];

        oldWeight = oldCkpt.balance;
        newWeight = op(oldWeight, delta);

        if (pos > 0 && oldCkpt.blockTimestamp == clock()) {
            oldCkpt.balance = newWeight;
            oldCkpt.rate = rate;
            oldCkpt.maxVPrimeCap = maxVPrimeCap;
        } else {
            ckpts.push(Checkpoint({
                blockTimestamp: SafeCast.toUint32(clock()),
                balance: newWeight,
                rate: rate,
                maxVPrimeCap: maxVPrimeCap
            }));
        }
    }

    function _writeCheckpointOverwriteBalance(
        Checkpoint[] storage ckpts,
        uint256 balance,
        int256 rate,
        uint256 maxVPrimeCap
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        uint256 pos = ckpts.length;
        Checkpoint memory oldCkpt = pos == 0 ? Checkpoint(0, 0, 0, 0) : ckpts[pos - 1];

        if (pos > 0 && oldCkpt.blockTimestamp == clock()) {
            oldCkpt.balance = balance;
            oldCkpt.rate = rate;
            oldCkpt.maxVPrimeCap = maxVPrimeCap;
        } else {
            ckpts.push(Checkpoint({
                blockTimestamp: SafeCast.toUint32(clock()),
                balance: balance,
                rate: rate,
                maxVPrimeCap: maxVPrimeCap
            }));
        }
    }

    function _add(uint256 a, uint256 b) private pure returns (uint256) {
        return a + b;
    }

    function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
        return a - b;
    }

    /**
     * @dev Access an element of the array without performing bounds check. The position is assumed to be within bounds.
     */
    function _unsafeAccess(Checkpoint[] storage ckpts, uint256 pos) private pure returns (Checkpoint storage result) {
        assembly {
            mstore(0, ckpts.slot)
            result.slot := add(keccak256(0, 0x20), pos)
        }
    }
}
