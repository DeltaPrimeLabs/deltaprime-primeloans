// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AvalaunchPrime is ERC20 {
    uint256 public immutable TOTAL_SUPPLY = 266666666666666666666666; // 266666,(6) with 18 decimals

    constructor() ERC20("AvalaunchPrime", "APrime") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}