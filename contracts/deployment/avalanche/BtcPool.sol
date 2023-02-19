// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: a8429e3dd31e4164503af56863fbb4a7e868ceb6;
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