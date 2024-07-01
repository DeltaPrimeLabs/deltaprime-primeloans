// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8ce7ef7b775c75f60e36d4d66915788221e9e8c4;
pragma solidity 0.8.17;

/**
 * @title PRIME vesting contract
 * @dev Contract distributing PRIME among vesting participants.
 */
interface IPrimeVesting {

    struct VestingInfo {
        uint32 cliffPeriod;
        uint32 vestingPeriod;
        address grantClaimRightTo;
        uint256 totalAmount;
    }

    struct UserInfo {
        VestingInfo info;
        uint256 claimed;
    }

    event Claimed(
        address indexed user,
        address indexed claimant,
        uint256 indexed amount,
        uint256 timestamp
    );


    function claim() external;

    function claimWithAmount(uint256 amount) external;

    function claimFor(address user) external;

    function claimForWithAmount(address user, uint256 amount) external;

    function claimable(address user) external view returns (uint256);

    function userInfos(address user) external view returns (UserInfo memory);

}