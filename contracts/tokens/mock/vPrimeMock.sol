// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../vPrime.sol";


contract vPrimeMock is vPrime {
    /* ========== MODIFIERS ========== */
    modifier onlyVPrimeController() override {
        _;
    }
}
