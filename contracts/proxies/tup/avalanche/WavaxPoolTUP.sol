// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f63ef97516096bbd3db42914b6554a461f90ef40;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract WavaxPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
