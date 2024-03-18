// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Prime is ERC20, ERC20Permit {
    constructor() ERC20("DeltaPrime", "PRIME") ERC20Permit("DeltaPrime") {}
}