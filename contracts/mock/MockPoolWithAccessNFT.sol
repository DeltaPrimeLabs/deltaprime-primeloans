// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../Pool.sol";


contract MockPoolWithAccessNFT is NFTAccess, Pool {
    function deposit() public payable override hasAccessNFT {
        super.deposit();
    }
}
