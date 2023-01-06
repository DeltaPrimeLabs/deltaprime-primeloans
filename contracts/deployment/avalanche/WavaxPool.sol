// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5bae95ca244e96444fe80078195944f6637e72d8;
pragma solidity 0.8.17;

import "../../WrappedNativeTokenPool.sol";


/**
 * @title WavaxPool
 * @dev Contract allowing user to deposit to and borrow WAVAX from a dedicated user account
 */
contract WavaxPool is WrappedNativeTokenPool {
    // Returns max. acceptable pool utilisation after borrow action
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.8e18;
    }
}