// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f63ef97516096bbd3db42914b6554a461f90ef40;
pragma solidity 0.8.17;

import "../UniswapV2Intermediary.sol";
import "../../lib/avalanche/DeploymentConstants.sol";

/**
 * @title PangolinIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the Pangolin DEX
 */
contract PangolinIntermediary is UniswapV2Intermediary {

    function getNativeTokenAddress() override internal pure returns (address) {
        return DeploymentConstants.getNativeToken();
    }
}