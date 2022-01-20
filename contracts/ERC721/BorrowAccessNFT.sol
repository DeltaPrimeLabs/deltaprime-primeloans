// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract BorrowAccessNFT is ERC721, Pausable, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    constructor() ERC721("DeltaPrimeBorrowAccess", "DP-01") {}

    function _baseURI() internal pure override returns (string memory) {
        return "ar://arweave-hash-pointing-to-the-metadata-json";
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        return _baseURI();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
    internal
    whenNotPausedOwnerExemption
    override
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    modifier whenNotPausedOwnerExemption {
        if(_msgSender() != owner()) {
            require(!paused(), "Pausable: paused");
        }
        _;
    }
}
