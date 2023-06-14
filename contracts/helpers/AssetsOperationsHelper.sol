// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../interfaces/ITokenManager.sol";
import {Pool} from "../Pool.sol";
import "../lib/SolvencyMethods.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsOperationsHelper is SolvencyMethods {
    using TransferHelper for address;

    /**
    * Funds the loan with a specified amount of a defined token
    * @dev Requires approval for ERC20 token on frontend side
    * @param _fundedAsset asset to be funded
    * @param _amount to be funded
    **/
    function _fund(bytes32 _fundedAsset, uint256 _amount) internal {
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset, false);
        _amount = Math.min(_amount, token.balanceOf(msg.sender));

        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        if (token.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_fundedAsset, address(token));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.increaseProtocolExposure(_fundedAsset, _amount * 1e18 / 10 ** token.decimals());

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @dev This function uses the redstone-evm-connector
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    **/
    function _borrow(bytes32 _asset, uint256 _amount) internal {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        ds._lastBorrowTimestamp = block.timestamp;

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool pool = Pool(tokenManager.getPoolAddress(_asset));
        pool.borrow(_amount);

        IERC20 token = getERC20TokenInstance(_asset, false);
        if (token.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_asset, address(token));
        }

        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }

    /**
     * Repays funds to the pool
     * @dev This function uses the redstone-evm-connector
     * @param _asset to be repaid
     * @param _amount of funds to repay
     **/
    function _repay(bytes32 _asset, uint256 _amount) internal {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);

        if (_isSolvent()) {
            DiamondStorageLib.enforceIsContractOwner();
        }

        Pool pool = Pool(DeploymentConstants.getTokenManager().getPoolAddress(_asset));

        _amount = Math.min(_amount, pool.getBorrowed(address(this)));
        require(token.balanceOf(address(this)) >= _amount, "There is not enough funds to repay");

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_asset);
        }

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);
    }

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after a loan is funded
     * @param user the address which funded the loan
     * @param asset funded by a user
     * @param amount the amount of funds
     * @param timestamp time of funding
     **/
    event Funded(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are borrowed from the pool
     * @param user the address of borrower
     * @param asset borrowed by an= user
     * @param amount of the borrowed funds
     * @param timestamp time of the borrowing
     **/
    event Borrowed(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool
     * @param user the address initiating repayment
     * @param asset asset repaid by a user
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event Repaid(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}