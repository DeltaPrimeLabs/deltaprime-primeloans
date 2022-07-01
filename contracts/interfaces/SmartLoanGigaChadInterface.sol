pragma solidity ^0.8.4;

import "./faucets/IYieldYakFacet.sol";
import "./faucets/IPangolinDEXFacet.sol";
import "./faucets/IFundingFacet.sol";
import "./faucets/IOwnershipFacet.sol";
import "./faucets/ISmartLoanLogicFacet.sol";
import "./faucets/ISmartLoanLiquidationFacet.sol";
import "./faucets/ISolvencyFacet.sol";

interface SmartLoanGigaChadInterface is IPangolinDEXFacet, IFundingFacet, IOwnershipFacet, ISmartLoanLiquidationFacet, ISmartLoanLogicFacet, ISolvencyFacet, IYieldYakFacet {

}
