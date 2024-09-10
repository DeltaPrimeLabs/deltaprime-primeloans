// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

interface IVPrimeController {
    function updateVPrimeSnapshotsForAccounts(address[] memory accounts) external;
    function updateVPrimeSnapshot(address userAddress) external;
    function setUserNeedsUpdate(address userAddress) external;
}