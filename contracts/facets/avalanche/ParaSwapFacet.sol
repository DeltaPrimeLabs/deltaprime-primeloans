// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e9e05b6e564514c1bcd1b5e49f5e45250e72bf98;
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../helpers/ParaSwapHelper.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../lib/SolvencyMethods.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract ParaSwapFacet is ReentrancyGuardKeccak, SolvencyMethods, ParaSwapHelper {
    using TransferHelper for address;

    address private constant PARA_TRANSFER_PROXY = 0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address private constant PARA_ROUTER = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    function paraSwap(IParaSwapRouter.SimpleData memory data) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        _paraSwap(data);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
