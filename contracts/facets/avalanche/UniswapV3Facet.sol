// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/joe-v2/ILBRouter.sol";
import "../../interfaces/joe-v2/ILBFactory.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";

contract UniswapV3Facet is IUniswapV3Facet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {

    address private constant NONFUNGIBLE_POSITION_MANAGER_ADDRESS = 0xb18a6cf6833130c7A13076D96c7e3784b7F721D1;
    address private constant UNISWAP_V3_FACTORY_ADDRESS = 0x0bD438cB54153C5418E91547de862F21Bc143Ae2;

    using TransferHelper for address;

    uint256 constant MAX_OWNED_UNISWAP_V3_POSITIONS = 10; //TODO: dummy number, update after running gas tests

    //TODO: maybe we should keep here a tuple[tokenId, factory] to account for multiple Uniswap V3 deployments
    bytes32 internal constant OWNED_UNISWAP_V3_TOKEN_IDS_SLOT = bytes32(uint256(keccak256('UNISWAP_V3_TOKEN_IDS_1685370112')) - 1);

    //TODO: kamilovsky please look into that if that is a good solution for storage
    function getTokenIds() internal view returns (uint256[] storage result){
        bytes32 slot = OWNED_UNISWAP_V3_TOKEN_IDS_SLOT;
        assembly{
            result.slot := sload(slot)
        }
        return result;
    }

    function getOwnedUniswapV3TokenIds() public view returns (uint256[] memory result){
        return getTokenIds();
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

    function mintLiquidityUniswapV3(INonfungiblePositionManager.MintParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(params.token0, params.token1, params.fee));

        if (!isPoolWhitelisted(poolAddress)) revert UniswapV3PoolNotWhitelisted();

        params.recipient = address(this);

        //TODO: check for max and min ticks
        address(params.token0).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount0Desired);
        address(params.token1).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount1Desired);

        (uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).mint(params);

        if (getTokenIds().length > MAX_OWNED_UNISWAP_V3_POSITIONS) revert TooManyUniswapV3Positions();
        getTokenIds().push(tokenId);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        //TODO: check amount0 and amount1
        emit AddLiquidityUniswapV3(msg.sender, poolAddress, tokenId, tokenManager.tokenAddressToSymbol(params.token0), tokenManager.tokenAddressToSymbol(params.token1), liquidity, amount0, amount1, block.timestamp);
    }

    function increaseLiquidityUniswapV3(INonfungiblePositionManager.IncreaseLiquidityParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        (
        ,,
        address token0,
        address token1,
        uint24 fee,
        ,,
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).positions(params.tokenId);

        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(token0, token1, fee));

        if (!isPoolWhitelisted(poolAddress)) revert UniswapV3PoolNotWhitelisted();

        address(token0).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount0Desired);
        address(token1).safeApprove(address(NONFUNGIBLE_POSITION_MANAGER_ADDRESS), params.amount1Desired);

        (
        ,
        uint256 amount0,
        uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).increaseLiquidity(params);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        emit IncreaseLiquidityUniswapV3(msg.sender, poolAddress, params.tokenId, tokenManager.tokenAddressToSymbol(token0), tokenManager.tokenAddressToSymbol(token1), amount0, amount1, block.timestamp);
    }

    function decreaseLiquidityUniswapV3(INonfungiblePositionManager.DecreaseLiquidityParams memory params) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure onlyOwnerOrInsolvent {
        (
        ,,
        address token0,
        address token1,
        uint24 fee,
        ,,
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).positions(params.tokenId);
        address poolAddress = PoolAddress.computeAddress(UNISWAP_V3_FACTORY_ADDRESS, PoolAddress.getPoolKey(token0, token1, fee));

        (
            uint256 amount0,
            uint256 amount1
        ) = INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).decreaseLiquidity(params);

        //TODO: check risks of uint256 to uint128 conversion
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams(params.tokenId, address(this), uint128(amount0), uint128(amount1));

        INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).collect(collectParams);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        emit DecreaseLiquidityUniswapV3(msg.sender, poolAddress, params.tokenId, tokenManager.tokenAddressToSymbol(token0), tokenManager.tokenAddressToSymbol(token1), amount0, amount1, block.timestamp);
    }

    function burnLiquidityUniswapV3(uint256 tokenId) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure onlyOwnerOrInsolvent {
        for (uint256 i; i < getTokenIds().length; i++) {
            if (getTokenIds()[i] == tokenId) {
                INonfungiblePositionManager(NONFUNGIBLE_POSITION_MANAGER_ADDRESS).burn(tokenId);
                getTokenIds()[i] = getTokenIds()[getTokenIds().length - 1];
                getTokenIds().pop();
                emit BurnLiquidityUniswapV3(msg.sender, tokenId, block.timestamp);

                break;
            }
        }
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // pool must be whitelisted
    error UniswapV3PoolNotWhitelisted();

    error TooManyUniswapV3Positions();

    /**
     * @dev emitted after minting liquidity
     * @param user the address of user providing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param liquidity amount of liquidity (LP token) added
     * @param firstAmount amount of the first asset used
     * @param secondAmount amount of the second asset used
     * @param timestamp time of the transaction
     **/
    event AddLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after increasing liquidity
     * @param user the address of user providing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset provided for liquidity
     * @param secondAsset second asset provided for liquidity
     * @param firstAmount amount of the first asset used
     * @param secondAmount amount of the second asset used
     * @param timestamp time of the transaction
     **/
    event IncreaseLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after decreasing liquidity
     * @param user the address of user decreasing liquidity
     * @param pool UniswapV3 pool
     * @param tokenId the if of NFT LP position
     * @param firstAsset first asset received
     * @param secondAsset second asset received
     * @param firstAmount amount of the first asset received
     * @param secondAmount amount of the second asset received
     * @param timestamp time of the transaction
     **/
    event DecreaseLiquidityUniswapV3(address indexed user, address indexed pool, uint256 indexed tokenId, bytes32 firstAsset, bytes32 secondAsset, uint firstAmount, uint secondAmount, uint256 timestamp);

    /**
     * @dev emitted after burning Uniswap V3 token
     * @param user the address of user decreasing liquidity
     * @param tokenId the if of NFT LP position
     * @param timestamp time of the transaction
     **/
    event BurnLiquidityUniswapV3(address indexed user, uint256 tokenId, uint256 timestamp);

}
