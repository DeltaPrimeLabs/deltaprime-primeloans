// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import {vPrimeController} from "../vPrimeController.sol";
import "@redstone-finance/evm-connector/contracts/mocks/AuthorisedMockSignersBase.sol";

contract vPrimeControllerMock is vPrimeController, AuthorisedMockSignersBase {}