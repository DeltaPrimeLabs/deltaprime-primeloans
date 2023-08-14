// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/facets/avalanche/IRecoveryFacet.sol";

/// @title DeltaPrime Recovery Manager
contract RecoveryManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RecoveryData {
        bytes32 asset;
        address[] accounts;
        address token0;
        address token1;
        uint256 minAmount0;
        uint256 minAmount1;
    }

    struct RecoveryHelper {
        address helper;
        bytes4 selector;
    }

    mapping(bytes32 => RecoveryHelper) public recoveryHelpers;

    function addRecoveryHelper(
        bytes32 _asset,
        address _helper,
        bytes4 _selector
    ) external onlyOwner {
        recoveryHelpers[_asset] = RecoveryHelper({helper: _helper, selector: _selector});

        emit RecoveryHelperAdded(_asset, _helper, _selector);
    }

    function recoverAssets(
        RecoveryData[] memory _data
    ) external nonReentrant onlyOwner {
        uint256 length = _data.length;
        require(length > 0, "empty array");

        for (uint256 i; i != length; ++i) {
            RecoveryData memory data = _data[i];
            RecoveryHelper memory recoveryHelper = recoveryHelpers[data.asset];
            require(recoveryHelper.helper != address(0), "RecoveryHelper not found");

            uint256 userLength = data.accounts.length;
            uint256[] memory recovered = new uint256[](userLength);
            uint256 totalRecovered;

            for (uint256 j; j != userLength; ++j) {
                recovered[j] = IRecoveryFacet(data.accounts[j]).emergencyWithdraw(
                    data.asset
                );
                totalRecovered += recovered[j];
            }

            require(totalRecovered > 0, "Nothing to recover");

            uint256 beforeBalance0;
            uint256 beforeBalance1;
            if (data.token0 != address(0)) {
                beforeBalance0 = IERC20(data.token0).balanceOf(address(this));
            }
            if (data.token1 != address(0)) {
                beforeBalance1 = IERC20(data.token1).balanceOf(address(this));
            }

            (bool success, ) = recoveryHelper.helper.delegatecall(
                abi.encodeWithSelector(
                    recoveryHelper.selector,
                    data.token0,
                    data.token1,
                    totalRecovered,
                    data.minAmount0,
                    data.minAmount1
                )
            );
            require(success, "failed to unstake");

            uint256 recoveredBalance0;
            uint256 recoveredBalance1;
            if (data.token0 != address(0)) {
                recoveredBalance0 = IERC20(data.token0).balanceOf(
                    address(this)
                ) - beforeBalance0;
            }
            if (data.token1 != address(0)) {
                recoveredBalance1 = IERC20(data.token1).balanceOf(
                    address(this)
                ) - beforeBalance1;
            }

            for (uint256 j; j != userLength; ++j) {
                address account = data.accounts[j];
                uint256 refundAmount0 = (recoveredBalance0 * recovered[j]) /
                    totalRecovered;
                uint256 refundAmount1 = (recoveredBalance1 * recovered[j]) /
                    totalRecovered;
                _refundAsset(account, data.token0, refundAmount0);
                if (refundAmount1 > 0) {
                    _refundAsset(account, data.token1, refundAmount1);
                }
            }

            emit AssetRecovered(
                data.asset,
                totalRecovered,
                data.token0,
                recoveredBalance0,
                data.token1,
                recoveredBalance1
            );
        }
    }

    function _refundAsset(address account, address token, uint256 refundAmount) internal {
        if (token == 0x9e295B5B976a184B14aD8cd72413aD846C299660) {
            IERC20(0xaE64d55a6f09E4263421737397D1fdFA71896a69).safeApprove(account, 0);
            IERC20(0xaE64d55a6f09E4263421737397D1fdFA71896a69).safeApprove(account, refundAmount);
        } else {
            IERC20(token).safeApprove(account, 0);
            IERC20(token).safeApprove(account, refundAmount);
        }
        IRecoveryFacet(account).notifyRefund(token, refundAmount);
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    event RecoveryHelperAdded(bytes32 indexed asset, address helper, bytes4 selector);

    event AssetRecovered(
        bytes32 indexed asset,
        uint256 assetRecovered,
        address indexed token0,
        uint256 token0Recovered,
        address indexed token1,
        uint256 token1Recovered
    );
}
