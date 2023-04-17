// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IStakingPositions.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsExposureController {

    function resetPrimeAccountAssetsExposure() external view returns (ITokenManager.Exposure[] memory exposures) {
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        exposures = new ITokenManager.Exposure[](ownedAssets.length + positions.length);

        for(uint i=0; i<ownedAssets.length; i++){
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssets[i], true));
            exposures[i] = ITokenManager.Exposure({
                identifier: ownedAssets[i],
                decrease: token.balanceOf(address(this)) * 1e18 / 10**token.decimals()
            });
        }
        for(uint i=0; i<positions.length; i++){
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                exposures[ownedAssets.length + i] = ITokenManager.Exposure({
                    identifier: positions[i].identifier,
                    decrease: balance * 1e18 / 10**decimals
                });
            }
        }
    }

    function setPrimeAccountAssetsExposure(ITokenManager.Exposure[] memory exposures) external {
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        for(uint i=0; i<ownedAssets.length; i++){
            bytes32 identifier = ownedAssets[i];
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(identifier, true));
            uint256 decrease;
            for (uint j; j != exposures.length; ++j) {
                if (exposures[j].identifier == identifier) {
                    decrease = exposures[j].decrease;
                    break;
                }
            }
            uint256 increase = token.balanceOf(address(this)) * 1e18 / 10**token.decimals();
            if (decrease > increase) {
                tokenManager.decreaseProtocolExposure(identifier, decrease - increase);
            } else if (decrease < increase) {
                tokenManager.increaseProtocolExposure(identifier, increase - decrease);
            }
        }
        for(uint i=0; i<positions.length; i++){
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                bytes32 identifier = positions[i].identifier;
                uint256 decrease;
                for (uint j; j != exposures.length; ++j) {
                    if (exposures[j].identifier == identifier) {
                        decrease = exposures[j].decrease;
                        break;
                    }
                }
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                uint256 increase = balance * 1e18 / 10**decimals;
                if (decrease > increase) {
                    tokenManager.decreaseProtocolExposure(identifier, decrease - increase);
                } else if (decrease < increase) {
                    tokenManager.increaseProtocolExposure(identifier, increase - decrease);
                }
            }
        }
    }
}
