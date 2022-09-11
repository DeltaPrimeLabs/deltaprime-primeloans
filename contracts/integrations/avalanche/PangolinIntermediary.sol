// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "../UniswapV2Intermediary.sol";

/**
 * @title PangolinIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the Pangolin DEX
 */
contract PangolinIntermediary is UniswapV2Intermediary {

    function getNativeTokenAddress() override internal view returns (address) {
        return 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    }
}