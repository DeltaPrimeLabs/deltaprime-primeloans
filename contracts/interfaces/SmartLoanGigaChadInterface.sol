// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "./facets/IYieldYakFacet.sol";
import "./facets/IPangolinDEXFacet.sol";
import "./facets/IAssetsOperationsFacet.sol";
import "./facets/IOwnershipFacet.sol";
import "./facets/ISmartLoanViewFacet.sol";
import "./facets/ISmartLoanLiquidationFacet.sol";
import "./facets/ISolvencyFacet.sol";
import "./facets/IUbeswapDEXFacet.sol";

interface SmartLoanGigaChadInterface is IPangolinDEXFacet, IAssetsOperationsFacet, IOwnershipFacet, ISmartLoanLiquidationFacet, ISmartLoanViewFacet, ISolvencyFacet, IYieldYakFacet, IUbeswapDEXFacet {

}
