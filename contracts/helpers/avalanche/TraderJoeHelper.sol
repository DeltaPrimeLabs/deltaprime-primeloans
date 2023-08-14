// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./DexHelper.sol";

contract TraderJoeHelper is DexHelper {
    /**
     * Returns address of UniswapV2-like exchange
     **/
    function getExchangeIntermediaryContract() public override pure returns (address) {
        return 0x4eEcb72b47a32786e08581D6226e95d9AE3bB1Af;
    }
}
