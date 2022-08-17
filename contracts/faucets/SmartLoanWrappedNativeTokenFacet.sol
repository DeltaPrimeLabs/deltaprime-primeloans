pragma solidity ^0.8.4;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../lib/SmartLoanLib.sol";
import "../interfaces/IWrappedNativeToken.sol";

contract SmartLoanWrappedNativeTokenFacet {
    using TransferHelper for address payable;

    function wrapNativeToken(uint256 amount) onlyOwner public {
        require(amount <= address(this).balance, "Not enough native token to wrap");
        IWrappedNativeToken(SmartLoanLib.getNativeToken()).deposit{value: amount}();
        emit WrapNative(msg.sender, amount, block.timestamp);
    }

    function depositNativeToken() public payable virtual {
        IWrappedNativeToken(SmartLoanLib.getNativeToken()).deposit{value: msg.value}();

        emit DepositNative(msg.sender, msg.value, block.timestamp);
    }

    function unwrapAndWithdraw(uint256 _amount) public payable virtual {
        IWrappedNativeToken native = IWrappedNativeToken(SmartLoanLib.getNativeToken());
        require(native.balanceOf(address(this)) >= _amount, "Not enough native token to unwrap and withdraw");

        native.withdraw(_amount);

        payable(msg.sender).safeTransferETH(_amount);

        emit UnwrapAndWithdraw(msg.sender, msg.value, block.timestamp);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
    * @dev emitted when native tokens are wrapped in the SmartLoan
    * @param owner the address initiating deposit
    * @param amount of wrapped funds
    * @param timestamp of the repayment
    **/
    event WrapNative(address indexed owner,  uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are deposited to the SmartLoan
    * @param owner the address initiating deposit
    * @param amount of repaid funds
    * @param timestamp of the repayment
    **/
    event DepositNative(address indexed owner,  uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are withdrawn by the owner
    * @param owner the address initiating withdraw
    * @param amount of repaid funds
    * @param timestamp of the repayment
    **/
    event UnwrapAndWithdraw(address indexed owner,  uint256 amount, uint256 timestamp);

}