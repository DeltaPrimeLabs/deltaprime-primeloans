// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrimeUniswap {
    /**
     * @dev Struct representing a user's share in a pair.
   * @param amount The number of the nft positions.
   * @param liquidityInfo NFT Position information for a specific token id
   */
    struct UserInfo {
        uint256 amount;
        LiquidityInfo[] liquidityInfo;
    }

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

    /**
     * @dev Enum representing the status of an action (either ADD or REMOVE).
   */
    enum Status {
        ADD,
        REMOVE
    }

    /**
      * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param tickLower Tick Lower for the postion.
    * @param tickUpper Tick Uppoer for the position.
    */
    function deposit(
        uint256 amountX,
        uint256 amountY,
        int24 tickLower,
        int24 tickUpper
    ) external;

}