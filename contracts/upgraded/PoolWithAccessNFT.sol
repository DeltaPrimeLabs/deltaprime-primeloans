// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 0fbd3d2132ce3d3a12c966ee5e6ffba53aae9d33;
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../Pool.sol";
import "../ERC20Pool.sol";

contract PoolWithAccessNFT is NFTAccess, ERC20Pool {
    using TransferHelper for address payable;

   /**
     * Requires access NFT
     * Deposits the message value
     * It updates user deposited balance, total deposited and rates
   **/
    function deposit(uint256 amount) public override hasAccessNFT {
        super.deposit(amount);
    }
}
