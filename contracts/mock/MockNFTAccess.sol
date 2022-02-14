// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../abstract/NFTAccess.sol";

contract MockNFTAccess is NFTAccess {
    function initialize() external initializer {
        __Ownable_init();
    }
}
