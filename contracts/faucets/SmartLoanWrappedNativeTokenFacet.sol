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
        IWrappedNativeToken wrapped = IWrappedNativeToken(SmartLoanLib.getNativeToken());
        require(wrapped.balanceOf(address(this)) >= _amount, "Not enough native token to unwrap and withdraw");

        wrapped.withdraw(_amount);

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
    * @param owner the address initiating wrap
    * @param amount of wrapped funds
    * @param timestamp of wrap
    **/
    event WrapNative(address indexed owner,  uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are deposited to the SmartLoan
    * @param owner the address initiating deposit of native token
    * @param amount of deposited funds
    * @param timestamp of deposit
    **/
    event DepositNative(address indexed owner,  uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are unwrapped and withdrawn from the SmartLoan
    * @param owner the address initiating unwrap and withdraw of native token
    * @param amount of unwrapped and withdrawn funds
    * @param timestamp of unwrap and withdraw
    **/
    event UnwrapAndWithdraw(address indexed owner,  uint256 amount, uint256 timestamp);

}