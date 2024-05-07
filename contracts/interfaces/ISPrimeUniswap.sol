// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrimeUniswap {
  /**
   * @dev Struct representing a user's share in a pair.
   * @param share The amount of share the user has in the pair.
   * @param centerId The active id of the pair the user has a share in.
   */
  struct UserInfo {
    uint256 amount;
    LiquidityInfo[] liquidityInfo;
  }

  struct LiquidityInfo {
    uint256 tokenId;
    uint128 lpAmount;
    uint256 share;
  }

  /**
   * @dev Struct representing details of a locked amount.
   * @param lockPeriod The duration for which the amount is locked.
   * @param amount The amount that is locked.
   * @param unlockTime The timestamp when the locked amount will be able to released.
   */
  struct LockDetails {
    uint256 lockPeriod;
    uint256 amount;
    uint256 unlockTime;
  }

  /**
   * @dev Enum representing the status of an action (either ADD or REMOVE).
   */
  enum Status {
    ADD,
    REMOVE
  }

  function deposit(
    uint256 amountX,
    uint256 amountY,
    int24 tickLower,
    int24 tickUpper
  ) external;

}
