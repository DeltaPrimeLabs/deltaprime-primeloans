// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e9e05b6e564514c1bcd1b5e49f5e45250e72bf98;
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../helpers/YieldYakSwapHelper.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract YieldYakSwapFacet is ReentrancyGuardKeccak, SolvencyMethods, YieldYakSwapHelper {
    function yakSwap(uint256 _amountIn, uint256 _amountOut, address[] calldata _path, address[] calldata _adapters) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        _yakSwap(_amountIn, _amountOut, _path, _adapters);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
