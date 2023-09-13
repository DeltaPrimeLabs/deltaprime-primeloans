// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 58c223f4c83794b2ac9477fb697e0632d59efff8;
pragma solidity 0.8.17;

import "./LinkPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract LinkPoolFactory {
    function deployPool() public {
        LinkPool pool = new LinkPool();
        emit PoolDeployed(msg.sender, address(pool), block.timestamp);
    }

    /**
     * @dev emitted after pool is deployed by any user
     * @param user the address initiating the deployment
     * @param poolAddress of deployed pool
     * @param timestamp of the deployment
     **/
    event PoolDeployed(address user, address poolAddress, uint256 timestamp);
}