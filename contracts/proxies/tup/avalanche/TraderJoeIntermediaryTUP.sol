// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 43879c9dc673fbc3c0974b8106a295ba5c5e6774;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract TraderJoeIntermediaryTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
