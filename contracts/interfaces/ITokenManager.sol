interface ITokenManager {
    struct poolAsset {
        bytes32 asset;
        address poolAddress;
    }

    struct Asset {
        bytes32 asset;
        address assetAddress;
        uint256 debtCoverage;
    }

    function debtCoverage ( address ) external view returns ( uint256 );
    function debtCoverageStaked ( bytes32 ) external view returns ( uint256 );
    function getAllPoolAssets (  ) external view returns ( bytes32[] memory result );
    function getAllTokenAssets (  ) external view returns ( bytes32[] memory result );
    function getAssetAddress ( bytes32 _asset, bool allowInactive ) external view returns ( address );
    function getPoolAddress ( bytes32 _asset ) external view returns ( address );
    function getSupportedTokensAddresses (  ) external view returns ( address[] memory);
    function initialize ( Asset[] memory tokenAssets, poolAsset[] memory poolAssets ) external;
    function increaseProtocolExposure ( bytes32 assetIdentifier, uint256 exposureIncrease ) external;
    function decreaseProtocolExposure(bytes32 assetIdentifier, uint256 exposureDecrease) external;
    function isTokenAssetActive ( address token ) external view returns ( bool );
    function owner (  ) external view returns ( address );
    function renounceOwnership (  ) external;
    function tokenAddressToSymbol ( address ) external view returns ( bytes32 );
    function tokenToStatus ( address ) external view returns ( uint256 );
    function transferOwnership ( address newOwner ) external;
    function increasePendingExposure ( bytes32, address , uint256 ) external;
    function decreasePendingExposure ( bytes32, address ) external;
}