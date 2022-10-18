// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "../TokenManager.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsOperationsFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * Funds the loan with a specified amount of a defined token
    * @dev Requires approval for ERC20 token on frontend side
    * @param _fundedAsset asset to be funded
    * @param _amount to be funded
    **/
    function fund(bytes32 _fundedAsset, uint256 _amount) public virtual {
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset, false);
        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        if (token.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_fundedAsset, address(token));
        }

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

    /**
    * Withdraws an amount of a defined asset from the loan
    * This method could be used to cash out profits from investments
    * The loan needs to remain solvent after the withdrawal
    * @dev This function uses the redstone-evm-connector
    * @param _withdrawnAsset asset to be withdrawn
    * @param _amount to be withdrawn
    **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset, true);
        require(getBalance(_withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

        address(token).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_withdrawnAsset);
        }

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @dev This function uses the redstone-evm-connector
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool pool = Pool(tokenManager.getPoolAddress(_asset));
        pool.borrow(_amount);

        IERC20Metadata token = getERC20TokenInstance(_asset, false);
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
    function repay(bytes32 _asset, uint256 _amount) public payable {
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

    /* ======= VIEW FUNCTIONS ======*/

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) internal view returns (uint256) {
        IERC20 token = IERC20(DeploymentConstants.getTokenManager().getAssetAddress(_asset, true));
        return token.balanceOf(address(this));
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
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
     * @dev emitted after the funds are withdrawn from the loan
     * @param user the address which withdraws funds from the loan
     * @param asset withdrawn by a user
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawn(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

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