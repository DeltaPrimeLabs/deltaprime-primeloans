// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../abstract/ECDSAVerify.sol";

contract BorrowAccessNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable, ECDSAVerify {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping(string => address) accessTokens;
    string[] availableUris;
    address accessTokenTrustedSigner = 0xdD2FD4581271e230360230F9337D5c0430Bf44C0;

    constructor() ERC721("DeltaPrimeBorrowAccess", "DP-BA") {}

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function setTrustedSigner(address trustedSigner) external onlyOwner {
        require(trustedSigner != address(0), "Trusted signer cannot be a zero address");
        accessTokenTrustedSigner = trustedSigner;
    }

    function addAvailableUri(string[] memory _uris) external onlyOwner {
        for(uint i=0;i<_uris.length;i++) {
            availableUris.push(_uris[i]);
        }
    }

    function getAvailableUri(uint256 index) external view returns(string memory) {
        return availableUris[index];
    }

    function getAvailableUrisCount() external view returns(uint256) {
        return availableUris.length;
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

    function safeMint(string memory accessToken, bytes memory signature) public returns (uint256) {
        require(verifyMessage(accessTokenTrustedSigner, accessToken, signature), "Signer not authorized");
        require(accessTokens[accessToken] == address(0), "Only one NFT per one user is allowed");
        require(balanceOf(_msgSender()) == 0, "Only one NFT per one wallet is allowed");
        require(availableUris.length > 0, "All available NFTs were already minted");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        accessTokens[accessToken] = _msgSender();
        _safeMint(_msgSender(), tokenId);
        _setTokenURI(tokenId, availableUris[availableUris.length-1]);
        availableUris.pop();
        return tokenId;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal whenNotPausedMintingExemption(from) override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    modifier whenNotPausedMintingExemption(address from) {
        if(from != address(0)) {
            require(!paused(), "Pausable: paused");
        }
        _;
    }
}
