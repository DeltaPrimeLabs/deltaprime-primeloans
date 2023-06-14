// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../interfaces/facets/avalanche/IYieldYakRouter.sol";
import {SwapHelper} from "./SwapHelper.sol";

contract YieldYakSwapHelper is SwapHelper {
    using TransferHelper for address;

    address private constant YY_ROUTER = 0xC4729E56b831d74bBc18797e0e17A295fA77488c;

    function _yakSwap(uint256 _amountIn, uint256 _amountOut, address[] memory _path, address[] memory _adapters) internal returns (uint256) {
        SwapTokensDetails memory swapTokensDetails = _getInitialTokensDetails(_path[0], _path[_path.length - 1]);

        _amountIn = Math.min(swapTokensDetails.soldToken.balanceOf(address(this)), _amountIn);
        require(_amountIn > 0, "Amount of tokens to sell has to be greater than 0");

        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER, 0);
        address(swapTokensDetails.soldToken).safeApprove(YY_ROUTER, _amountIn);

        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER);

        IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
            amountIn: _amountIn,
            amountOut: _amountOut,
            path: _path,
            adapters: _adapters
        });

        router.swapNoSplit(trade, address(this), 0);

        // Add asset to ownedAssets
        if (swapTokensDetails.boughtToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(swapTokensDetails.tokenBoughtSymbol, address(swapTokensDetails.boughtToken));
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if (swapTokensDetails.soldToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(swapTokensDetails.tokenSoldSymbol);
        }

        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(address(this)) - swapTokensDetails.initialBoughtTokenBalance;
        require(boughtTokenFinalAmount >= _amountOut, "Insufficient output amount");

        emit Swap(
            msg.sender,
            swapTokensDetails.tokenSoldSymbol,
            swapTokensDetails.tokenBoughtSymbol,
            swapTokensDetails.initialSoldTokenBalance - swapTokensDetails.soldToken.balanceOf(address(this)),
            boughtTokenFinalAmount,
            block.timestamp
        );

        return boughtTokenFinalAmount;
    }
}