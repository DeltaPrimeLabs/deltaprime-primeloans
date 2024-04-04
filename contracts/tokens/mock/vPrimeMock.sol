// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../vPrime.sol";


contract vPrimeMock is vPrime {
    function isWhitelisted(address account) public override view returns (bool) {
        return true;
    }

    constructor(address[] memory whitelistedPools, address borrowersRegistryAddress)
    vPrime(whitelistedPools, borrowersRegistryAddress)
    {}
}
