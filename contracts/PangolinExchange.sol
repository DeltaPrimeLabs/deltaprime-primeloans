// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./lib/Bytes32EnumerableMap.sol";

/**
 * @title PangolinExchange
 * @dev Contract allows user to invest into an ERC20 token
 * This implementation uses the Pangolin DEX
 */
contract PangolinExchange is OwnableUpgradeable, IAssetsExchange, ReentrancyGuardUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  /* ========= STATE VARIABLES ========= */
  IPangolinRouter pangolinRouter;

  using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
  EnumerableMap.Bytes32ToAddressMap private supportedAssetsMap;

  address private constant WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

  function initialize(address _pangolinRouter, Asset[] memory supportedAssets) external initializer {
    pangolinRouter = IPangolinRouter(_pangolinRouter);
    _updateAssets(supportedAssets);
    __Ownable_init();
    __ReentrancyGuard_init();
  }

  /**
   * Buys selected ERC20 token with AVAX using the Pangolin DEX
   * Refunds unused AVAX to the msg.sender
   * @dev _token ERC20 token's address
   * @dev _exactERC20AmountOut amount of the ERC20 token to be bought
   **/
  function buyAsset(bytes32 _token, uint256 _exactERC20AmountOut) external payable override nonReentrant returns (bool) {
    if (_exactERC20AmountOut == 0) revert InvalidTokenPurchaseAmount();
    address tokenAddress = getAssetAddress(_token);
    uint256 amountIn = getEstimatedAVAXForERC20Token(_exactERC20AmountOut, tokenAddress);
    if (msg.value < amountIn) revert NotEnoughFunds();

    address[] memory path = getPathForAVAXtoToken(tokenAddress);
    (bool success, ) = address(pangolinRouter).call{value: msg.value}(
      abi.encodeWithSignature("swapAVAXForExactTokens(uint256,address[],address,uint256)", _exactERC20AmountOut, path, msg.sender, block.timestamp)
    );

    payable(msg.sender).safeTransferETH(address(this).balance);
    emit TokenPurchase(msg.sender, _exactERC20AmountOut, block.timestamp, success);
    return success;
  }

  /**
   * Sells selected ERC20 token for AVAX
   * @dev _token ERC20 token's address
   * @dev _exactERC20AmountIn amount of the ERC20 token to be sold
   * @dev _minAvaxAmountOut minimum amount of the AVAX token to be bought
   **/
  function sellAsset(bytes32 _token, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut) external override nonReentrant returns (bool) {
    if (_exactERC20AmountIn == 0) revert InvalidTokenSaleAmount();

    address tokenAddress = getAssetAddress(_token);
    IERC20 token = IERC20(tokenAddress);
    token.approve(address(pangolinRouter), _exactERC20AmountIn);

    (bool success, ) = address(pangolinRouter).call{value: 0}(
      abi.encodeWithSignature("swapExactTokensForAVAX(uint256,uint256,address[],address,uint256)", _exactERC20AmountIn, _minAvaxAmountOut, getPathForTokenToAVAX(tokenAddress), msg.sender, block.timestamp)
    );

    if (!success) {
      address(token).safeTransfer(msg.sender, token.balanceOf(address(this)));
      return false;
    }
    payable(msg.sender).safeTransferETH(address(this).balance);
    emit TokenSell(msg.sender, _exactERC20AmountIn, block.timestamp, success);
    return true;
  }

  /**
   * Adds or updates supported assets
   * @dev _assets assets to be added or updated
   **/
  function _updateAssets(Asset[] memory _assets) internal {
    for (uint256 i = 0; i < _assets.length; i++) {
      require(_assets[i].asset != "", "Cannot set an empty string asset.");
      require(_assets[i].assetAddress != address(0), "Cannot set an empty address.");

      EnumerableMap.set(supportedAssetsMap, _assets[i].asset, _assets[i].assetAddress);
    }

    emit AssetsAdded(_assets);
  }

  /**
   * Adds or updates supported assets
   * @dev _assets assets to be added/updated
   **/
  function updateAssets(Asset[] memory _assets) external override onlyOwner {
    _updateAssets(_assets);
  }

  /**
   * Removes supported assets
   * @dev _assets assets to be removed
   **/
  function removeAssets(bytes32[] calldata _assets) external override onlyOwner {
    for (uint256 i = 0; i < _assets.length; i++) {
      EnumerableMap.remove(supportedAssetsMap, _assets[i]);
    }

    emit AssetsRemoved(_assets);
  }

  /**
   * Returns all the supported assets keys
   **/
  function getAllAssets() external view override returns (bytes32[] memory result) {
    return supportedAssetsMap._inner._keys._inner._values;
  }

  /**
   * Returns address of an asset
   **/
  function getAssetAddress(bytes32 _asset) public view override returns (address) {
    (, address assetAddress) = EnumerableMap.tryGet(supportedAssetsMap, _asset);
    require(assetAddress != address(0), "Asset not supported.");

    return assetAddress;
  }

  /* ========== RECEIVE AVAX FUNCTION ========== */
  receive() external payable {}

  /* ========== VIEW FUNCTIONS ========== */

  // Initial audit comment: Three below functions can in theory fail if there would be no liquidity at DEX but in this case
  // we can just remove a given asset from supported assets or change all calls to the below functions to an external .call
  // and handle a failure in our code. It is yet to be decided upon.

  /**
   * Returns the minimum token amount that is required to be sold to receive _exactAmountOut of AVAX.
   **/
  function getMinimumERC20TokenAmountForExactAVAX(uint256 _exactAmountOut, address _token) public view override returns (uint256) {
    address[] memory path = getPathForTokenToAVAX(_token);

    return pangolinRouter.getAmountsIn(_exactAmountOut, path)[0];
  }

  /**
   * Returns the minimum AVAX amount that is required to buy _exactAmountOut of _token ERC20 token.
   **/
  function getEstimatedAVAXForERC20Token(uint256 _exactAmountOut, address _token) public view returns (uint256) {
    address[] memory path = getPathForAVAXtoToken(_token);

    return pangolinRouter.getAmountsIn(_exactAmountOut, path)[0];
  }

  /**
   * Returns the maximum AVAX amount that will be obtained in the event of selling _amountIn of _token ERC20 token.
   **/
  function getEstimatedAVAXFromERC20Token(uint256 _amountIn, address _token) public view override returns (uint256) {
    address[] memory path = getPathForTokenToAVAX(_token);

    return pangolinRouter.getAmountsOut(_amountIn, path)[1];
  }

  /**
   * Returns a path containing WAVAX token's address and chosen ERC20 token's address
   * @dev _token ERC20 token's address
   **/
  function getPathForAVAXtoToken(address _token) private view returns (address[] memory) {
    address[] memory path = new address[](2);
    path[0] = WAVAX_ADDRESS;
    path[1] = _token;
    return path;
  }

  /**
   * Returns a path containing chosen ERC20 token's address and WAVAX token's address
   * @dev _token ERC20 token's address
   **/
  function getPathForTokenToAVAX(address _token) private view returns (address[] memory) {
    address[] memory path = new address[](2);
    path[0] = _token;
    path[1] = WAVAX_ADDRESS;
    return path;
  }

  /* ========== EVENTS ========== */

  /**
   * @dev emitted after a tokens were purchased
   * @param buyer the address which bought tokens
   * @param amount the amount of token bought
   **/
  event TokenPurchase(address indexed buyer, uint256 amount, uint256 timestamp, bool success);

  /**
   * @dev emitted after a tokens were sold
   * @param seller the address which sold tokens
   * @param amount the amount of token sold
   **/
  event TokenSell(address indexed seller, uint256 amount, uint256 timestamp, bool success);

  /* ========== EVENTS ========== */

  /**
   * @dev emitted after the owner adds/updates assets
   * @param assets added/updated assets
   **/
  event AssetsAdded(Asset[] assets);

  /**
   * @dev emitted after the owner removes assets
   * @param removedAssets removed assets
   **/
  event AssetsRemoved(bytes32[] removedAssets);
}

/// Amount of tokens to buy has to be greater than 0
error InvalidTokenPurchaseAmount();

/// Amount of tokens to sell has to be greater than 0
error InvalidTokenSaleAmount();

/// Not enough funds were provided
error NotEnoughFunds();
