// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

import "./ISPrime.sol";

interface ISPrimeUniswap is ISPrime {
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
}
