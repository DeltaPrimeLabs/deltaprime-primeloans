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
    * @dev Users can use withdraw function for withdrawing their share.
    * @param shareWithdraw The amount of share to withdraw.
    */
    function withdraw(
        uint256 shareWithdraw
    ) external;

    function getTokenX() external view returns(address);
    function getTokenY() external view returns(address);
    function getPoolPrice() external view returns(uint256);
    function getUserValueInTokenY(address user, uint256 poolPrice) external view returns (uint256);
    function getUserDepositDollarValue(address user) external view returns (uint256);
    function getFullyVestedLockedBalance(address account) external view returns(uint256);
}