// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IDustConverter} from "./interfaces/IDustConverter.sol";
import {ISmartLoanFactory} from "./interfaces/ISmartLoanFactory.sol";

/// @title DeltaPrime Dust Converter
/// @notice PrimeAccounts will interact with this contract to send dust balances and
///         receive equivalent $ amount of $PRIME in return
contract DustConverter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    // ---------- Storage ----------

    ISmartLoanFactory public immutable smartLoanFactory;

    IDustConverter.AssetInfo public targetAsset;

    // ---------- Constructor ----------

    constructor(address smartLoanFactory_, IDustConverter.AssetInfo memory targetAsset_) {
        require(smartLoanFactory_ != address(0));

        smartLoanFactory = ISmartLoanFactory(smartLoanFactory_);
        targetAsset = targetAsset_;
    }

    function convert(IDustConverter.AssetInfo[] memory assets, uint256[] memory prices) external returns (IDustConverter.AssetInfo memory) {
        bytes32 targetSymbol = targetAsset.symbol;
        uint256 length = assets.length;
        bytes32[] memory symbols = new bytes32[](length + 1);
        for (uint256 i; i != length; ++i) {
            symbols[i] = assets[i].symbol;
        }
        symbols[length] = targetSymbol;

        uint256 returnAmount;
        IERC20Metadata target = IERC20Metadata(targetAsset.asset);
        uint8 targetDecimals = target.decimals();
        for (uint256 i; i != length; ++i) {
            IERC20Metadata dustAsset = IERC20Metadata(assets[i].asset);
            uint256 amount = dustAsset.balanceOf(msg.sender);
            if (symbols[i] != targetSymbol) {
                dustAsset.safeTransferFrom(msg.sender, address(this), amount);
                returnAmount += amount * prices[i] * (10 ** targetDecimals) / (10 ** dustAsset.decimals()) / prices[length];
            }
        }

        target.safeTransfer(msg.sender, returnAmount);

        return targetAsset;
    }

    /// @notice Transfer out dust tokens
    function transferToken(IERC20Metadata token, uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
    }
}
