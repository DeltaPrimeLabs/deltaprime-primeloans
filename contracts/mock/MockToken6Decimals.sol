// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken6Decimals is ERC20 {
    constructor(address[] memory airdropUsers) ERC20("MockToken", "USDT") {

        for (uint256 i = 0; i < airdropUsers.length; i++) {
            _mint(airdropUsers[i], 10000 * 10 ** decimals());
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
