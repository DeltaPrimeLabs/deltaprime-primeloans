// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title PRIME vesting contract
 * @dev Contract distributing PRIME among vesting participants.
 */
contract PrimeVesting is Ownable {
    using SafeERC20 for IERC20;

    struct VestingInfo {
        uint32 cliffPeriod;
        uint32 vestingPeriod;
        address onBehalfOf;
        uint256 totalAmount;
    }

    struct UserInfo {
        VestingInfo info;
        uint256 claimed;
    }

    IERC20 public immutable primeToken;

    uint256 public immutable startTime;

    mapping(address => UserInfo) public userInfos;

    /// Errors

    /// @dev Trying to claim from unautorized account
    error Unauthorized();

    /// @dev Input array lengths do not match
    error InputLengthMismatch();

    /// @dev Invalid vesting start time
    error InvalidStartTime();

    /// @dev Invalid address
    error InvalidAddress();

    /// @dev No claim available
    error NothingToClaim();

    /// Events

    event Claimed(
        address indexed user,
        address indexed onBehalfOf,
        uint256 indexed amount,
        uint256 timestamp
    );

    /// Constructor

    constructor(
        address primeToken_,
        uint256 startTime_,
        address[] memory users_,
        VestingInfo[] memory vestingInfos_
    ) {
        if (users_.length != vestingInfos_.length) {
            revert InputLengthMismatch();
        }
        if (startTime_ < block.timestamp) {
            revert InvalidStartTime();
        }
        if (primeToken_ == address(0)) {
            revert InvalidAddress();
        }

        primeToken = IERC20(primeToken_);
        startTime = startTime_;
        uint256 len = users_.length;
        for (uint256 i; i != len; ++i) {
            address user = users_[i];
            if (user == address(0)) {
                revert InvalidAddress();
            }

            UserInfo storage userInfo = userInfos[user];
            userInfo.info = vestingInfos_[i];
        }
    }

    /// Public functions

    function claim() external {
        _claimFor(msg.sender, msg.sender);
    }

    function claimFor(address user) external {
        _claimFor(user, msg.sender);
    }

    function claimable(address user) public view returns (uint256) {
        return _claimable(user);
    }

    /// Internal functions

    function _claimFor(address user, address onBehalfOf) internal {
        UserInfo storage userInfo = userInfos[user];

        if (user != onBehalfOf && userInfo.info.onBehalfOf != onBehalfOf) {
            revert Unauthorized();
        }

        uint256 claimableAmount = _claimable(user);
        if (claimableAmount == 0) {
            revert NothingToClaim();
        }

        userInfo.claimed += claimableAmount;

        primeToken.safeTransfer(user, claimableAmount);

        emit Claimed(user, onBehalfOf, claimableAmount, block.timestamp);
    }

    function _claimable(address user) internal view returns (uint256) {
        UserInfo storage userInfo = userInfos[user];

        uint256 cliffEnd = startTime + userInfo.info.cliffPeriod;
        if (cliffEnd >= block.timestamp) {
            return 0;
        }

        uint256 duration = Math.min(
            block.timestamp - cliffEnd,
            userInfo.info.vestingPeriod
        );

        return
            (userInfo.info.totalAmount * duration) /
            userInfo.info.vestingPeriod -
            userInfo.claimed;
    }
}
