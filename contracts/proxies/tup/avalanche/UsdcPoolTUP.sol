// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 648f5794d589d10ef8ef138b16697fb525ee9b24;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UsdcPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
