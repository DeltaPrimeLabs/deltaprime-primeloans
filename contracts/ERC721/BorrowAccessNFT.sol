// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "./AccessNFT.sol";

contract BorrowAccessNFT is AccessNFT {

    constructor() AccessNFT("DeltaPrimeBorrowAccess", "DP-BA") {
        accessTokenTrustedSigner = 0x6C21A841d6f029243AF87EF01f6772F05832144b;
    }
}
