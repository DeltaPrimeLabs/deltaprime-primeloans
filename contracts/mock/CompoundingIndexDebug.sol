// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../lib/WadRayMath.sol";

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CompoundingIndexDebug is Ownable {
  using WadRayMath for uint256;

  uint256 private constant SECONDS_IN_YEAR = 365 days;
  uint256 private constant BASE_RATE = 1e18;

  uint256 public start = block.timestamp;

  uint256 public index = BASE_RATE;
  uint256 public indexUpdateTime = start;

  mapping(uint256 => uint256) prevIndex;
  mapping(address => uint256) userUpdateTime;

  uint256 public rate;

  function setRate(uint256 _rate) public onlyOwner {
    updateIndex();
    rate = _rate;
  }

  function updateUser(address user) public onlyOwner {
    userUpdateTime[user] = block.timestamp;
    prevIndex[block.timestamp] = getIndex();

    //console.log("Updated at: ", now);
    //console.log("Updated index to: ", prevIndex[now]);
  }

  function getIndexedValue(uint256 value, address user)
    public
    view
    returns (uint256)
  {
    //uint256 lastIndex = prevIndex[getLastUserUpdateTime(user)];
    //console.log("Last time: ", getLastUserUpdateTime(user));
    //console.log("Last index: ", lastIndex);
    //console.log("Start time: ", start);

    return
      value
        .wadToRay()
        .rayMul(getIndex().wadToRay())
        .rayDiv(prevIndex[getLastUserUpdateTime(user)].wadToRay())
        .rayToWad();
  }

  function updateIndex() internal {
    prevIndex[indexUpdateTime] = index;

    //console.log("Updated at: ", indexUpdateTime);
    //console.log("Updated index to: ", index);

    index = getIndex();
    indexUpdateTime = block.timestamp;
  }

  function getLastUserUpdateTime(address user) internal view returns (uint256) {
    return userUpdateTime[user] == 0 ? start : userUpdateTime[user];
  }

  function getCompoundedFactor(uint256 period) internal view returns (uint256) {
    return
      ((rate.wadToRay() / SECONDS_IN_YEAR) + WadRayMath.ray()).rayPow(period);
  }

  function getIndex() public view returns (uint256) {
    uint256 period = block.timestamp - indexUpdateTime;
    if (period > 0) {
      return index.wadToRay().rayMul(getCompoundedFactor(period)).rayToWad();
    } else {
      return index;
    }
  }
}
