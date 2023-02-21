// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IYieldYakRouter {
    struct Trade {
        uint256 amountIn;
        uint256 amountOut;
        address[] path;
        address[] adapters;
    }

    struct FormattedOffer {
        uint256[] amounts;
        address[] adapters;
        address[] path;
        uint256 gasEstimate;
    }

    function swapNoSplit(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external;

    function findBestPath(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut,
        uint256 _maxSteps
    ) external view returns (FormattedOffer memory);
}