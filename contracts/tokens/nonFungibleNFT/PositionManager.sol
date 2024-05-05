// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

import "../../interfaces/ISPrime.sol";
import "../../interfaces/IPositionManager.sol";
import "../../lib/joe-v2/LiquidityAmounts.sol";

/// @title NFT positions
contract PositionManager is
ERC721,
IPositionManager,
Ownable
{
    mapping(uint256 => Position) private _positions;
    mapping(address => bool) private _sPrimeStatus;
    uint176 private _nextId = 1;

    constructor (
    ) ERC721('SPrime Position NFT', 'SPRIME-POS') {
    }

    modifier onlySPrime() {
        require(_sPrimeStatus[_msgSender()], "Not Added");
        _;
    }

    function addSPrime(address sPrimeAddress) external onlyOwner {
        require(!_sPrimeStatus[sPrimeAddress], "Address already added");
        _sPrimeStatus[sPrimeAddress] = true;
    }

    function removeSPrime(address sPrimeAddress) external onlyOwner {
        require(_sPrimeStatus[sPrimeAddress], "Address not added");
        _sPrimeStatus[sPrimeAddress] = false;
    }

    function positions(uint256 tokenId)
    external
    view
    override
    returns (
        address token0,
        address token1,
        address pairAddr,
        address sPrimeAddr,
        uint256 totalShare,
        uint256 centerId,
        uint256[] memory liquidityMinted,
        uint256 tokensOwed0,
        uint256 tokensOwed1
    )
    {
        Position memory position = _positions[tokenId];
        require(position.sPrimeAddr != address(0), 'Invalid token ID');

        address lbPair = ISPrime(position.sPrimeAddr).getLBPair();
        address tokenX = ISPrime(position.sPrimeAddr).getTokenX();
        address tokenY = ISPrime(position.sPrimeAddr).getTokenY();

        return (
            tokenX,
            tokenY,
            lbPair,
            position.sPrimeAddr,
            position.totalShare,
            position.centerId,
            position.liquidityMinted,
            position.tokensOwed0,
            position.tokensOwed1
        );
    }

    function mint(MintParams calldata params)
    external
    override
    onlySPrime
    returns (
        uint256 tokenId
    )
    {
        _mint(params.recipient, (tokenId = _nextId++));

        _positions[tokenId] = Position({
            sPrimeAddr: _msgSender(),
            totalShare: params.totalShare,
            centerId: params.centerId,
            liquidityMinted: params.liquidityMinted,
            tokensOwed0: params.amount0,
            tokensOwed1: params.amount1
        });
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId));
        return "";
    }

    function forceTransfer(address from, address to, uint256 tokenId) external override {
        Position storage position = _positions[tokenId];
        require(position.sPrimeAddr == _msgSender(), "Only allowed SPrime");

        _transfer(from, to, tokenId);
    }

    function burn(uint256 tokenId) external override {
        Position storage position = _positions[tokenId];

        require(position.sPrimeAddr == _msgSender(), "Only allowed SPrime");
        delete _positions[tokenId];
        _burn(tokenId);
    }
}