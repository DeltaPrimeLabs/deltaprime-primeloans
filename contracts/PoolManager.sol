pragma solidity ^0.8.4;

import "./lib/Bytes32EnumerableMap.sol";
import "./interfaces/IAssetsExchange.sol";

contract PoolManager {
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;

    address public admin;
    // Stores an asset's bytes32 symbol representation to pool's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToPoolAddress;
    // Stores an asset's bytes32 symbol representation to asset's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToTokenAddress;

    constructor(IAssetsExchange.Asset[] memory tokenAssets, IAssetsExchange.poolAsset[] memory poolAssets) {
        admin = msg.sender;
        emit AdminChanged(msg.sender, msg.sender, block.timestamp);
        addTokenAssets(tokenAssets);
        addPoolAssets(poolAssets);
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
        emit AdminChanged(msg.sender, _newAdmin, block.timestamp);
    }

    function getAllPoolAssets() public view returns (bytes32[] memory result) {
        return assetToPoolAddress._inner._keys._inner._values;
    }

    function getAllTokenAssets() public view returns (bytes32[] memory result) {
        return assetToTokenAddress._inner._keys._inner._values;
    }

    /**
    * Returns address of an asset
    **/
    function getAssetAddress(bytes32 _asset) public view returns (address) {
        (, address assetAddress) = assetToTokenAddress.tryGet(_asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    /**
    * Returns address of an asset's lending pool
    **/
    function getPoolAddress(bytes32 _asset) public view returns (address) {
        (, address assetAddress) = assetToPoolAddress.tryGet(_asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function addPoolAssets(IAssetsExchange.poolAsset[] memory poolAssets) public onlyAdmin {
        for(uint256 i=0; i<poolAssets.length; i++) {
            _addPoolAsset(poolAssets[i].asset, poolAssets[i].poolAddress);
        }
    }

    function addTokenAssets(IAssetsExchange.Asset[] memory tokenAssets) public onlyAdmin {
        for(uint256 i=0; i<tokenAssets.length; i++) {
            _addTokenAsset(tokenAssets[i].asset, tokenAssets[i].assetAddress);
        }
    }


    function _addPoolAsset(bytes32 _asset, address _poolAddress) internal {
        require(!assetToPoolAddress.contains(_asset), "Asset's pool already exists");
        assetToPoolAddress.set(_asset, _poolAddress);
        // TODO: Emit event
    }

    function removePoolAsset(bytes32 _asset) public onlyAdmin {
        // TODO: Add some check reg. pool's utilisation / state prior to removing it from the manager?
        // TODO: Emit event
        revert("Not implemented");
    }

    function _addTokenAsset(bytes32 _asset, address _tokenAddress) internal {
        require(_asset != "", "Cannot set an empty string asset.");
        require(_tokenAddress != address(0), "Cannot set an empty address.");
        require(!assetToTokenAddress.contains(_asset), "Asset's token already exists");
        assetToTokenAddress.set(_asset, _tokenAddress);
        // TODO: Emit event
    }

    function removeTokenAsset(bytes32 _asset) public onlyAdmin {
        // TODO: Add some check reg. token's usage prior to removing it from the manager?
        // TODO: Emit event
        revert("Not implemented");
    }

    modifier onlyAdmin {
        require(msg.sender == admin, "Admin only");
        _;
    }

    event AdminChanged(address indexed user, address newAdmin, uint256 timestamp);
}
