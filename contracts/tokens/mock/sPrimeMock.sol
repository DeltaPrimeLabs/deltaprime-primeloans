// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SPrimeMock is ERC20, Ownable {
    mapping(address => uint256) private _locks;
    mapping(address => uint256) private _lockedBalances;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function overwriteBalance(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function lockBalance(uint256 amount, uint256 lockTime) public {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to lock");
        require(lockTime <= 3 * 365 days, "Cannot lock for more than 3 years");
        _locks[msg.sender] = block.timestamp + lockTime;
        _lockedBalances[msg.sender] = amount;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        require(block.timestamp > _locks[from] || amount <= balanceOf(from) - _lockedBalances[from], "Balance is locked");
    }
}