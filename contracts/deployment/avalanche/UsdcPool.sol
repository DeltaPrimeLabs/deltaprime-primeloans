// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 16e2b34c1e27f64494655479ab269f0147cada9d;
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