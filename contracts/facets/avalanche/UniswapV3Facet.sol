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

    //TODO: kamilovsky please look into that if that is a good solution for storage
    function getOwnedUniswapV3Positions() internal view returns (UniswapV3Position[] storage result){
        bytes32 slot = OWNED_UNISWAP_V3_POSITIONS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
    }

    function getWhitelistedUniswapV3Pools() internal view returns (IUniswapV3Pool[] memory pools){
        return [
            //TODO: update to existing pool
            IUniswapV3Pool(0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30)
        ];
    }

    //TODO: optimize it (mapping?)
    function isPoolWhitelisted(IUniswapV3Pool pool) internal view returns (bool){
        IUniswapV3Pool[] memory pools = getWhitelistedUniswapV3Pools();

        for (uint i; i < pools.length; ++i) {
            if (address(pool) == address(pools[i])) return true;
        }
        return false;
    }

    function addLiquidityUniswapV3(IUniswapV3Pool pool, int24 tickLower, int24 tickUpper, uint128 amount) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        if (!isPoolWhitelisted(pool)) revert UniswapV3PoolNotWhitelisted();

        pool.mint(
            address(this),
            tickLower,
            tickUpper,
            amount
        );

        getOwnedUniswapV3Positions().push(UniswapV3Position(pool, tickLower, tickUpper));

        //TODO: not sure if that is the best solution
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(pool.token0()), pool.token0());
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(pool.token1()), pool.token1());

        //TODO: event
    }

    //TODO: withdraw liquidity

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // pool must be whitelisted
    error UniswapV3PoolNotWhitelisted();
}
