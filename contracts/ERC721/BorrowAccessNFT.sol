// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../abstract/ECDSAVerify.sol";

contract BorrowAccessNFT is ERC721, ERC721URIStorage, Pausable, Ownable, ECDSAVerify {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping(string => address) discordIds;
    string[] availableUris;
    address constant discordTrustedSigner = 0xdD2FD4581271e230360230F9337D5c0430Bf44C0;

    constructor() ERC721("DeltaPrimeBorrowAccess", "DP-01") {}

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function addAvailableUri(string[] memory _uris) external onlyOwner {
        for(uint i=0;i<_uris.length;i++) {
            availableUris.push(_uris[i]);
        }
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(string memory discordId, bytes memory signature) public returns (uint256) {
        require(verifyMessage(discordTrustedSigner, discordId, signature), "Signer not authorized");
        require(discordIds[discordId] == address(0), "Only one NFT per one discord user is allowed");
        require(availableUris.length > 0, "All available NFTs were already minted");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        discordIds[discordId] = _msgSender();
        _safeMint(_msgSender(), tokenId);
        _setTokenURI(tokenId, availableUris[availableUris.length-1]);
        availableUris.pop();
        return tokenId;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal whenNotPausedOwnerExemption override {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    modifier whenNotPausedOwnerExemption {
        if(_msgSender() != owner()) {
            require(!paused(), "Pausable: paused");
        }
        _;
    }
}
