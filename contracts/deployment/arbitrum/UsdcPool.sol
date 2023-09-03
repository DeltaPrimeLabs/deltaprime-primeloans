// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9c92fb9e3145f5c6df5afa94924e0ab9dd25255e;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title UsdcPool
 * @dev Contract allowing user to deposit to and borrow USDC from a dedicated user account
 */
contract UsdcPool is Pool {
    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeUSDCoin";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPUSDC";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 6;
    }
}