// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "./Pool.sol";
import "./interfaces/IWrappedNativeToken.sol";


/**
 * @title Pool
 * @dev Contract allowing user to deposit to and borrow from a single pot
 * Depositors are rewarded with the interest rates collected from borrowers.
 * Rates are compounded every second and getters always return the current deposit and borrowing balance.
 * The interest rates calculation is delegated to the external calculator contract.
 */
contract WrappedNativeTokenPool is Pool {

  function depositNativeToken() public payable virtual {
    IWrappedNativeToken(tokenAddress).deposit{value: msg.value}();

    _accumulateDepositInterest(msg.sender);

    _mint(msg.sender, msg.value);
    _deposited[address(this)] += msg.value;
    _updateRates();

    emit Deposit(msg.sender, msg.value, block.timestamp);
  }
}