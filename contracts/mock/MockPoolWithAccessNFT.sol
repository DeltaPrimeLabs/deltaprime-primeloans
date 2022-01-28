// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../Pool.sol";


contract MockPoolWithAccessNFT is NFTAccess, Pool {
    function deposit() external payable override nonReentrant hasAccessNFT {
        _accumulateDepositInterest(msg.sender);

        _mint(msg.sender, msg.value);
        _updateRates();

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
}
