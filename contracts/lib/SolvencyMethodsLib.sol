pragma solidity ^0.8.4;

import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../faucets/SolvencyFacet.sol";
import "../interfaces/IDiamondBeacon.sol";

// TODO Rename to contract instead of lib
contract SolvencyMethodsLib {
    // This function executes SolvencyFacet.calculateDebt()
    function _calculateDebt() internal virtual returns (uint256 debt) {
        debt = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.getDebt.selector)),
                abi.encodeWithSelector(SolvencyFacet.getDebt.selector)
            ),
            (uint256)
        );
    }

    function _getDiamondBeaconContract(bytes memory methodSig) internal returns(address solvencyFacetAddress) {
        solvencyFacetAddress = IDiamondBeacon(payable(SmartLoanLib.getDiamondAddress())).implementation(convertBytesToBytes4(methodSig));
    }

    function convertBytesToBytes4(bytes memory inBytes) internal returns (bytes4 outBytes4) {
        if (inBytes.length == 0) {
            return 0x0;
        }
        assembly {
            outBytes4 := mload(add(inBytes, 0x20))
        }
    }

    // This function executes SolvencyFacet.isSolvent()
    function _isSolvent() internal virtual returns (bool solvent){
        solvent = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.isSolvent.selector)),
                abi.encodeWithSelector(SolvencyFacet.isSolvent.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacet.calculateTotalValue()
    function _calculateTotalValue() internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.getTotalValue.selector)),
                abi.encodeWithSelector(SolvencyFacet.getTotalValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.calculateAssetsValue()
    function _calculateAssetsValue() internal virtual returns (uint256 assetsValue) {
        assetsValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.calculateAssetsValue.selector)),
                abi.encodeWithSelector(SolvencyFacet.calculateAssetsValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.getLTV()
    function _getLTV() public virtual returns (uint256 ltv) {
        ltv = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.getLTV.selector)),
                abi.encodeWithSelector(SolvencyFacet.getLTV.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.calculateLTV() but allows for in-memory uint256[] _prices re-use
    function _calculateLTV() internal virtual returns (uint256 ltv) {
        ltv = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                _getDiamondBeaconContract(abi.encodeWithSelector(SolvencyFacet.calculateLTV.selector)),
                abi.encodeWithSelector(SolvencyFacet.calculateLTV.selector)
            ),
            (uint256)
        );
    }
}
