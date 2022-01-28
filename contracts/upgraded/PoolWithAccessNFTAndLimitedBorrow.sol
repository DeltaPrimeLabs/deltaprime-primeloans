// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../Pool.sol";

contract PoolWithAccessNFTAndLimitedBorrow is NFTAccess, Pool {
    using TransferHelper for address payable;

   /**
     * Requires access NFT
     * Deposits the message value
     * It updates user deposited balance, total deposited and rates
   **/
    function deposit() public payable override hasAccessNFT {
        super.deposit();
    }

   /**
     * Initial loan has to be equal to 2 AVAX
     * Borrows the specified amount
     * It updates user borrowed balance, total borrowed amount and rates
     * @dev _amount the amount to be borrowed
   **/
    function borrow(uint256 _amount) public override {
        if(borrowed[msg.sender] == 0) {
            require(_amount == 2 ether, "Initial loan has to be equal to 2 AVAX");
        }
        super.borrow(_amount);
    }
}
