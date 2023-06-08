pragma solidity ^0.8.17;

import "../../joe-v2/ILBRouter.sol";
import "../../uniswap-v3/IUniswapV3Pool.sol";

interface IUniswapV3Facet {

    struct UniswapV3Position {
        IUniswapV3Pool pool;
        int24 tickLower;
        int24 tickUpper;
    }

    function addLiquidityUniswapV3(ILBRouter.LiquidityParameters memory liquidityParameters) external;

}
