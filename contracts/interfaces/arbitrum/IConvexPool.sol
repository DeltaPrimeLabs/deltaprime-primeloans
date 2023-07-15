// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface IConvexPool {
    function deposit(uint256 _pid, uint256 _amount) external returns(bool);
}
