// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: a8429e3dd31e4164503af56863fbb4a7e868ceb6;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract EthPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
