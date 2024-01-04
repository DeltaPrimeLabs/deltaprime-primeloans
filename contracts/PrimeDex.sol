// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IPrimeDex} from "./interfaces/IPrimeDex.sol";
import {ISmartLoanFactory} from "./interfaces/ISmartLoanFactory.sol";

/// @title DeltaPrime Dust Converter
/// @notice PrimeAccounts will interact with this contract to send dust balances and
///         receive equivalent $ amount of $PRIME in return
contract PrimeDex is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    // ---------- Storage ----------

    ISmartLoanFactory public immutable smartLoanFactory;

    // ---------- Errors ----------

    error ZeroAddress();

    // ---------- Constructor ----------

    constructor(address smartLoanFactory_) {
        if (smartLoanFactory_ == address(0)) revert ZeroAddress();

        smartLoanFactory = ISmartLoanFactory(smartLoanFactory_);
    }

    function convert(
        IPrimeDex.AssetInfo[] memory assets,
        uint256[] memory amounts,
        uint256[] memory prices,
        IPrimeDex.AssetInfo memory targetAsset,
        uint256 targetPrice
    ) external returns (uint256 returnAmount) {
        require(smartLoanFactory.canBorrow(msg.sender), "Unauthorized");

        uint256 length = assets.length;

        IERC20Metadata target = IERC20Metadata(targetAsset.asset);
        uint8 targetDecimals = target.decimals();
        for (uint256 i; i != length; ++i) {
            IERC20Metadata dustAsset = IERC20Metadata(assets[i].asset);
            if (assets[i].symbol != targetAsset.symbol) {
                dustAsset.safeTransferFrom(msg.sender, address(this), amounts[i]);
                emit ReceiveDustToken(assets[i].asset, msg.sender, amounts[i]);
                returnAmount += amounts[i] * prices[i] * (10 ** targetDecimals) / (10 ** dustAsset.decimals()) / targetPrice;
            }
        }

        target.safeTransfer(msg.sender, returnAmount);
        emit TransferTargetToken(targetAsset.asset, msg.sender, returnAmount);
    }

    /// @notice Transfer out dust tokens
    function transferToken(IERC20Metadata token, uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
    }

    // ---------- Events ----------

    /**
     * @notice Emitted when a user sends dust tokens to the contract
     * @param token The address of the dust token
     * @param user The address of the user
     * @param amount The amount of dust tokens
     */
    event ReceiveDustToken(address indexed token, address indexed user, uint256 amount);

    /**
     * @notice Emitted when the contract sends target tokens to the user
     * @param token The address of the target token
     * @param user The address of the user
     * @param amount The amount of target tokens
     */
    event TransferTargetToken(address indexed token, address indexed user, uint256 amount);
}
