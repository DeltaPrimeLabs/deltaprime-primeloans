// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "./Pool.sol";
import "./interfaces/IWrappedNativeToken.sol";
import "hardhat/console.sol";

/**
 * @title Pool
 * @dev Contract allowing user to deposit to and borrow from a single pot
 * Depositors are rewarded with the interest rates collected from borrowers.
 * Rates are compounded every second and getters always return the current deposit and borrowing balance.
 * The interest rates calculation is delegated to the external calculator contract.
 */
contract WrappedNativeTokenPool is Pool {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
     * Wraps and deposits amount attached to the transaction
     **/
    function depositNativeToken() public payable virtual {
        IWrappedNativeToken(tokenAddress).deposit{value : msg.value}();

        _accumulateDepositInterest(msg.sender);

        _mint(msg.sender, msg.value);
        _deposited[address(this)] += msg.value;
        _updateRates();

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    /**
     * Unwraps and withdraws selected amount from the user deposits
     * @dev _amount the amount to be withdrawn
     **/
    function withdrawNativeToken(uint256 _amount) external nonReentrant {
        require(IERC20(tokenAddress).balanceOf(address(this)) >= _amount, "There is not enough available funds in the pool to withdraw");

        _accumulateDepositInterest(msg.sender);

        _burn(msg.sender, _amount);

        IWrappedNativeToken(tokenAddress).withdraw(_amount);
        payable(msg.sender).safeTransferETH(_amount);

        _updateRates();

        emit Withdrawal(msg.sender, _amount, block.timestamp);
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    //needed for withdrawNativeToken
    receive() external payable {}
}