// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IStakingPositions.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsExposureController {

    function resetPrimeAccountAssetsExposure(bytes32[] memory assets, IStakingPositions.StakedPosition[] memory positions) external {
        if (assets.length == 0) {
            assets = DeploymentConstants.getAllOwnedAssets();
        }
        if (positions.length == 0) {
            positions = DiamondStorageLib.stakedPositions();
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        for(uint i=0; i<assets.length; i++){
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assets[i], true));
            tokenManager.decreaseProtocolExposure(assets[i], token.balanceOf(address(this)) * 1e18 / 10**token.decimals());
        }
        for(uint i=0; i<positions.length; i++){
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                tokenManager.decreaseProtocolExposure(positions[i].identifier, balance * 1e18 / 10**decimals);
            }
        }
    }

    function setPrimeAccountAssetsExposure(bytes32[] memory assets, IStakingPositions.StakedPosition[] memory positions) external {
        if (assets.length == 0) {
            assets = DeploymentConstants.getAllOwnedAssets();
        }
        if (positions.length == 0) {
            positions = DiamondStorageLib.stakedPositions();
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 length = assets.length;
        for(uint i; i != length; ++i){
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assets[i], true));
            tokenManager.increaseProtocolExposure(assets[i], token.balanceOf(address(this)) * 1e18 / 10**token.decimals());
        }
        length = positions.length;
        for(uint i; i != length; ++i){
            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));
            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                uint256 decimals = IERC20Metadata(tokenManager.getAssetAddress(positions[i].symbol, true)).decimals();
                tokenManager.increaseProtocolExposure(positions[i].identifier, balance * 1e18 / 10**decimals);
            }
        }
    }
}
