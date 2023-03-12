// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 0d6b0d874bf1be5244f980277602b5fbf6f205e1;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UsdtPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
