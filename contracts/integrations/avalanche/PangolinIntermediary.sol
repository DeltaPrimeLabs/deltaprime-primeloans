// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "../UniswapV2Intermediary.sol";

/**
 * @title PangolinIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the Pangolin DEX
 */
contract PangolinIntermediary is UniswapV2Intermediary {

  function getNativeTokenSymbol() override internal view returns (bytes32) {
    return "AVAX";
  }
}