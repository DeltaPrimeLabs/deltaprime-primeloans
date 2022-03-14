// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 97d6cc3cb60bfd6feda4ea784b13bf0e7daac710;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract PoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
