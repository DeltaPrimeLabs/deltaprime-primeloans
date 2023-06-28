// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
//import "../../lib/uniswap-v3/PoolAddress.sol";
import "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";

contract UniswapV3Facet is IUniswapV3Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    address private constant NONFUNGIBLE_POSITION_MANAGER_ADDRESS = 0xb18a6cf6833130c7A13076D96c7e3784b7F721D1;
    address private constant UNISWAP_V3_FACTORY_ADDRESS = 0x0bD438cB54153C5418E91547de862F21Bc143Ae2;

    using TransferHelper for address;

    uint256 constant MAX_OWNED_UNISWAP_V3_POSITIONS = 10; //TODO: dummy number, update after running gas tests

    //TODO: maybe we should keep here a tuple[tokenId, factory] to account for multiple Uniswap V3 deployments
    bytes32 internal constant OWNED_UNISWAP_V3_TOKEN_IDS_SLOT = bytes32(uint256(keccak256('UNISWAP_V3_TOKEN_IDS_1685370112')) - 1);

    //TODO: kamilovsky please look into that if that is a good solution for storage
    function getOwnedUniswapV3TokenIds() internal view returns (uint256[] storage result){
        bytes32 slot = OWNED_UNISWAP_V3_TOKEN_IDS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
        return result;
    }

    function getWhitelistedUniswapV3Pools() internal view returns (IUniswapV3Pool[1] memory pools){
        return [
            IUniswapV3Pool(0xc79890C726fF34e43E16afA736847900e4fc9c37)
        ];
    }

    //TODO: optimize it (mapping?)
    function isPoolWhitelisted(address pool) internal view returns (bool){
        IUniswapV3Pool[1] memory pools = getWhitelistedUniswapV3Pools();

        for (uint i; i < pools.length; ++i) {
            if (pool == address(pools[i])) return true;
        }
        return false;
    }

    function addLiquidityUniswapV3(INonfungiblePositionManager.MintParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(params.token0, params.token1, params.fee));

        if (!isPoolWhitelisted(poolAddress)) revert UniswapV3PoolNotWhitelisted();

        params.recipient = address(this);

        address(params.token0).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount0Desired);
        address(params.token1).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount1Desired);

        (uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).mint(params);


        if (getOwnedUniswapV3TokenIds().length > MAX_OWNED_UNISWAP_V3_POSITIONS) revert TooManyUniswapV3Positions();
        getOwnedUniswapV3TokenIds().push(tokenId);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        //TODO: not sure if that is the best solution
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(params.token0), params.token0);
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(params.token1), params.token1);

        //TODO: event
    }

    //TODO: increase liquidity
    //TODO: withdraw liquidity
    //TODO: burn?

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // pool must be whitelisted
    error UniswapV3PoolNotWhitelisted();

    error TooManyUniswapV3Positions();
}
