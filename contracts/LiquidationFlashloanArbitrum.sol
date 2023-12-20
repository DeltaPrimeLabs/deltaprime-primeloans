// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 45126f9871a0b0c791003e8113e97cf0dbed52e4;
pragma solidity 0.8.17;

import "./LiquidationFlashloan.sol";

contract LiquidationFlashloanArbitrum is LiquidationFlashloan {
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
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
