// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IAssetExchange
 * @dev Basic interface for investing into assets
 * It could be linked either to DEX or to a synthetic assets platform
 */
interface IAssetsExchange {
  /**
   * For adding supported assets
   **/
  struct Asset {
    bytes32 asset;
    address assetAddress;
  }


  /*
   * Swaps selected ERC20 token with other ERC20 token
   * @dev soldToken_ sold ERC20 token's symbol
   * @dev boughtToken_ bought ERC20 token's symbol
   * @dev _amountSold exact amount of ERC20 token to be sold
   * @dev _amountBought minimum amount of ERC20 token to be bought
   **/
  function swap(bytes32 soldToken_, bytes32 boughtToken_, uint256 _exactAmountIn, uint256 _minAmountOut) external returns (uint256[] memory);

  /**
   * Returns the minimum _soldToken amount that is required to be sold to receive _exactAmountOut of a _boughtToken.
   **/
  function getEstimatedTokensFromTokens(uint256 _exactAmountOut, address _soldToken, address _boughtToken) external returns (uint256);

  /**
   * Returns the maximum _boughtToken amount that will be obtained in the event of selling _amountIn of _soldToken token.
   **/
  function getEstimatedTokensForTokens(uint256 _amountIn, address _soldToken, address _boughtToken) external returns (uint256);

  /**
   * Adds or updates supported assets
   * First asset must be a blockchain native currency
   * @dev _assets assets to be added or updated
   **/
  function updateAssets(Asset[] memory _assets) external;

  /**
   * Removes supported assets
   * @dev _assets assets to be removed
   **/
  function removeAssets(bytes32[] calldata _assets) external;

  /**
   * Returns all the supported assets keys
   **/
  function getAllAssets() external view returns (bytes32[] memory);

  /**
   * Returns address of an asset
   **/
  function getAssetAddress(bytes32 _asset) external view returns (address);
}
