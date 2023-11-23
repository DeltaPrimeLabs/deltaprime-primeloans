// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 6685d23f65961b7e5a0dbbbb475e15987fb1954f;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";
import "../SmartLoanLiquidationFacet.sol";

contract AssetsOperationsAvalancheFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }

    function processYieldYakPTPRefundBeforeLiquidation() external onlyWhitelistedLiquidators {
        DiamondStorageLib.addOwnedAsset("sAVAX", 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE);
        DiamondStorageLib.removeOwnedAsset("YY_PTP_sAVAX");
    }


    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }
}
