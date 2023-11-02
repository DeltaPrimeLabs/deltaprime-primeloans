// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../TraderJoeV2Facet.sol";

contract TraderJoeV2ArbitrumFacet is TraderJoeV2Facet {
    function maxBinsPerPrimeAccount() public pure override returns (uint256) {
        return 0;
    }

    function getWhitelistedTraderJoeV2Pairs() internal pure override returns (ILBPair[] memory pools) {
        pools = new ILBPair[](5);
        pools[0] = ILBPair(0x500173F418137090dad96421811147b63b448A0f);
        pools[1] = ILBPair(0xd387c40a72703B38A5181573724bcaF2Ce6038a5);
        pools[2] = ILBPair(0x94d53BE52706a155d27440C4a2434BEa772a6f7C);
        pools[3] = ILBPair(0x0Be4aC7dA6cd4bAD60d96FbC6d091e1098aFA358);
        pools[4] = ILBPair(0xcfA09B20c85933B197e8901226ad0D6dACa7f114);
    }
}
