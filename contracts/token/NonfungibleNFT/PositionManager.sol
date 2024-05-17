// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';

import "../../interfaces/ISPrime.sol";
import "../../interfaces/IPositionManager.sol";
import "../../lib/joe-v2/LiquidityAmounts.sol";

/// @title NFT positions
contract PositionManager is
    ERC721Enumerable,
    IPositionManager,
    Ownable
{   
    // token id => Position Information
    mapping(uint256 => Position) private _positions;
    // bin id => Bin Information
    mapping(uint256 => DepositConfig) private _binInfo;
    uint176 private _nextId = 1;
    address public sPrime;

    constructor() ERC721('SPrime Position NFT', 'SPRIME-POS') {}

    modifier onlySPrime() {
        require(sPrime == _msgSender(), "Not sPrime");
        _;
    }

    function setSPrime(address sPrime_) external onlyOwner {
        sPrime = sPrime_;
    }

    function getDepositConfig(uint256 centerId) external view returns(DepositConfig memory) {
        return _binInfo[centerId];
    }

    function getDepositConfigFromTokenId(uint256 tokenId) external view returns(DepositConfig memory) {
        uint256 centerId = _positions[tokenId].centerId;
        return _binInfo[centerId];
    }

    function positions(uint256 tokenId)
        external
        view
        override
        returns (
            address token0,
            address token1,
            address pairAddr,
            uint256 totalShare,
            uint256 centerId,
            uint256[] memory liquidityMinted
        )
    {
        Position memory position = _positions[tokenId];

        address lbPair = ISPrime(sPrime).getLBPair();
        address tokenX = ISPrime(sPrime).getTokenX();
        address tokenY = ISPrime(sPrime).getTokenY();

        return (
            tokenX,
            tokenY,
            lbPair,
            position.totalShare,
            position.centerId,
            position.liquidityMinted
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
            totalShare: params.totalShare,
            centerId: params.centerId,
            liquidityMinted: params.liquidityMinted
        });
        
        DepositConfig storage binInfo = _binInfo[params.centerId];
        if(binInfo.depositIds.length == 0) {
            binInfo.depositIds = params.depositIds;
            binInfo.liquidityConfigs = params.liquidityConfigs;
        }
    }

    function update(UpdateParams calldata params)
        external
        override
        onlySPrime
    {
        Position storage position = _positions[params.tokenId];
        if(params.isAdd) {
            position.totalShare += params.share;
            for(uint i = 0 ; i < params.liquidityAmounts.length ; i ++) {
                position.liquidityMinted[i] += params.liquidityAmounts[i];
            }
        } else {
            position.totalShare -= params.share;
            for(uint i = 0 ; i < params.liquidityAmounts.length ; i ++) {
                position.liquidityMinted[i] -= params.liquidityAmounts[i];
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId));
        return "";
    }

    function forceTransfer(address from, address to, uint256 tokenId) external override {
        require(sPrime == _msgSender(), "Only allowed SPrime");

        _transfer(from, to, tokenId);
    }

    function burn(uint256 tokenId) external override {        
        require(sPrime == _msgSender(), "Only allowed SPrime");

        delete _positions[tokenId];
        _burn(tokenId);
    }
}