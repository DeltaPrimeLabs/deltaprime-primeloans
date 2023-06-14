pragma solidity ^0.8.17;

import "../../joe-v2/ILBRouter.sol";
import "../../uniswap-v3/IUniswapV3Pool.sol";
import "../../uniswap-v3-periphery/INonfungiblePositionManager.sol";

interface IUniswapV3Facet {

    struct UniswapV3Position {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    function addLiquidityUniswapV3(INonfungiblePositionManager.MintParams calldata params) external;

}
