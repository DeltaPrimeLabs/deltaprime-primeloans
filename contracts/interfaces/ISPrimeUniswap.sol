// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrimeUniswap {
  /**
   * @dev Struct representing the information for the nft position.
   * @param tokenId NFT Position Token Id.
   * @param lpAmount LP token amount for the specific token id.
   * @param share sPrime token share amount for the nft position
   */
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
}
