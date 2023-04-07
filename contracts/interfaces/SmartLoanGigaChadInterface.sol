// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "./facets/avalanche/IYieldYakFacet.sol";
import "./facets/avalanche/IGMDFacet.sol";
import "./facets/avalanche/IYieldYakSwapFacet.sol";
import "./facets/avalanche/IGLPFacet.sol";
import "./facets/avalanche/IPangolinDEXFacet.sol";
import "./facets/avalanche/ITraderJoeDEXFacet.sol";
import "./facets/IUniswapV2DEXFacet.sol";
import "./facets/IAssetsOperationsFacet.sol";
import "./facets/IOwnershipFacet.sol";
import "./facets/ISmartLoanViewFacet.sol";
import "./facets/ISmartLoanLiquidationFacet.sol";
import "./facets/ISmartLoanWrappedNativeTokenFacet.sol";
import "./facets/ISolvencyFacetProd.sol";
import "./facets/IHealthMeterFacetProd.sol";
import "./IDiamondLoupe.sol";
import "./facets/celo/IUbeswapDEXFacet.sol";
import "./facets/avalanche/IVectorFinanceFacet.sol";
import "./facets/avalanche/IVectorFinanceFacetOld.sol";
import "./facets/avalanche/IBeefyFinanceFacet.sol";
import "./facets/avalanche/ICurveFacet.sol";
import "./facets/avalanche/ISteakHutFinanceFacet.sol";

interface SmartLoanGigaChadInterface is IGMDFacet, IHealthMeterFacetProd, IGLPFacet, IYieldYakSwapFacet, IDiamondLoupe, IBeefyFinanceFacet, ISmartLoanWrappedNativeTokenFacet, IPangolinDEXFacet, IUniswapV2DEXFacet, IAssetsOperationsFacet, IOwnershipFacet, ISmartLoanLiquidationFacet, ISmartLoanViewFacet, ISolvencyFacetProd, IYieldYakFacet, IVectorFinanceFacet, IVectorFinanceFacetOld, IUbeswapDEXFacet, ITraderJoeDEXFacet, ICurveFacet, ISteakHutFinanceFacet {

}
