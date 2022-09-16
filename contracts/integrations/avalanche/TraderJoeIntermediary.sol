// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.17;

import "../UniswapV2Intermediary.sol";
import "../../lib/local/DeploymentConstants.sol";

/**
 * @title TraderJoeIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the TraderJoe DEX
 */
contract TraderJoeIntermediary is UniswapV2Intermediary {

    function getNativeTokenAddress() override internal view returns (address) {
        return DeploymentConstants.getNativeToken();
    }
}