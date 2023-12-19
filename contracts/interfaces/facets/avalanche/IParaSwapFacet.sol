// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./IParaSwapRouter.sol";

interface IParaSwapFacet {
    function paraSwap(IParaSwapRouter.SimpleData memory data) external;

    function paraSwapV2(bytes4 selector, bytes memory data, address fromToken, uint256 fromAmount, address toToken, uint256 minOut) external;
}