// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IAssetsExchange.sol";
import "./lib/Bytes32EnumerableMap.sol";
import "./lib/SmartLoanLib.sol";
import "./PoolManager.sol";

/**
 * @title UniswapV2Exchange
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation supports UniswapV2Exchange-like DEXs
 */
contract UniswapV2Exchange is OwnableUpgradeable, IAssetsExchange, ReentrancyGuardUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  /* ========= STATE VARIABLES ========= */
  IUniswapV2Router01 router;

  using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
  EnumerableMap.Bytes32ToAddressMap private supportedAssetsMap;

  function initialize(address _router, Asset[] memory supportedAssets) external initializer {
    router = IUniswapV2Router01(_router);

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

    address(soldToken).safeApprove(address(router), 0);
    address(soldToken).safeApprove(address(router), _exactSold);

    if (_minimumBought > 0) {
      require(_exactSold >= getEstimatedTokensForTokens(_minimumBought, soldTokenAddress, boughtTokenAddress), "Not enough funds were provided");
    }

    (bool success, bytes memory result) = address(router).call{value: 0}(
      abi.encodeWithSignature("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
      _exactSold, _minimumBought, getPath(soldTokenAddress, boughtTokenAddress), msg.sender, block.timestamp)
    );

    require(success, "Swap was unsuccessful.");

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
      require(_assets[i].asset != "", "Cannot set an empty string asset.");
      require(_assets[i].assetAddress != address(0), "Cannot set an empty address.");
      require(poolManager.getAssetAddress(_assets[i].asset) == _assets[i].assetAddress, "Asset address mismatch");

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

    return router.getAmountsIn(_exactAmountOut, path)[0];
  }

  /**
   * Returns the maximum _boughtToken amount that will be obtained in the event of selling _amountIn of _soldToken token.
   **/
  function getEstimatedTokensFromTokens(uint256 _amountIn, address _soldToken, address _boughtToken) public view override returns (uint256) {
    address[] memory path = getPath(_soldToken, _boughtToken);

    return router.getAmountsOut(_amountIn, path)[1];
  }

  /**
   * Returns a path containing tokens' addresses
   * @dev _token ERC20 token's address
   **/
  function getPath(address _token1, address _token2) internal virtual view returns (address[] memory) {
    address[] memory path;
    address nativeTokenAddress = getAssetAddress(getNativeTokenSymbol());

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

  function getNativeTokenSymbol() virtual internal view returns (bytes32) {
    return "ETH";
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