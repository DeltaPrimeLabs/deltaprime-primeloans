// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IStakingPositions.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsExposureController {

    function resetPrimeAccountAssetsExposure() external view returns (ITokenManager.ExposureUpdate[] memory exposures) {
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 ownedAssetsLength = ownedAssets.length;
        uint256 positionsLength = positions.length;
        exposures = new ITokenManager.ExposureUpdate[](ownedAssetsLength + positionsLength);

        for (uint256 i; i != ownedAssetsLength; ++i) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssets[i], true));
            exposures[i] = ITokenManager.ExposureUpdate({
                identifier: ownedAssets[i],
                decrease: token.balanceOf(address(this)) * 1e18 / 10**token.decimals()
            });
        }
        for (uint256 i; i != positionsLength; ++i) {
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                exposures[ownedAssetsLength + i] = ITokenManager.ExposureUpdate({
                    identifier: positions[i].identifier,
                    decrease: balance * 1e18 / 10**decimals
                });
            }
        }
    }

    function setPrimeAccountAssetsExposure(ITokenManager.ExposureUpdate[] memory exposures) external {
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 ownedAssetsLength = ownedAssets.length;
        uint256 exposuresLength = exposures.length;
        for (uint256 i; i != ownedAssetsLength; ++i) {
            bytes32 identifier = ownedAssets[i];
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(identifier, true));
            uint256 decrease;
            for (uint256 j; j != exposuresLength; ++j) {
                if (exposures[j].identifier == identifier) {
                    decrease = exposures[j].decrease;
                    break;
                }
            }
            uint256 increase = token.balanceOf(address(this)) * 1e18 / 10**token.decimals();
            _updateProtocolExposure(tokenManager, identifier, decrease, increase);
        }
        uint256 positionsLength = positions.length;
        for (uint256 i; i != positionsLength; ++i) {
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                bytes32 identifier = positions[i].identifier;
                uint256 decrease;
                for (uint256 j; j != exposuresLength; ++j) {
                    if (exposures[j].identifier == identifier) {
                        decrease = exposures[j].decrease;
                        break;
                    }
                }
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                uint256 increase = balance * 1e18 / 10**decimals;
                _updateProtocolExposure(tokenManager, identifier, decrease, increase);
            }
        }
    }

    function resetPartialPrimeAccountAssetsExposure(bytes32[] memory assets, bytes32[] memory positionIdentifiers) external view returns (ITokenManager.ExposureUpdate[] memory exposures) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 ownedAssetsLength = assets.length;
        uint256 positionsLength = positionIdentifiers.length;
        exposures = new ITokenManager.ExposureUpdate[](ownedAssetsLength + positionsLength);

        for (uint256 i; i != ownedAssetsLength; ++i) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assets[i], true));
            exposures[i] = ITokenManager.ExposureUpdate({
                identifier: assets[i],
                decrease: token.balanceOf(address(this)) * 1e18 / 10**token.decimals()
            });
        }
        for (uint256 i; i != positionsLength; ++i) {
            IStakingPositions.StakedPosition memory position = DiamondStorageLib.getStakedPosition(positionIdentifiers[i]);
            if (position.asset == address(0)) continue;

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(position.balanceSelector));
            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(position.symbol, true)).decimals();
                exposures[ownedAssetsLength + i] = ITokenManager.ExposureUpdate({
                    identifier: position.identifier,
                    decrease: balance * 1e18 / 10**decimals
                });
            }
        }
    }

    function setPartialPrimeAccountAssetsExposure(ITokenManager.ExposureUpdate[] memory exposures, bytes32[] memory assets, bytes32[] memory positionIdentifiers) external {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 ownedAssetsLength = assets.length;
        uint256 exposuresLength = exposures.length;
        for (uint256 i; i != ownedAssetsLength; ++i) {
            bytes32 identifier = assets[i];
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(identifier, true));
            uint256 decrease;
            for (uint256 j; j != exposuresLength; ++j) {
                if (exposures[j].identifier == identifier) {
                    decrease = exposures[j].decrease;
                    break;
                }
            }
            uint256 increase = token.balanceOf(address(this)) * 1e18 / 10**token.decimals();
            _updateProtocolExposure(tokenManager, identifier, decrease, increase);
        }
        uint256 positionsLength = positionIdentifiers.length;
        for (uint256 i; i != positionsLength; ++i) {
            IStakingPositions.StakedPosition memory position = DiamondStorageLib.getStakedPosition(positionIdentifiers[i]);
            if (position.asset == address(0)) continue;

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(position.balanceSelector));
            if (success) {
                bytes32 identifier = position.identifier;
                uint256 decrease;
                for (uint256 j = ownedAssetsLength; j != exposuresLength; ++j) {
                    if (exposures[j].identifier == identifier) {
                        decrease = exposures[j].decrease;
                        break;
                    }
                }
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(position.symbol, true)).decimals();
                uint256 increase = balance * 1e18 / 10**decimals;
                _updateProtocolExposure(tokenManager, identifier, decrease, increase);
            }
        }
    }

    function _updateProtocolExposure(ITokenManager tokenManager, bytes32 identifier, uint256 decrease, uint256 increase) internal {
        if (decrease > increase) {
            tokenManager.decreaseProtocolExposure(identifier, decrease - increase);
        } else if (decrease < increase) {
            tokenManager.increaseProtocolExposure(identifier, increase - decrease);
        }
    }
}
