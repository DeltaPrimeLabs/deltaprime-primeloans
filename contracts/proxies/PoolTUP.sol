// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 7917496da7da9a80ed93a8b62542e1faea2fe8f8;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract PoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
