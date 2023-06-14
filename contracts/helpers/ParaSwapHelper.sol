// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e9e05b6e564514c1bcd1b5e49f5e45250e72bf98;
pragma solidity 0.8.17;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../interfaces/facets/avalanche/IParaSwapRouter.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {SwapHelper} from "./SwapHelper.sol";

contract ParaSwapHelper is SwapHelper {
    using TransferHelper for address;

    address private constant PARA_TRANSFER_PROXY = 0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    function _paraSwap(IParaSwapRouter.SimpleData memory data) internal returns (uint256) {
        SwapTokensDetails memory swapTokensDetails = _getInitialTokensDetails(data.fromToken, data.toToken);

        uint256 amount = Math.min(swapTokensDetails.soldToken.balanceOf(address(this)), data.fromAmount);
        require(amount > 0, "Amount of tokens to sell has to be greater than 0");

        address(swapTokensDetails.soldToken).safeApprove(PARA_TRANSFER_PROXY, 0);
        address(swapTokensDetails.soldToken).safeApprove(PARA_TRANSFER_PROXY, amount);

        IParaSwapRouter router = IParaSwapRouter(PARA_ROUTER);

        router.simpleSwap(data);

        // Add asset to ownedAssets
        if (swapTokensDetails.boughtToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(swapTokensDetails.tokenBoughtSymbol, address(swapTokensDetails.boughtToken));
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if (swapTokensDetails.soldToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(swapTokensDetails.tokenSoldSymbol);
        }

        uint256 boughtTokenFinalAmount = swapTokensDetails.boughtToken.balanceOf(address(this)) - swapTokensDetails.initialBoughtTokenBalance;

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
