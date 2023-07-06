pragma solidity ^0.8.17;

import "../../joe-v2/ILBRouter.sol";

interface ITraderJoeV2Facet {

    struct TraderJoeV2Bin {
        ILBPair pair;
        uint24 id;
    }

    struct RemoveLiquidityParameters {
        IERC20 tokenX;
        IERC20 tokenY;
        uint16 binStep;
        uint256 amountXMin;
        uint256 amountYMin;
        uint256[] ids;
        uint256[] amounts;
        uint256 deadline;
    }

    function addLiquidityTraderJoeV2(ILBRouter.LiquidityParameters memory liquidityParameters) external;

    function removeLiquidityTraderJoeV2(RemoveLiquidityParameters memory parameters) external;

}
