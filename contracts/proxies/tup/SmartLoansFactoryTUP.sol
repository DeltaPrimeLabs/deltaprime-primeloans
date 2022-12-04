// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 49fd65d9a6ea5ddcd283ac4913262e342cf1ad80;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract SmartLoansFactoryTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
