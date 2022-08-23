pragma solidity ^0.8.4;

import "./faucets/IYieldYakFacet.sol";
import "./faucets/IPangolinDEXFacet.sol";
import "./faucets/IAssetsOperationsFacet.sol";
import "./faucets/IOwnershipFacet.sol";
import "./faucets/ISmartLoanLogicFacet.sol";
import "./faucets/ISmartLoanLiquidationFacet.sol";
import "./faucets/ISolvencyFacet.sol";
import "./faucets/IUbeswapDEXFacet.sol";

interface SmartLoanGigaChadInterface is IPangolinDEXFacet, IAssetsOperationsFacet, IOwnershipFacet, ISmartLoanLiquidationFacet, ISmartLoanLogicFacet, ISolvencyFacet, IYieldYakFacet, IUbeswapDEXFacet {

}
