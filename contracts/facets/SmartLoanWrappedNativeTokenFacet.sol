// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../interfaces/IWrappedNativeToken.sol";
import "../lib/SolvencyMethods.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SmartLoanWrappedNativeTokenFacet is SolvencyMethods {
    using TransferHelper for address payable;

    function wrapNativeToken(uint256 amount) onlyOwner public {
        require(amount <= address(this).balance, "Not enough native token to wrap");
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        wrapped.deposit{value : amount}();

        if (wrapped.balanceOf(address(this)) != 0) {
            DiamondStorageLib.addOwnedAsset(DeploymentConstants.getNativeTokenSymbol(), address(wrapped));
        }

        emit WrapNative(msg.sender, amount, block.timestamp);
    }

    function depositNativeToken() public payable virtual {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        wrapped.deposit{value : msg.value}();

        if (wrapped.balanceOf(address(this)) != 0) {
            DiamondStorageLib.addOwnedAsset(DeploymentConstants.getNativeTokenSymbol(), address(wrapped));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.increaseProtocolExposure(DeploymentConstants.getNativeTokenSymbol(), msg.value);

        emit DepositNative(msg.sender, msg.value, block.timestamp);
    }

    function unwrapAndWithdraw(uint256 _amount) onlyOwner remainsSolvent canRepayDebtFully public payable virtual {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        require(wrapped.balanceOf(address(this)) >= _amount, "Not enough native token to unwrap and withdraw");

        wrapped.withdraw(_amount);

        if (wrapped.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(DeploymentConstants.getNativeTokenSymbol());
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure(DeploymentConstants.getNativeTokenSymbol(), _amount);

        payable(msg.sender).safeTransferETH(_amount);

        emit UnwrapAndWithdraw(msg.sender, msg.value, block.timestamp);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
    * @dev emitted when native tokens are wrapped in the SmartLoan
    * @param user the address initiating wrap
    * @param amount of wrapped funds
    * @param timestamp of wrap
    **/
    event WrapNative(address indexed user, uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are deposited to the SmartLoan
    * @param user the address initiating deposit of native token
    * @param amount of deposited funds
    * @param timestamp of deposit
    **/
    event DepositNative(address indexed user, uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are unwrapped and withdrawn from the SmartLoan
    * @param user the address initiating unwrap and withdraw of native token
    * @param amount of unwrapped and withdrawn funds
    * @param timestamp of unwrap and withdraw
    **/
    event UnwrapAndWithdraw(address indexed user, uint256 amount, uint256 timestamp);

}