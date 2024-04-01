// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

interface ISPrime {
    /**
     * @dev Struct representing information about a pair.
     * @param depositIds Deposit ID list.
     * @param lastRebalance The timestamp of the last rebalance.
     * @param totalShare The total share of the pair.
     */
    struct PairInfo {
        uint256[] depositIds;
        uint64 lastRebalance;
        uint256 totalShare;
    }

    struct UserShare {
        uint256 share;
        uint256 centerId;
    }
    
    function deposit(
        uint256 activeIdDesired, 
        uint256 idSlippage, 
        uint256 amountX, 
        uint256 amountY
    ) external;

    function withdraw(
        uint256 shareWithdraw
    ) external;
}
