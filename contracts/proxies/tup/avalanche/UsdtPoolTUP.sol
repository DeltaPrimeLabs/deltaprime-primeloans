// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: b934f34e5f8d1a9bdde2f563e2dabcadcc46c5f1;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UsdtPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
