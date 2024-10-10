// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2f8ed44459fc99825919d399c3e4350b61551b67;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RTKNDP is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize() public initializer {
        __ERC20_init("ReimbursementTokenDeltaPrime", "rTKNDP");
        __Ownable_init();
    }

    constructor(){
        _disableInitializers();
    }
}