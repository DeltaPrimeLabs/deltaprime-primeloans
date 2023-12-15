// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/mocks/AuthorisedMockSignersBase.sol";

import "../DustConverter.sol";
import "hardhat/console.sol";

contract DustConverterMock is DustConverter, AuthorisedMockSignersBase {
    uint256 constant DEFAULT_MAX_DATA_TIMESTAMP_DELAY_SECONDS = 15 minutes; // Test sometimes be slow

    uint256 internal constant MIN_TIMESTAMP_MILLISECONDS = 1654353400000;

    error TimestampIsNotValid();

    constructor(address smartLoanFactory_, AssetInfo memory targetAsset_)
        DustConverter(smartLoanFactory_, targetAsset_)
    {}

    function getAuthorisedSignerIndex(address signerAddress)
        public
        view
        virtual
        override
        returns (uint8)
    {
        return getAuthorisedMockSignerIndex(signerAddress);
    }

    function validateTimestamp(uint256 receivedTimestampMilliseconds) public view virtual override {
        if (receivedTimestampMilliseconds < MIN_TIMESTAMP_MILLISECONDS) {
            revert TimestampIsNotValid();
        }
    }
}
