// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "./lib/WadRayMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * CompoundingIndex
 * The contract contains logic for time-based index recalculation with minimal memory footprint.
 * It could be used as a base building block for any index-based entities like deposits and loans.
 * @dev updatedRate the value of updated rate
 **/
contract CompoundingIndex is Ownable {
  using WadRayMath for uint256;

  uint256 private constant SECONDS_IN_YEAR = 365 days;
  uint256 private constant BASE_RATE = 1e18;

  uint256 public start = block.timestamp;

  uint256 public index = BASE_RATE;
  uint256 public indexUpdateTime = start;

  mapping(uint256 => uint256) prevIndex;
  mapping(address => uint256) userUpdateTime;

  uint256 public rate;

  constructor(address owner_) {
    if (address(owner_) != address(0)) {
      transferOwnership(owner_);
    }
  }

  /* ========== SETTERS ========== */

  /**
   * Sets the new rate
   * Before the new rate is set, the index is updated accumulating interest
   * @dev updatedRate the value of updated rate
   **/
  function setRate(uint256 _rate) public onlyOwner {
    updateIndex();
    rate = _rate;
    emit RateUpdated(rate);
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  /**
   * Updates user index
   * It persists the update time and the update index time->index mapping
   * @dev user address of the index owner
   **/
  function updateUser(address user) public onlyOwner {
    userUpdateTime[user] = block.timestamp;
    prevIndex[block.timestamp] = getIndex();
  }

  /* ========== VIEW FUNCTIONS ========== */

  /**
   * Gets current value of the compounding index
   * It recalculates the value on-demand without updating the storage
   **/
  function getIndex() public view returns (uint256) {
    uint256 period = block.timestamp - indexUpdateTime;
    if (period > 0) {
      return index.wadToRay().rayMul(getCompoundedFactor(period)).rayToWad();
    } else {
      return index;
    }
  }

  /**
   * Gets the user value recalculated to the current index
   * It recalculates the value on-demand without updating the storage
   * Ray operations round up the result, but it is only an issue for very small values (with an order of magnitude
   * of 1 Wei)
   **/
  function getIndexedValue(uint256 value, address user) public view returns (uint256) {
    uint256 userTime = userUpdateTime[user];
    uint256 prevUserIndex = userTime == 0 ? BASE_RATE : prevIndex[userTime];

    return value.wadToRay().rayMul(getIndex().wadToRay()).rayDiv(prevUserIndex.wadToRay()).rayToWad();
  }

  /* ========== INTERNAL FUNCTIONS ========== */

  function updateIndex() internal {
    prevIndex[indexUpdateTime] = index;

    index = getIndex();
    indexUpdateTime = block.timestamp;
  }

  /**
   * Returns compounded factor in Ray
   **/
  function getCompoundedFactor(uint256 period) internal view returns (uint256) {
    return ((rate.wadToRay() / SECONDS_IN_YEAR) + WadRayMath.ray()).rayPow(period);
  }

  /* ========== EVENTS ========== */

  /**
   * @dev updatedRate the value of updated rate
   **/
  event RateUpdated(uint256 updatedRate);
}
