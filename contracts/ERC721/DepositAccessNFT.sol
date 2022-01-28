// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./AccessNFT.sol";

contract DepositAccessNFT is AccessNFT {

    constructor() AccessNFT("DeltaPrimeDepositAccess", "DP-DA") {}
}
