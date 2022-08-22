pragma solidity ^0.8.4;

import "./lib/Bytes32EnumerableMap.sol";
import "./interfaces/IAssetsExchange.sol";
import "@openzeppelin/contracts/utils/Address.sol";

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

    function _addPoolAsset(bytes32 _asset, address _poolAddress) internal {
        require(Address.isContract(_poolAddress), "PoolManager: Pool must be a contract");
        require(!assetToPoolAddress.contains(_asset), "Asset's pool already exists");
        assetToPoolAddress.set(_asset, _poolAddress);
        emit PoolAssetAdded(msg.sender, _asset, _poolAddress, block.timestamp);
    }

    function addTokenAssets(IAssetsExchange.Asset[] memory tokenAssets) public onlyAdmin {
        for(uint256 i=0; i<tokenAssets.length; i++) {
            _addTokenAsset(tokenAssets[i].asset, tokenAssets[i].assetAddress);
        }
    }

    function _addTokenAsset(bytes32 _asset, address _tokenAddress) internal {
        require(_asset != "", "Cannot set an empty string asset.");
        require(_tokenAddress != address(0), "Cannot set an empty address.");
        require(!assetToTokenAddress.contains(_asset), "Asset's token already exists");
        assetToTokenAddress.set(_asset, _tokenAddress);
        emit TokenAssetAdded(msg.sender, _asset, _tokenAddress, block.timestamp);
    }

    function removeTokenAssets(bytes32[] memory _tokenAssets) public onlyAdmin{
        for(uint256 i=0; i<_tokenAssets.length; i++) {
            _removeTokenAsset(_tokenAssets[i]);
        }
    }

    function _removeTokenAsset(bytes32 _tokenAsset) internal {
        EnumerableMap.remove(assetToTokenAddress, _tokenAsset);
        emit TokenAssetRemoved(msg.sender, _tokenAsset, block.timestamp);
    }

    function removePoolAssets(bytes32[] memory _poolAssets) public onlyAdmin {
        for(uint256 i=0; i<_poolAssets.length; i++) {
            _removePoolAsset(_poolAssets[i]);
        }
    }

    function _removePoolAsset(bytes32 _poolAsset) internal {
        EnumerableMap.remove(assetToPoolAddress, _poolAsset);
        emit PoolAssetRemoved(msg.sender, _poolAsset, block.timestamp);
    }

    modifier onlyAdmin {
        require(msg.sender == admin, "Admin only");
        _;
    }

    event AdminChanged(address indexed user, address newAdmin, uint256 timestamp);

    /**
     * @dev emitted after adding a token asset
     * @param performer an address of the wallet adding a token asset
     * @param tokenAsset token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of adding a token asset
     **/
    event TokenAssetAdded(address indexed performer, bytes32 indexed tokenAsset, address assetAddress, uint256 timestamp);

    /**
     * @dev emitted after removing a token asset
     * @param performer an address of the wallet removing a token asset
     * @param tokenAsset token asset
     * @param timestamp time a token asset removal
     **/
    event TokenAssetRemoved(address indexed performer, bytes32 indexed tokenAsset, uint256 timestamp);

    /**
     * @dev emitted after adding a pool asset
     * @param performer an address of wallet adding the pool asset
     * @param poolAsset pool asset
     * @param poolAssetAddress an address of the pool asset
     * @param timestamp time of the pool asset addition
     **/
    event PoolAssetAdded(address indexed performer, bytes32 indexed poolAsset, address poolAssetAddress, uint256 timestamp);

    /**
     * @dev emitted after removing a pool asset
     * @param performer an address of wallet removing the pool asset
     * @param poolAsset pool asset
     * @param timestamp time of a pool asset removal
     **/
    event PoolAssetRemoved(address indexed performer, bytes32 indexed poolAsset, uint256 timestamp);
}
