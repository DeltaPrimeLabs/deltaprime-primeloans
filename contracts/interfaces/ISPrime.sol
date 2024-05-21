// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrime {
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
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param isRebalance Rebalance the existing position with deposit.
    * @param swapSlippage Slippage for the rebalance.
    */
    function deposit(
        uint256 activeIdDesired,
        uint256 idSlippage,
        uint256 amountX,
        uint256 amountY,
        bool isRebalance,
        uint256 swapSlippage
    ) external;

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param shareWithdraw The amount of share to withdraw.
    */
    function withdraw(
        uint256 shareWithdraw
    ) external;

    function getLBPair() external view returns(address);
    function getTokenX() external view returns(address);
    function getTokenY() external view returns(address);
    function getFullyVestedLockedBalance(address account) external view returns(uint256);
}