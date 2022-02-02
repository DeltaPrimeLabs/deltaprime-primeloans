// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract NFTAccess is OwnableUpgradeable {
    bytes32 internal constant ACCESS_NFT_SLOT = bytes32(uint256(keccak256('ACCESS_NFT_SLOT')) - 1);

    // Setting the address to a zero address removes the access lock.
    function setAccessNFT(ERC721 nftAddress) external onlyOwner {
        bytes32 slot = ACCESS_NFT_SLOT;
        assembly {
            sstore(slot, nftAddress)
        }
    }

    modifier hasAccessNFT {
        bytes32 slot = ACCESS_NFT_SLOT;
        ERC721 accessNFT;
        assembly {
            accessNFT := sload(slot)
        }
        if(address(accessNFT) != address(0)) {
            require(accessNFT.balanceOf(msg.sender) > 0, "Access NFT required");
        }
        _;
    }
}
