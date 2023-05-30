pragma solidity ^0.8.17;

import "../../joe-v2/ILBPair.sol";

interface ITraderJoeV2Facet {

    struct TraderJoeV2Bin {
        ILBPair pair;
        uint24 id;
    }
}
