// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "../lib/Bytes32EnumerableMap.sol";

interface IDPIntegration{
    enum supportedActions {
        // TODO: Replace BUY/SELL with SWAP once ERC20 Pools are implemented
        BUY,
        SELL,
        STAKE,
        UNSTAKE,
        ADD_LIQUIDITY,
        REMOVE_LIQUIDITY,
        GET_TOTAL_VALUE
    }
    struct Asset {
        bytes32 asset;
        address assetAddress;
    }

    function getIntegrationID() external pure returns(bytes32);

    function sell(bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut, address recipient) external returns (bool);

    function buy(bytes32 _asset, uint256 _exactERC20AmountOut, address recipient) external payable returns (bool);

    function isActionSupported(supportedActions _action) external view returns(bool);

    function getSwapSupportedAssets() external view returns (bytes32[] memory);

    function getSwapAssetAddress(bytes32 _asset) external view returns (address);

    function getLPAssetAddress(bytes32 _asset) external view returns (address);

    function getStakingAssetAddress(bytes32 _asset) external view returns (address);

    function getLPSupportedAssets() external view returns (bytes32[] memory);

    function getStakingSupportedAssets() external view returns (bytes32[] memory);

    function removeSwapSupportedAssets(bytes32[] calldata _assets) external;

    function removeLPSupportedAssets(bytes32[] calldata _assets) external;

    function removeStakingSupportedAssets(bytes32[] calldata _assets) external;

    function updateSwapSupportedAssets(Asset[] memory _assets) external;

    function updateLPSupportedAssets(Asset[] memory _assets) external;

    function updateStakingSupportedAssets(Asset[] memory _assets) external;

    function getMinimumERC20TokenAmountForExactAVAX(bytes32 _asset, uint256 targetAVAXAmount) external returns(uint256);
}
