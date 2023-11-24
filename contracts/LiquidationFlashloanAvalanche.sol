// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ee4563a71297f0f328d0fdc7e9b90958b41dd0bc;
pragma solidity 0.8.17;

import "./LiquidationFlashloan.sol";

contract LiquidationFlashloanAvalanche is LiquidationFlashloan {
    constructor(
        address _addressProvider,
        address _wrappedNativeToken,
        SmartLoanLiquidationFacet _whitelistedLiquidatorsContract
    )
        LiquidationFlashloan(
        _addressProvider,
        _wrappedNativeToken,
        _whitelistedLiquidatorsContract
        )
    {}

    function YY_ROUTER() internal pure override returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }
}
