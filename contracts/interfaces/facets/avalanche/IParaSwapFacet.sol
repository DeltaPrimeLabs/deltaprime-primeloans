// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./IParaSwapRouter.sol";

interface IParaSwapFacet {
    function paraSwap(IParaSwapRouter.SimpleData memory data) external;
}