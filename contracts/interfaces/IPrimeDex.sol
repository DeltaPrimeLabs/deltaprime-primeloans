// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPrimeDex {
    struct AssetInfo {
        bytes32 symbol;
        address asset;
    }

    function convert(
        AssetInfo[] memory assets,
        uint256[] memory amounts,
        uint256[] memory prices,
        AssetInfo memory targetAsset,
        uint256 targetPrice
    ) external returns (uint256);
}
