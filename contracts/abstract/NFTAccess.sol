// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract NFTAccess is OwnableUpgradeable {
    ERC721 private alphaAccessNFT;

    // Setting the address to a zero address removes the access lock.
    function setAlphaAccessNFTAddress(address NFTAddress) external onlyOwner {
        alphaAccessNFT = ERC721(NFTAddress);
    }

    modifier AlphaAccessNFTRequired {
        if(address(alphaAccessNFT) != address(0)) {
            require(alphaAccessNFT.balanceOf(msg.sender) > 0, "You do not own the alpha access NFT.");
        }
        _;
    }
}
