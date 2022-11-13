// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f63ef97516096bbd3db42914b6554a461f90ef40;
pragma solidity 0.8.17;

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
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
     * Wraps and deposits amount attached to the transaction
     **/
    function depositNativeToken() public payable virtual {
        require(canDeposit[msg.sender], "User not permitted to create a loan");
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
        require(IERC20(tokenAddress).balanceOf(address(this)) >= _amount, "Not enough funds in the pool to withdraw");

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