// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "../ERC721/BorrowAccessNFT.sol";

contract MockBorrowAccessNFT is BorrowAccessNFT {

    constructor() BorrowAccessNFT() {
        accessTokenTrustedSigner = 0xdD2FD4581271e230360230F9337D5c0430Bf44C0;
    }
}
