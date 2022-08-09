// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./lib/Bytes32EnumerableMap.sol";
import "./lib/SmartLoanLib.sol";
import "./PoolManager.sol";

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

  // TODO: Check if the below comment is still valid
  // first supportedAsset must be a blockchain native currency
  function initialize(address _pangolinRouter, IAssetsExchange.Asset[] memory supportedAssets) external initializer {
    pangolinRouter = IPangolinRouter(_pangolinRouter);

    _updateAssets(supportedAssets);
    __Ownable_init();
    __ReentrancyGuard_init();
  }

  /*
   * Swaps selected ERC20 token with other ERC20 token
   * @dev soldToken_ sold ERC20 token's symbol
   * @dev boughtToken_ bought ERC20 token's symbol
   * @dev _exactSold exact amount of ERC20 token to be sold
   * @dev _minimumBought minimum amount of ERC20 token to be bought
   **/
  function swap(bytes32 soldToken_, bytes32 boughtToken_, uint256 _exactSold, uint256 _minimumBought) external override nonReentrant returns (uint256[] memory amounts) {
    require(_exactSold > 0, "Amount of tokens to sell has to be greater than 0");

    address soldTokenAddress = getAssetAddress(soldToken_);
    address boughtTokenAddress = getAssetAddress(boughtToken_);

    IERC20 soldToken = IERC20(soldTokenAddress);
    IERC20 boughtToken = IERC20(boughtTokenAddress);

    address(soldToken).safeApprove(address(pangolinRouter), 0);
    address(soldToken).safeApprove(address(pangolinRouter), _exactSold);

    if (_minimumBought > 0) {
      require(_exactSold >= getEstimatedTokensForTokens(_minimumBought, soldTokenAddress, boughtTokenAddress), "Not enough funds were provided");
    }

    (bool success, bytes memory result) = address(pangolinRouter).call{value: 0}(
      abi.encodeWithSignature("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
      _exactSold, _minimumBought, getPath(soldTokenAddress, boughtTokenAddress), msg.sender, block.timestamp)
    );

    require(success, "Pangolin swap was unsuccessful.");

    amounts = abi.decode(result, (uint256[]));

    address(soldToken).safeTransfer(msg.sender, soldToken.balanceOf(address(this)));

    emit TokenSwap(msg.sender, soldToken_, boughtToken_, amounts[0], amounts[amounts.length - 1], block.timestamp);

    return amounts;
  }

  /**
   * Adds or updates supported assets
   * @dev _assets assets to be added or updated
   **/
  function _updateAssets(Asset[] memory _assets) internal {
    PoolManager poolManager = SmartLoanLib.getPoolManager();
    for (uint256 i = 0; i < _assets.length; i++) {
      require(poolManager.getAssetAddress(_assets[i].asset) == _assets[i].assetAddress, "Asset address mismatch");
      require(_assets[i].asset != "", "Cannot set an empty string asset.");
      require(_assets[i].assetAddress != address(0), "Cannot set an empty address.");

      supportedAssetsMap.set(_assets[i].asset, _assets[i].assetAddress);
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
  function getAllSupportedAssets() public override view returns (bytes32[] memory result) {
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
   * Returns the minimum _soldToken amount that is required to be sold to receive _exactAmountOut of a _boughtToken.
   **/
  function getEstimatedTokensForTokens(uint256 _exactAmountOut, address _soldToken, address _boughtToken) public view override returns (uint256) {
    address[] memory path = getPath(_soldToken, _boughtToken);

    return pangolinRouter.getAmountsIn(_exactAmountOut, path)[0];
  }

  /**
   * Returns the maximum _boughtToken amount that will be obtained in the event of selling _amountIn of _soldToken token.
   **/
  function getEstimatedTokensFromTokens(uint256 _amountIn, address _soldToken, address _boughtToken) public view override returns (uint256) {
    address[] memory path = getPath(_soldToken, _boughtToken);

    return pangolinRouter.getAmountsOut(_amountIn, path)[1];
  }

  /**
   * Returns a path containing tokens' addresses
   * @dev _token ERC20 token's address
   **/
  function getPath(address _token1, address _token2) private view returns (address[] memory) {
    address[] memory path;
    address nativeTokenAddress = getAssetAddress(bytes32("AVAX"));

    if (_token1 != nativeTokenAddress && _token2 != nativeTokenAddress) {
      path = new address[](3);
      path[0] = _token1;
      path[1] = nativeTokenAddress;
      path[2] = _token2;
    } else {
      path = new address[](2);
      path[0] = _token1;
      path[1] = _token2;
    }

    return path;
  }

  /* ========== EVENTS ========== */

  /**
   * @dev emitted after a tokens were sold
   * @param seller the address which sold tokens
   * @param soldToken the name of sold token
   * @param boughtToken the name of bought token
   * @param amountSold the amount of token sold
   * @param amountBought the amount of token bought
   **/
  event TokenSwap(address indexed seller, bytes32 soldToken, bytes32 boughtToken, uint256 amountSold, uint256 amountBought, uint256 timestamp);

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