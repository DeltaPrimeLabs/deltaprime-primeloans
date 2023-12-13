// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: b3669c6573ea2a912832a0c29e4bf62b96fc58b7;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../ReentrancyGuardKeccak.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/IWrappedNativeToken.sol";
import "../../interfaces/IGgAvax.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GogoPoolFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    address private constant GG_AVAX =
        0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3;

    function swapToGgAvax(uint256 _amount)
        external
        nonReentrant
        onlyOwner
        recalculateAssetsExposure
        remainsSolvent
    {
        IWrappedNativeToken wrapped = IWrappedNativeToken(DeploymentConstants.getNativeToken());
        _amount = Math.min(wrapped.balanceOf(address(this)), _amount);
        require(_amount > 0, "Amount has to be greater than 0");

        wrapped.withdraw(_amount);

        IGgAvax ggAvax = IGgAvax(GG_AVAX);

        ggAvax.depositAVAX{value: _amount}();

        // Add asset to ownedAssets
        if (IERC20(GG_AVAX).balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("ggAVAX", GG_AVAX);
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if (IERC20(address(wrapped)).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("AVAX");
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}
}
