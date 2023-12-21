// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPrimeDex {
    struct AssetInfo {
        bytes32 symbol;
        address asset;
    }

    function targetAsset() external view returns (AssetInfo memory);

    function convert(AssetInfo[] memory, uint256[] memory) external returns (AssetInfo memory, uint256);
}
