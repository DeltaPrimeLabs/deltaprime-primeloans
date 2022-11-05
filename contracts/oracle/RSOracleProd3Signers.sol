// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";

contract RSOracleProd3Signers is AvalancheDataServiceConsumerBase {
    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        return 3;
    }
}
