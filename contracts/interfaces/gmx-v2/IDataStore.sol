// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

// @title DataStore
// @dev DataStore for all general state values
interface IDataStore {

    function getUint(bytes32 key) external view returns (uint256);

}
