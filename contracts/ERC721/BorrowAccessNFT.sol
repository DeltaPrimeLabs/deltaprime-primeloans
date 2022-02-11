// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./AccessNFT.sol";

contract BorrowAccessNFT is AccessNFT {

    constructor() AccessNFT("DeltaPrimeBorrowAccess", "DP-BA") {}
}
