// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../abstract/ECDSAVerify.sol";

contract EarlyAccessNFT is ERC721, Pausable, Ownable, ECDSAVerify  {
    using Counters for Counters.Counter;

    Counters.Counter public _tokenIdCounter;
    mapping(string => address) public accessTokens;
    string public baseURI;
    address public accessTokenTrustedSigner;


    constructor(string memory _baseUri) ERC721("DeltaPrimeEarlyAccess", "DP-EA") {
        _pause();
        baseURI = _baseUri;
    }

    function setTrustedSigner(address trustedSigner) external onlyOwner {
        require(trustedSigner != address(0), "Trusted signer cannot be a zero address");
        accessTokenTrustedSigner = trustedSigner;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        return baseURI;
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

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        accessTokens[accessToken] = _msgSender();
        _safeMint(_msgSender(), tokenId);
        return tokenId;
    }

    function airdropMint(address[] memory _accounts) external onlyOwner returns (uint256 _NFTsMinted){
        uint256 tokenId;
        for (uint i=0; i< _accounts.length; i++) {
            tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(_accounts[i], tokenId);
        }
        _NFTsMinted = _accounts.length;
    }

    modifier whenNotPausedMintingExemption(address from) {
        if(from != address(0)) {
            require(!paused(), "Pausable: paused");
        }
        _;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal whenNotPausedMintingExemption(from) override(ERC721) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}