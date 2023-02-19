// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: a8429e3dd31e4164503af56863fbb4a7e868ceb6;
pragma solidity 0.8.17;

import "./EthPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract EthPoolFactory {
    function deployPool() public {
        EthPool pool = new EthPool();
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