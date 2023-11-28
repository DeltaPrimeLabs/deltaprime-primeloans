// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2afef88a7df5f1a179e771bba0c7163370eb9cca;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title BtcPool
 * @dev Contract allowing user to deposit to and borrow BTC.b from a dedicated user account
 */
contract BtcPool is Pool {
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.9e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeBitcoin";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPBTCb";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 8;
    }
}