// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract NFTAccess is OwnableUpgradeable {
    ERC721 private borrowerAccessNFT;
    ERC721 private depositorAccessNFT;

    // Setting the address to a zero address removes the access lock.
    function setBorrowerAccessNFT(ERC721 nftAddress) external onlyOwner {
        borrowerAccessNFT = nftAddress;
    }

    // Setting the address to a zero address removes the access lock.
    function setDepositorAccessNFT(ERC721 nftAddress) external onlyOwner {
        depositorAccessNFT = nftAddress;
    }

    modifier hasBorrowerNFT {
        if(address(borrowerAccessNFT) != address(0)) {
            require(borrowerAccessNFT.balanceOf(msg.sender) > 0, "Borrower NFT required");
        }
        _;
    }

    modifier hasDepositorNFT {
        if(address(depositorAccessNFT) != address(0)) {
            require(depositorAccessNFT.balanceOf(msg.sender) > 0, "Depositor NFT required");
        }
        _;
    }
}
