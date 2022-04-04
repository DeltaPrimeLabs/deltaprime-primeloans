// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../lib/Bytes32EnumerableMap.sol";
import "../interfaces/IDPIntegration.sol";

contract PangolinIntegrationV1 is OwnableUpgradeable, ReentrancyGuardUpgradeable, IDPIntegration{
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using TransferHelper for address payable;
    using TransferHelper for address;

    EnumerableMap.Bytes32ToAddressMap internal swapSupportedAssets;
    EnumerableMap.Bytes32ToAddressMap internal stakingSupportedAssets;
    EnumerableMap.Bytes32ToAddressMap internal lpSupportedAssets;

    IPangolinRouter pangolinRouter;

    bytes32 constant private integrationID = "PANGOLINV1";
    address private constant WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

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

    receive() external payable {}

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

    // UPDATE ASSETS

    function _updateAssets(EnumerableMap.Bytes32ToAddressMap storage map, Asset[] memory _assets) internal {
        if(_assets.length > 0) {
            for (uint256 i = 0; i < _assets.length; i++) {
                require(_assets[i].asset != "", "Cannot set an empty string asset.");
                require(_assets[i].assetAddress != address(0), "Cannot set an empty address.");

                EnumerableMap.set(map, _assets[i].asset, _assets[i].assetAddress);
            }

            emit AssetsAdded(_assets);
        }
    }

    function updateSwapSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(swapSupportedAssets, _assets);
    }

    function updateLPSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(lpSupportedAssets, _assets);
    }

    function updateStakingSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(stakingSupportedAssets, _assets);
    }

    // REMOVE ASSETS

    function _removeAssets(EnumerableMap.Bytes32ToAddressMap storage map, bytes32[] calldata _assets) internal {
        for (uint256 i = 0; i < _assets.length; i++) {
            EnumerableMap.remove(map, _assets[i]);
        }
        emit AssetsRemoved(_assets);
    }

    function removeSwapSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(swapSupportedAssets, _assets);
    }

    function removeLPSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(lpSupportedAssets, _assets);
    }

    function removeStakingSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(stakingSupportedAssets, _assets);
    }

    // GET ASSETS

    function getSwapSupportedAssets() external view override returns (bytes32[] memory result) {
        return swapSupportedAssets._inner._keys._inner._values;
    }

    function getLPSupportedAssets() external view override returns (bytes32[] memory result) {
        return lpSupportedAssets._inner._keys._inner._values;
    }

    function getStakingSupportedAssets() external view override returns (bytes32[] memory result) {
        return stakingSupportedAssets._inner._keys._inner._values;
    }

    // ADDITIONAL METHODS
    function isActionSupported(supportedActions _action) override external view returns(bool) {
        if (_action == supportedActions.BUY || _action == supportedActions.SELL) {
            return swapSupportedAssets.length() > 0;
        } else if (_action == supportedActions.STAKE || _action == supportedActions.UNSTAKE) {
            return stakingSupportedAssets.length() > 0;
        } else if (_action == supportedActions.ADD_LIQUIDITY || _action == supportedActions.REMOVE_LIQUIDITY) {
            return lpSupportedAssets.length() > 0;
        }
        return false;
    }

    function getSwapAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(swapSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function getLPAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(lpSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function getStakingAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(stakingSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function getEstimatedAVAXForERC20Token(uint256 _exactAmountOut, address _token) public view returns (uint256) {
        address[] memory path = getPathForAVAXtoToken(_token);
        return pangolinRouter.getAmountsIn(_exactAmountOut, path)[0];
    }

    function getMinimumERC20TokenAmountForExactAVAX(bytes32 _asset, uint256 targetAVAXAmount) override public returns(uint256){
        address[] memory path = getPathForTokenToAVAX(getSwapAssetAddress(_asset));

        return pangolinRouter.getAmountsIn(targetAVAXAmount, path)[0];
    }

    function getPathForTokenToAVAX(address _token) private pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = WAVAX_ADDRESS;
        return path;
    }

    function getPathForAVAXtoToken(address _token) private pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = WAVAX_ADDRESS;
        path[1] = _token;
        return path;
    }

    // EVENTS

    event TokenPurchase(address indexed buyer, uint256 amount, uint256 timestamp, bool success);

    event TokenSell(address indexed seller, uint256 amount, uint256 timestamp, bool success);

    event AssetsRemoved(bytes32[] removedAssets);

    event AssetsAdded(Asset[] assets);
}
