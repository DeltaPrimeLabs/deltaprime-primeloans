// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IAddressProvider.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract RecoveryFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
     * Emergency withdraws given assets from the loan
     * @dev This function uses the redstone-evm-connector
     * @param _assets assets to be withdrawn
     * @return _amounts amounts withdrawn
     **/
    function emergencyWithdraw(
        bytes32[] memory _assets
    ) public onlyRC returns (uint256[] memory _amounts) {
        uint256 length = _assets.length;
        for (uint256 i; i != length; ++i) {
            bytes32 asset = _assets[i];
            if (asset == "GLP") {
                _amounts[i] = _withdrawGLP();
            } else {
                _amounts[i] = _withdraw(asset);
            }
        }
    }

    function _withdraw(bytes32 _asset) internal returns (uint256 _amount) {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);
        _amount = token.balanceOf(address(this));

        address(token).safeTransfer(msg.sender, _amount);
        DiamondStorageLib.removeOwnedAsset(_asset);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure(
            _asset,
            (_amount * 1e18) / 10 ** token.decimals()
        );
    }

    function _withdrawGLP() internal returns (uint256 _amount) {
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(
            0xaE64d55a6f09E4263421737397D1fdFA71896a69
        );
        _amount = token.balanceOf(address(this));

        address(stakedGlpToken).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("GLP");
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure(
            "GLP",
            (_amount * 1e18) / 10 ** token.decimals()
        );
    }

    /* ========== MODIFIERS ========== */

    modifier onlyRC() {
        IAddressProvider addressProvider = IAddressProvider(DeploymentConstants.getAddressProvider());
        require(
            msg.sender == addressProvider.getRecoveryContract(),
            "msg.sender != RC"
        );
        _;
    }
}
