// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDustConverter {
    struct AssetInfo {
        bytes32 symbol;
        address asset;
    }

    /// @notice convert dust assets to $PRIME
    function convert(AssetInfo[] memory) external returns (AssetInfo memory);
}
