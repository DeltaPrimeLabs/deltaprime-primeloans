// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";
import "@redstone-finance/evm-connector/contracts/mocks/RedstoneConsumerNumericMock.sol";

contract RSOracleMock3Signers is RedstoneConsumerNumericMock {
    uint256 constant DEFAULT_MAX_DATA_TIMESTAMP_DELAY_SECONDS = 15 minutes; // Test sometimes be slow

    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        return 3;
    }
}
