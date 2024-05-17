// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';

interface IPositionManager is IERC721Enumerable {
    // details about the position
    struct Position {
        // the liquidity of the position
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
    }

    struct BinInfo {
        uint256 binShare;
        uint256[] liquidityMinted;
        uint256[] depositIds;
        bytes32[] liquidityConfigs;
    }


    struct UpdateParams {
        uint256 tokenId;
        uint256 share;
        uint256[] liquidityAmounts;
        bool isAdd;
    }

    struct MintParams {
        address recipient;
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
        bytes32[] liquidityConfigs;
        uint256[] depositIds;
    }

    // Mint new position NFT
    function mint(
        MintParams calldata params
    )
        external
        returns (
            uint256 tokenId
        );

    // Burn position NFT
    function burn(
        uint256 tokenId
    )
        external;

    function update(
        UpdateParams calldata params
    )
        external;

    function forceTransfer(address from, address to, uint256 tokenId) external;
    function getBinInfo(uint256 centerId) external view returns(BinInfo memory);
    function getBinInfoFromTokenId(uint256 tokenId) external view returns(BinInfo memory);
    
    // Get position details
    function positions(uint256 tokenId)
        external
        view
        returns (
            address token0,
            address token1,
            address pairAddr,
            uint256 totalShare,
            uint256 centerId,
            uint256[] memory liquidityMinted
        );
}