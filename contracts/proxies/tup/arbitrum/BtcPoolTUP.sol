// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: de0a4e9ee653d2aade275c436805bb3217a8979d;
pragma solidity 0.8.27;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BtcPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
