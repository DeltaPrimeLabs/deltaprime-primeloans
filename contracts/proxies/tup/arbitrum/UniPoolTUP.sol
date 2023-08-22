// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 58c223f4c83794b2ac9477fb697e0632d59efff8;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UniPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
