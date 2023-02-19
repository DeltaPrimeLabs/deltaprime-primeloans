// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2f6b0fb53889a8741a3d7f78a2d5d05ad7a0c76d;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title BtcPool
 * @dev Contract allowing user to deposit to and borrow BTC.b from a dedicated user account
 */
contract BtcPool is Pool {
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.9e18;
    }
}