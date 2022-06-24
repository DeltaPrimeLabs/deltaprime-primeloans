pragma solidity ^0.8.4;

import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../faucets/SolvencyFacet.sol";

contract SolvencyMethodsLib {
    // This function executes SolvencyFacet.calculateDebt()
    function _calculateDebt() internal virtual returns (uint256 debt) {
        debt = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.getDebt.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.isSolvent()
    function _isSolvent() internal virtual returns (bool solvent){
        solvent = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.isSolvent.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacet.calculateTotalValue()
    function _calculateTotalValue() internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.getTotalValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.calculateAssetsValue()
    function _calculateAssetsValue() internal virtual returns (uint256 assetsValue) {
        assetsValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.calculateAssetsValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.getLTV()
    function _getLTV() public virtual returns (uint256 ltv) {
        ltv = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.getLTV.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.calculateLTV() but allows for in-memory uint256[] _prices re-use
    function _calculateLTV() internal virtual returns (uint256 ltv) {
        ltv = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                SmartLoanLib.getSolvencyFacetAddress(),
                abi.encodeWithSelector(SolvencyFacet.calculateLTV.selector)
            ),
            (uint256)
        );
    }
}
