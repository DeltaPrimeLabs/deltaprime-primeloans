// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "../../UniswapV2Exchange.sol";

/**
 * @title UbeswapExchange
 * @dev Contract allows user to invest into an ERC20 token
 * This implementation uses the Ubeswap DEX
 */
contract UbeswapExchange is UniswapV2Exchange {

  /**
   * Returns a path containing tokens' addresses
   * @dev _token ERC20 token's address
   **/
  function getPath(address _token1, address _token2) internal override view returns (address[] memory) {
    address[] memory path;
    path = new address[](2);
    path[0] = _token1;
    path[1] = _token2;

    return path;
  }

  function getNativeTokenSymbol() override internal view returns (bytes32) {
    return "CELO";
  }
}