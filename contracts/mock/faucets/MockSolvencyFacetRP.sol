pragma solidity ^0.8.4;

import "../../faucets/SolvencyFacet.sol";


contract MockSolvencyFacetRP is SolvencyFacet {
    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return (_receivedSigner == 0xFE71e9691B9524BC932C23d0EeD5c9CE41161884) || (_receivedSigner == SmartLoanLib.getPriceProvider2());
    }
}
