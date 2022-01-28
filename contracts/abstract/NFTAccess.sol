// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract NFTAccess is OwnableUpgradeable {
    ERC721 private accessNFT;

    // Setting the address to a zero address removes the access lock.
    function setAccessNFT(ERC721 nftAddress) external onlyOwner {
        accessNFT = nftAddress;
    }

    modifier hasAccessNFT {
        if(address(accessNFT) != address(0)) {
            require(accessNFT.balanceOf(msg.sender) > 0, "Access NFT required");
        }
        _;
    }
}
