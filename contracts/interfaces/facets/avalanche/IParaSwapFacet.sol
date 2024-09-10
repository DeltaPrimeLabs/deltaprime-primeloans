// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

interface IParaSwapFacet {
    function paraSwapV2(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 minOut
    ) external;

    function paraSwapBeforeLiquidation(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 minOut
    ) external;
}
