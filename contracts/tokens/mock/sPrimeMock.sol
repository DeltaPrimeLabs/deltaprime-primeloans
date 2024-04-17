// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import {SolvencyFacetProd} from "../../facets/SolvencyFacetProd.sol";
import "../vPrimeController.sol";
import "hardhat/console.sol";

contract SPrimeMock is ERC20, Ownable, ProxyConnector {
    struct LockDetails {
        uint256 lockTime;
        uint256 amount;
        uint256 unlockTime;
    }

    vPrimeController public vPrimeControllerContract;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;
    uint256 public immutable DOLLAR_VALUE_MULTIPLIER;

    mapping(address => LockDetails[]) public locks;

    // TODO: _DOLLAR_VALUE_MULTIPLIER is only for mocking of dollar value calculation, we need to replace it with actual calculation in the final implementation
    constructor(string memory name, string memory symbol, uint256 _DOLLAR_VALUE_MULTIPLIER) ERC20(name, symbol) {
        DOLLAR_VALUE_MULTIPLIER = _DOLLAR_VALUE_MULTIPLIER;
    }

    function increaseBalance(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
        proxyCalldata(
            address(vPrimeControllerContract),
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", account),
            false
        );
    }

    function getFullyVestedLockedBalanceToNonVestedRatio(address account) public view returns (uint256) {
        uint256 totalBalance = balanceOf(account);
        uint256 fullyVestedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime <= block.timestamp) {
                fullyVestedBalance += locks[account][i].amount * locks[account][i].lockTime / MAX_LOCK_TIME;
            }
        }
        return totalBalance == 0 ? 0 : fullyVestedBalance * 1e18 / totalBalance;
    }

    function setVPrimeControllerContract(address _vPrimeControllerContract) public onlyOwner {
        vPrimeControllerContract = vPrimeController(_vPrimeControllerContract);
    }

    function decreaseBalance(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
        proxyCalldata(
            address(vPrimeControllerContract),
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", account),
            false
        );
    }

    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    function lockBalance(uint256 amount, uint256 lockTime) public {
        uint256 lockedBalance = getLockedBalance(msg.sender);
        require(balanceOf(msg.sender) - lockedBalance >= amount, "Insufficient balance to lock");
        require(lockTime <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
        locks[msg.sender].push(LockDetails({
            lockTime: lockTime,
            amount: amount,
            unlockTime: block.timestamp + lockTime
        }));
    }

    // We can either proxy RS calldata from vPrimeController to this function or call it directly with already extracted prices in vPrimeController
    function getUserDepositDollarValue(address userAddress) public view returns (uint256) {
        // TODO: Implement calculating dollar value of user's deposit (we can use SolvencyFacetProd::_getTotalTraderJoeV2() for reference)
        return balanceOf(userAddress) * DOLLAR_VALUE_MULTIPLIER;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if(from != address(0)) {
            uint256 lockedBalance = getLockedBalance(msg.sender);
            require(amount <= balanceOf(from) - lockedBalance, "Balance is locked");
        }
    }
}