// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import {SolvencyFacetProd} from "../../facets/SolvencyFacetProd.sol";
import "../vPrimeController.sol";

contract SPrimeMock is ERC20, Ownable, ProxyConnector {
    mapping(address => uint256) private _locks;
    mapping(address => uint256) private _lockedBalances;
    vPrimeController public vPrimeControllerContract;
    uint256 public immutable DOLLAR_VALUE_MULTIPLIER;

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

    function lockBalance(uint256 amount, uint256 lockTime) public {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to lock");
        require(lockTime <= 3 * 365 days, "Cannot lock for more than 3 years");
        _locks[msg.sender] = block.timestamp + lockTime;
        _lockedBalances[msg.sender] = amount;
    }

    // We can either proxy RS calldata from vPrimeController to this function or call it directly with already extracted prices in vPrimeController
    function getUserDepositDollarValue(address userAddress) public view returns (uint256) {
        // TODO: Implement calculating dollar value of user's deposit (we can use SolvencyFacetProd::_getTotalTraderJoeV2() for reference)
        return balanceOf(userAddress) * DOLLAR_VALUE_MULTIPLIER;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        require(block.timestamp > _locks[from] || amount <= balanceOf(from) - _lockedBalances[from], "Balance is locked");
    }
}