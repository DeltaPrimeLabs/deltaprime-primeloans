// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "./lib/Bytes32EnumerableMap.sol";
import "./interfaces/IAssetsExchange.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract TokenManager {
    /**
     * For adding supported assets
     **/
    struct Asset {
        bytes32 asset;
        address assetAddress;
    }

    /**
     * For adding supported lending pools
     **/
    struct poolAsset {
        bytes32 asset;
        address poolAddress;
    }
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;

    uint256 private constant _NOT_SUPPORTED = 0;
    uint256 private constant _INACTIVE = 1;
    uint256 private constant _ACTIVE = 2;

    address public admin;
    // Stores an asset's bytes32 symbol representation to pool's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToPoolAddress;
    // Stores an asset's bytes32 symbol representation to asset's address mapping
    EnumerableMap.Bytes32ToAddressMap private assetToTokenAddress;

    address public adminTransferProposal;

    mapping(address => uint256) public tokenToStatus;

    constructor(Asset[] memory tokenAssets, poolAsset[] memory poolAssets) {
        admin = msg.sender;
        emit AdminChanged(address(0), msg.sender, block.timestamp);
        addTokenAssets(tokenAssets);
        addPoolAssets(poolAssets);
    }

    // Set to address(0) to reset proposal
    function proposeAdminTransfer(address _newOwner) onlyAdmin public {
        adminTransferProposal = _newOwner;
    }

    function executeAdminTransfer() public {
        require(adminTransferProposal != address(0), "There is no active admin transfer proposal");
        require(adminTransferProposal == msg.sender, "Only the proposed new admin can execute admin transfer proposal");
        address oldAdmin = admin;
        admin = adminTransferProposal;
        adminTransferProposal = address(0);
        emit AdminChanged(oldAdmin, msg.sender, block.timestamp);
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
    function getAssetAddress(bytes32 _asset, bool allowInactive) public view returns (address) {
        (, address assetAddress) = assetToTokenAddress.tryGet(_asset);
        require(assetAddress != address(0), "Asset not supported.");
        if(!allowInactive) {
            require(tokenToStatus[assetAddress] == _ACTIVE, "Asset inactive");
        }

        return assetAddress;
    }

    /**
    * Returns address of an asset's lending pool
    **/
    function getPoolAddress(bytes32 _asset) public view returns (address) {
        (, address assetAddress) = assetToPoolAddress.tryGet(_asset);
        require(assetAddress != address(0), "Pool asset not supported.");

        return assetAddress;
    }

    function addPoolAssets(poolAsset[] memory poolAssets) public onlyAdmin {
        for(uint256 i=0; i<poolAssets.length; i++) {
            _addPoolAsset(poolAssets[i].asset, poolAssets[i].poolAddress);
        }
    }

    function _addPoolAsset(bytes32 _asset, address _poolAddress) internal {
        require(Address.isContract(_poolAddress), "TokenManager: Pool must be a contract");
        require(!assetToPoolAddress.contains(_asset), "Asset's pool already exists");
        assetToPoolAddress.set(_asset, _poolAddress);
        emit PoolAssetAdded(msg.sender, _asset, _poolAddress, block.timestamp);
    }

    function addTokenAssets(Asset[] memory tokenAssets) public onlyAdmin {
        for(uint256 i=0; i<tokenAssets.length; i++) {
            _addTokenAsset(tokenAssets[i].asset, tokenAssets[i].assetAddress);
        }
    }

    function activateToken(address token) public onlyAdmin {
        require(tokenToStatus[token] == _INACTIVE, "Must be inactive");
        tokenToStatus[token] = _ACTIVE;
        emit TokenAssetDeactivated(msg.sender, token, block.timestamp);
    }

    function deactivateToken(address token) public onlyAdmin {
        require(tokenToStatus[token] == _ACTIVE, "Must be active");
        tokenToStatus[token] = _INACTIVE;
        emit TokenAssetDeactivated(msg.sender, token, block.timestamp);
    }

    function _addTokenAsset(bytes32 _asset, address _tokenAddress) internal {
        require(_asset != "", "Cannot set an empty string asset.");
        require(_tokenAddress != address(0), "Cannot set an empty address.");
        require(!assetToTokenAddress.contains(_asset), "Asset's token already exists");
        assetToTokenAddress.set(_asset, _tokenAddress);
        tokenToStatus[_tokenAddress] = _ACTIVE;
        emit TokenAssetAdded(msg.sender, _asset, _tokenAddress, block.timestamp);
    }

    function removeTokenAssets(bytes32[] memory _tokenAssets) public onlyAdmin{
        for(uint256 i=0; i<_tokenAssets.length; i++) {
            _removeTokenAsset(_tokenAssets[i]);
        }
    }

    function _removeTokenAsset(bytes32 _tokenAsset) internal {
        address tokenAddress = getAssetAddress(_tokenAsset, true);
        EnumerableMap.remove(assetToTokenAddress, _tokenAsset);
        tokenToStatus[tokenAddress] = _NOT_SUPPORTED;
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

    event AdminChanged(address indexed olAdmin, address newAdmin, uint256 timestamp);

    /**
     * @dev emitted after adding a token asset
     * @param performer an address of the wallet adding a token asset
     * @param tokenAsset token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of adding a token asset
     **/
    event TokenAssetAdded(address indexed performer, bytes32 indexed tokenAsset, address assetAddress, uint256 timestamp);

    /**
     * @dev emitted after deactivating a token asset
     * @param performer an address of the wallet deactivating a token asset
     * @param assetAddress an address of the token asset
     * @param timestamp time of deactivating a token asset
     **/
    event TokenAssetDeactivated(address indexed performer, address assetAddress, uint256 timestamp);

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
