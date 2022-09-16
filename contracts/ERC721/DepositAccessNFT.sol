// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "./AccessNFT.sol";

contract DepositAccessNFT is AccessNFT {

    constructor() AccessNFT("DeltaPrimeDepositAccess", "DP-DA") {
        accessTokenTrustedSigner = 0x1884fa898A26D0e080d047533B1c1E495d958b1D;
    }
}
