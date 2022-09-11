// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "../abstract/NFTAccess.sol";

contract MockNFTAccess is NFTAccess {
    function initialize() external initializer {
        __Ownable_init();
    }

    function nftAccessFunction() public view hasAccessNFT returns (uint256 mockResult) {
        mockResult = 777;
    }
}
