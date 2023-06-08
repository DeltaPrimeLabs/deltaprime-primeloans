// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract UniswapV3Facet is IUniswapV3Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    using TransferHelper for address;

    bytes32 internal constant OWNED_UNISWAP_V3_POSITIONS_SLOT = bytes32(uint256(keccak256('UNISWAP_V3_POSITIONS_1685370112')) - 1);

    function getOwnedUniswapV3Positions() internal view returns (UniswapV3Position[] storage result){
        bytes32 slot = OWNED_UNISWAP_V3_POSITIONS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
    }

    function addLiquidityUniswapV3(ILBRouter.LiquidityParameters memory liquidityParameters) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        //TODO: check if user can use this particular pool
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
