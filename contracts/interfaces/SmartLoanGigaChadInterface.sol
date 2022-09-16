// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

import "./facets/avalanche/IYieldYakFacet.sol";
import "./facets/avalanche/IPangolinDEXFacet.sol";
import "./facets/avalanche/ITraderJoeDEXFacet.sol";
import "./facets/IAssetsOperationsFacet.sol";
import "./facets/IOwnershipFacet.sol";
import "./facets/ISmartLoanViewFacet.sol";
import "./facets/ISmartLoanLiquidationFacet.sol";
import "./facets/ISmartLoanWrappedNativeTokenFacet.sol";
import "./facets/ISolvencyFacet.sol";
import "./facets/celo/IUbeswapDEXFacet.sol";

interface SmartLoanGigaChadInterface is ISmartLoanWrappedNativeTokenFacet, IPangolinDEXFacet, IAssetsOperationsFacet, IOwnershipFacet, ISmartLoanLiquidationFacet, ISmartLoanViewFacet, ISolvencyFacet, IYieldYakFacet, IUbeswapDEXFacet, ITraderJoeDEXFacet {

}
