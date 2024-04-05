// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Prime is ERC20, ERC20Permit {
    constructor(uint256 supply) ERC20("DeltaPrime", "PRIME") ERC20Permit("DeltaPrime") {
        _mint(_msgSender(), supply);
    }
}