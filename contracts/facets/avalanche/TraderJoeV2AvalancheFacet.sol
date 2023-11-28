// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../TraderJoeV2Facet.sol";

contract TraderJoeV2AvalancheFacet is TraderJoeV2Facet {
    function maxBinsPerPrimeAccount() public pure override returns (uint256) {
        return 80;
    }

    function getWhitelistedTraderJoeV2Pairs() internal pure override returns (ILBPair[] memory pools) {
        pools = new ILBPair[](3);
        pools[0] = ILBPair(0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1);
        pools[1] = ILBPair(0x1901011a39B11271578a1283D620373aBeD66faA);
        pools[2] = ILBPair(0xD9fa522F5BC6cfa40211944F2C8DA785773Ad99D);
    }
}
