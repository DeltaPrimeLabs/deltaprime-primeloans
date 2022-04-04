// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

contract IntegrationEnums {
    enum supportedActions {
        // TODO: Replace BUY/SELL with SWAP once ERC20 Pools are implemented
        BUY,
        SELL,
        STAKE,
        UNSTAKE,
        ADD_LIQUIDITY,
        REMOVE_LIQUIDITY,
        GET_TOTAL_VALUE
    }
}
