pragma solidity ^0.8.4;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/IDPIntegration.sol";

abstract contract DPIntegration is OwnableUpgradeable, IDPIntegration{
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using TransferHelper for address payable;
    using TransferHelper for address;

    EnumerableMap.Bytes32ToAddressMap internal swapSupportedAssets;
    EnumerableMap.Bytes32ToAddressMap internal stakingSupportedAssets;
    EnumerableMap.Bytes32ToAddressMap internal lpSupportedAssets;

    address private constant WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    receive() external payable {}

    // GET ASSETS

    function getSwapSupportedAssets() external view override returns (bytes32[] memory result) {
        return swapSupportedAssets._inner._keys._inner._values;
    }

    function getLPSupportedAssets() external view override returns (bytes32[] memory result) {
        return lpSupportedAssets._inner._keys._inner._values;
    }

    function getStakingSupportedAssets() external view override returns (bytes32[] memory result) {
        return stakingSupportedAssets._inner._keys._inner._values;
    }

    function getStakingContract(bytes32 _asset) public view override virtual returns (StakingToken) {
        return StakingToken(address(0));
    }

    function getSwapAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(swapSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function getLPAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(lpSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    function getStakingAssetAddress(bytes32 _asset) public view override returns (address) {
        (, address assetAddress) = EnumerableMap.tryGet(stakingSupportedAssets, _asset);
        require(assetAddress != address(0), "Asset not supported.");

        return assetAddress;
    }

    // UPDATE ASSETS

    function _updateAssets(EnumerableMap.Bytes32ToAddressMap storage map, Asset[] memory _assets) internal {
        if(_assets.length > 0) {
            for (uint256 i = 0; i < _assets.length; i++) {
                require(_assets[i].asset != "", "Cannot set an empty string asset.");
                require(_assets[i].assetAddress != address(0), "Cannot set an empty address.");

                EnumerableMap.set(map, _assets[i].asset, _assets[i].assetAddress);
            }

            emit AssetsAdded(_assets);
        }
    }

    function updateSwapSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(swapSupportedAssets, _assets);
    }

    function updateLPSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(lpSupportedAssets, _assets);
    }

    function updateStakingSupportedAssets(Asset[] calldata _assets) external override onlyOwner {
        _updateAssets(stakingSupportedAssets, _assets);
    }


    // REMOVE ASSETS

    function _removeAssets(EnumerableMap.Bytes32ToAddressMap storage map, bytes32[] calldata _assets) internal {
        for (uint256 i = 0; i < _assets.length; i++) {
            EnumerableMap.remove(map, _assets[i]);
        }
        emit AssetsRemoved(_assets);
    }

    function removeSwapSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(swapSupportedAssets, _assets);
    }

    function removeLPSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(lpSupportedAssets, _assets);
    }

    function removeStakingSupportedAssets(bytes32[] calldata _assets) external override onlyOwner {
        _removeAssets(stakingSupportedAssets, _assets);
    }


    // ADDITIONAL METHODS
    function isActionSupported(supportedActions _action) override virtual public view returns(bool) {
        if (_action == supportedActions.BUY || _action == supportedActions.SELL) {
            return swapSupportedAssets.length() > 0;
        } else if (_action == supportedActions.STAKE || _action == supportedActions.UNSTAKE) {
            return stakingSupportedAssets.length() > 0;
        } else if (_action == supportedActions.ADD_LIQUIDITY || _action == supportedActions.REMOVE_LIQUIDITY) {
            return lpSupportedAssets.length() > 0;
        }
        return false;
    }

    function isActionSupported(supportedActions _action, bytes32 _asset) override virtual public view returns(bool) {
        if (_action == supportedActions.BUY || _action == supportedActions.SELL) {
            return EnumerableMap.contains(swapSupportedAssets, _asset);
        } else if (_action == supportedActions.STAKE || _action == supportedActions.UNSTAKE) {
            return EnumerableMap.contains(stakingSupportedAssets, _asset);
        } else if (_action == supportedActions.ADD_LIQUIDITY || _action == supportedActions.REMOVE_LIQUIDITY) {
            return EnumerableMap.contains(lpSupportedAssets, _asset);
        }
        return false;
    }

    function getPathForTokenToAVAX(address _token) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = WAVAX_ADDRESS;
        return path;
    }

    function getPathForAVAXtoToken(address _token) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = WAVAX_ADDRESS;
        path[1] = _token;
        return path;
    }


    // STAKING METHODS
    function stakeFor(bytes32 _asset, uint256 _amount, address _recipient) external payable override virtual returns(bool result) {
        return false;
    }

    function unstake(bytes32 _asset, uint256 _amount, address _recipient) external override virtual returns (bool) {
        return false;
    }

    function getTotalStakedValue(address _owner) public view override virtual returns (uint256 totalValue) {
        return 0;
    }

    // SWAPPING METHODS
    function buy(bytes32 _asset, uint256 _exactERC20AmountOut, address recipient) external payable override virtual returns(bool) {
        return false;
    }

    function sell(bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut, address recipient) external override virtual returns(bool) {
        return false;
    }

    function getMinimumERC20TokenAmountForExactAVAX(bytes32 _asset, uint256 targetAVAXAmount) override virtual public returns(uint256){
        return 0;
    }

    // SELLOUT

    // TODO: Pass owned assets as a parameter not to loop through all supported assets
    function selloutForTargetAvax(uint256 _amount) external returns (uint256 soldOutAvax){
        soldOutAvax = 0;
        if (isActionSupported(supportedActions.SELL)) {
            soldOutAvax += selloutSwapAssetsForTargetAvax(_amount - soldOutAvax);
            if (soldOutAvax >= _amount) return soldOutAvax;
        }
        if (isActionSupported(supportedActions.UNSTAKE)) {
            soldOutAvax += selloutStakingAssetsForTargetAvax(_amount - soldOutAvax);
            if (soldOutAvax >= _amount) return soldOutAvax;
        }
        if (isActionSupported(supportedActions.REMOVE_LIQUIDITY)) {
            soldOutAvax += selloutLPAssetsForTargetAvax(_amount - soldOutAvax);
            if (soldOutAvax >= _amount) return soldOutAvax;
        }
    }

    function selloutSwapAssetsForTargetAvax(bytes32 _asset, uint256 amount, address _recipient) override virtual public returns (uint256 soldOutAvax) {
        bytes32 key;
        address assetAddress;
        soldOutAvax = 0;
        for(uint256 i=0; i < swapSupportedAssets.length(); i++) {
            (key, assetAddress) = swapSupportedAssets.get(i);
            sell(key, IERC20(assetAddress).balanceOf())
        }
    }

    function selloutStakingAssetsForTargetAvax(bytes32 _asset, uint256 amount, address _recipient) override virtual public returns (uint256) {
        return 0;
    }

    function selloutLPAssetsForTargetAvax(bytes32 _asset, uint256 amount, address _recipient) override virtual public returns (uint256) {
        return 0;
    }

    // LIQUIDITY PROVISION METHODS

    // TODO: Add LP methods


    // EVENTS

    event AssetsAdded(Asset[] assets);

    event AssetsRemoved(bytes32[] removedAssets);

    event TokenPurchase(address indexed buyer, uint256 amount, uint256 timestamp, bool success);

    event TokenSell(address indexed seller, uint256 amount, uint256 timestamp, bool success);

    /**
   * @dev emitted when user stakes an asset
   * @param user the address executing staking
   * @param asset the asset that was staked
   * @param amount of the asset that was staked
   * @param timestamp of staking
   **/
    event Staked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
   * @dev emitted when user unstakes an asset
   * @param user the address executing unstaking
   * @param asset the asset that was unstaked
   * @param amount of the asset that was unstaked
   * @param timestamp of unstaking
   **/
    event Unstaked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}

