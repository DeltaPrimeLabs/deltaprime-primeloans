// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../integrations/DPIntegration.sol";
import "../lib/Bytes32EnumerableMap.sol";
import "../interfaces/IDPIntegration.sol";

contract PangolinIntegrationV1 is OwnableUpgradeable, ReentrancyGuardUpgradeable, DPIntegration {
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using TransferHelper for address payable;
    using TransferHelper for address;
    IPangolinRouter pangolinRouter;

    bytes32 constant private integrationID = "PANGOLINV1";

    function initialize(address _pangolinRouter, Asset[] memory _swapSupportedAssets, Asset[] memory _stakingSupportedAssets, Asset[] memory _lpSupportedAssets) external initializer {
        pangolinRouter = IPangolinRouter(_pangolinRouter);
        _updateAssets(swapSupportedAssets, _swapSupportedAssets);
        _updateAssets(lpSupportedAssets, _lpSupportedAssets);
        _updateAssets(stakingSupportedAssets, _stakingSupportedAssets);

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function getIntegrationID() external override pure returns(bytes32) {
        return integrationID;
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function buy(bytes32 _asset, uint256 _exactERC20AmountOut, address recipient) external payable override nonReentrant returns (bool) {
        require(_exactERC20AmountOut != 0, "Amount of tokens to buy has to be greater than 0");
        address tokenAddress = getSwapAssetAddress(_asset);
        uint256 amountIn = getEstimatedAVAXForERC20Token(_exactERC20AmountOut, tokenAddress);
        require(msg.value >= amountIn, "Not enough funds were provided");

        address[] memory path = getPathForAVAXtoToken(tokenAddress);
        (bool success, ) = address(pangolinRouter).call{value: msg.value}(
            abi.encodeWithSignature("swapAVAXForExactTokens(uint256,address[],address,uint256)", _exactERC20AmountOut, path, recipient, block.timestamp)
        );

        payable(recipient).safeTransferETH(address(this).balance);
        emit TokenPurchase(recipient, _exactERC20AmountOut, block.timestamp, success);
        return success;
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function sell(bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut, address recipient) external override nonReentrant returns (bool) {
        require(_exactERC20AmountIn > 0, "Amount of tokens to sell has to be greater than 0");

        address tokenAddress = getSwapAssetAddress(_asset);
        IERC20 token = IERC20(tokenAddress);
        address(token).safeApprove(address(pangolinRouter), 0);
        address(token).safeApprove(address(pangolinRouter), _exactERC20AmountIn);

        (bool success, ) = address(pangolinRouter).call{value: 0}(
            abi.encodeWithSignature("swapExactTokensForAVAX(uint256,uint256,address[],address,uint256)", _exactERC20AmountIn, _minAvaxAmountOut, getPathForTokenToAVAX(tokenAddress), recipient, block.timestamp)
        );

        if (!success) {
            address(token).safeTransfer(recipient, token.balanceOf(address(this)));
            return false;
        }
        payable(recipient).safeTransferETH(address(this).balance);
        emit TokenSell(recipient, _exactERC20AmountIn, block.timestamp, success);
        return true;
    }


    // INTEGRATION-SPECIFIC METHODS
    function getEstimatedAVAXForERC20Token(uint256 _exactAmountOut, address _token) public view returns (uint256) {
        address[] memory path = getPathForAVAXtoToken(_token);
        return pangolinRouter.getAmountsIn(_exactAmountOut, path)[0];
    }

    function getMinimumERC20TokenAmountForExactAVAX(bytes32 _asset, uint256 targetAVAXAmount) override public returns(uint256){
        address[] memory path = getPathForTokenToAVAX(getSwapAssetAddress(_asset));

        return pangolinRouter.getAmountsIn(targetAVAXAmount, path)[0];
    }
}
