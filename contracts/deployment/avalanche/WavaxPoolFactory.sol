// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 49fd65d9a6ea5ddcd283ac4913262e342cf1ad80;
pragma solidity 0.8.17;

import "./WavaxPool.sol";


/**
 * @title WavaxPoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract WavaxPoolFactory {
    function deployPool() public {
        WavaxPool pool = new WavaxPool();
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