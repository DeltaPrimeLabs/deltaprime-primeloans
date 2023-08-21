// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./DexHelper.sol";

contract PangolinHelper is DexHelper {
    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override pure returns (address) {
        return 0xdB5D94B8Ed491B058F3e74D029775A14477cF7fA;
    }
}
