// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.17;

interface IPositionManager {
    // details about the position
    struct Position {
        // the sPrime contract address
        address sPrimeAddr;
        // the liquidity of the position
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
        // how many uncollected tokens are owed to the position, as of the last computation
        uint256 tokensOwed0;
        uint256 tokensOwed1;
    }

    struct MintParams {
        address recipient;
        uint256 totalShare;
        uint256 centerId;
        uint256[] liquidityMinted;
        uint256 amount0;
        uint256 amount1;
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

    function forceTransfer(address from, address to, uint256 tokenId) external;

    // Get position details
    function positions(uint256 tokenId)
    external
    view
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
    );
}