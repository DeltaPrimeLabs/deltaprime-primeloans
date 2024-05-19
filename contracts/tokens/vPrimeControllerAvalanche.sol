// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./vPrimeController.sol";
import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";

contract vPrimeControllerArbitrum is vPrimeController, AvalancheDataServiceConsumerBase {}
