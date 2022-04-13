// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../lib/Bytes32EnumerableMap.sol";
import "../interfaces/IDPIntegration.sol";

contract DPRouterV1 is OwnableUpgradeable {
    struct Integration {
        bytes32 integrationID;
        address integrationAddress;
    }

    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using TransferHelper for address payable;
    using TransferHelper for address;

    EnumerableMap.Bytes32ToAddressMap internal supportedIntegrations;

    function initialize(Integration[] calldata _integrations) external initializer {
        addIntegrations(_integrations);
        __Ownable_init();
    }

    function _getIntegration(bytes32 _integration) private view returns(IDPIntegration) {
        return IDPIntegration(supportedIntegrations.get(_integration));
    }

    function getIntegrationIDSupportingAsset(bytes32 _asset, IDPIntegration.supportedActions _action) internal view returns (bytes32){
        for(uint i=0; i<supportedIntegrations.length(); i++) {
            (bytes32 integrationID, address integrationAddress) = supportedIntegrations.at(i);
            IDPIntegration integration = IDPIntegration(integrationAddress);
            if (integration.isActionSupported(_action, _asset)) {
                return integrationID;
            }
        }
        revert("Asset & action not supported");
    }

    function validateIntegration(Integration memory _integration) internal {
        require(_integration.integrationID != "", "Cannot set an empty string integrationID");
        require(_integration.integrationAddress != address(0), "Cannot set an empty address");
        require(!supportedIntegrations.contains(_integration.integrationID), "Integration already exists");
        for(uint i=0; i < supportedIntegrations.length(); i++) {
            (, address integrationAddress) = supportedIntegrations.at(i);
            require(integrationAddress != _integration.integrationAddress, "Integration address already in use");
        }
    }

    function _addIntegration(Integration memory _integration) internal {
        supportedIntegrations.set(_integration.integrationID, _integration.integrationAddress);
    }

    function addIntegrations(Integration[] memory _integrations) internal {
        for (uint i=0; i < _integrations.length; i++) {
            validateIntegration(_integrations[i]);
            _addIntegration(_integrations[i]);
        }
    }
    
    function addIntegration(Integration calldata _integration) public onlyOwner {
        validateIntegration(_integration);
        _addIntegration(_integration);
    }


    // TODO: implement for LP
    function getSwapAssetAddress(bytes32 _asset) public view returns(address) {
        return _getIntegration(getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.BUY)).getSwapAssetAddress(_asset);
    }

    function getStakingAssetAddress(bytes32 _asset) public view returns(address) {
        return _getIntegration(getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.STAKE)).getStakingAssetAddress(_asset);
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function buy(bytes32 _integrationID, bytes32 _asset, uint256 _exactERC20AmountOut) external payable supportsAction(_integrationID, IDPIntegration.supportedActions.BUY) returns(bool) {
        if (_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.BUY);
        }
        (bool success, ) = address(_getIntegration(_integrationID)).call{value: msg.value}(
            abi.encodeWithSignature("buy(bytes32,uint256,address)", _asset, _exactERC20AmountOut, msg.sender)
        );
        return success;
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function sell(bytes32 _integrationID, bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut) external supportsAction(_integrationID, IDPIntegration.supportedActions.SELL) returns(bool) {
        if (_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.SELL);
        }
        IDPIntegration integration = _getIntegration(_integrationID);
        IERC20Metadata token = IERC20Metadata(integration.getSwapAssetAddress(_asset));
        address(token).safeTransfer(address(integration), _exactERC20AmountIn);

        (bool success, ) = address(_getIntegration(_integrationID)).call(
            abi.encodeWithSignature("sell(bytes32,uint256,uint256,address)", _asset, _exactERC20AmountIn, _minAvaxAmountOut, msg.sender)
        );
        return success;
    }

    function stakeFor(bytes32 _integrationID, bytes32 _asset, uint256 _amount) external payable supportsAction(_integrationID, IDPIntegration.supportedActions.STAKE) returns(bool) {
        if (_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.STAKE);
        }
        IDPIntegration integration = _getIntegration(_integrationID);
        bool success = integration.stakeFor{value: _amount}(_asset, _amount, msg.sender);
        return success;
    }

    function getStakingContract(bytes32 _integrationID, bytes32 _asset) public view returns (StakingToken) {
        if (_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.STAKE);
        }
        IDPIntegration integration = _getIntegration(_integrationID);
        return integration.getStakingContract(_asset);
    }

    function getTotalStakedValue(bytes32 _integrationID) external view returns (uint256 totalValue) {
        return _getIntegration(_integrationID).getTotalStakedValue(msg.sender);
    }

    function unstake(bytes32 _integrationID, bytes32 _asset, uint256 _amount) external supportsAction(_integrationID, IDPIntegration.supportedActions.UNSTAKE) returns(bool) {
        if (_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.UNSTAKE);
        }
        IDPIntegration integration = _getIntegration(_integrationID);
        StakingToken stakingContract = getStakingContract(_integrationID, _asset);
        stakingContract.approve(address(integration), _amount);
        bool success = integration.unstake(_asset, _amount, msg.sender);
        if (!success) {
            address(stakingContract).safeTransfer(msg.sender, _amount);
        }
        payable(msg.sender).safeTransferETH(address(this).balance);
        return success;
    }

    function unstakeAssetForASpecifiedAmount(bytes32 _asset, uint256 _amount) external {
        IDPIntegration integration = _getIntegration(getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.UNSTAKE));
        StakingToken stakingContract = getStakingContract(integration.getIntegrationID(), _asset);
        stakingContract.approve(address(integration), stakingContract.balanceOf(address(this)));

        integration.unstakeAssetForASpecifiedAmount(_asset, _amount, msg.sender);

        address(stakingContract).safeTransfer(msg.sender, stakingContract.balanceOf(address(this)));
    }

    receive() external payable {}

    function addLiquidity(bytes32 _integrationID, bytes32 _asset1, bytes32 _asset2) internal supportsAction(_integrationID, IDPIntegration.supportedActions.ADD_LIQUIDITY) returns(bool) {
        // TODO: implement
        return false;
    }

    function removeLiquidity(bytes32 _integrationID, bytes32 _asset1, bytes32 _asset2) internal supportsAction(_integrationID, IDPIntegration.supportedActions.REMOVE_LIQUIDITY) returns(bool) {
        // TODO: implement
        return false;
    }

    function getSwapIntegrations() public view returns(bytes32[] memory) {
        // TODO: Variable length arrays not available in memory
        bytes32[] memory swapIntegrations = new bytes32[](supportedIntegrations.length());
        for(uint i=0; i<supportedIntegrations.length(); i++) {
            (bytes32 integrationID, address integrationAddress) = supportedIntegrations.at(i);
            IDPIntegration integration = IDPIntegration(integrationAddress);
            // TODO: Replace with swap() once ERC20 pools are implemented
            if (integration.isActionSupported(IDPIntegration.supportedActions.BUY)) {
                swapIntegrations[i] = integrationID;
            }
        }
        return swapIntegrations;
    }

    function getLPIntegrations() public view returns(bytes32[] memory) {
        // TODO: Variable length arrays not available in memory
        bytes32[] memory lpIntegrations = new bytes32[](supportedIntegrations.length());
        for(uint i=0; i<supportedIntegrations.length(); i++) {
            (bytes32 integrationID, address integrationAddress) = supportedIntegrations.at(i);
            IDPIntegration integration = IDPIntegration(integrationAddress);
            if (integration.isActionSupported(IDPIntegration.supportedActions.ADD_LIQUIDITY)) {
                lpIntegrations[i] = integrationID;
            }
        }
        return lpIntegrations;
    }

    function getStakingIntegrations() public view returns(bytes32[] memory) {
        // TODO: Variable length arrays not available in memory
        bytes32[] memory stakingIntegrations = new bytes32[](supportedIntegrations.length());
        for(uint i=0; i<supportedIntegrations.length(); i++) {
            (bytes32 integrationID, address integrationAddress) = supportedIntegrations.at(i);
            IDPIntegration integration = IDPIntegration(integrationAddress);
            if (integration.isActionSupported(IDPIntegration.supportedActions.STAKE)) {
                stakingIntegrations[i] = integrationID;
            }
        }
        return stakingIntegrations;
    }

    function getMinimumERC20TokenAmountForExactAVAX(bytes32 _integrationID, bytes32 _asset, uint256 targetAVAXAmount) public returns(uint256){
        if(_integrationID == "ANY") {
            _integrationID = getIntegrationIDSupportingAsset(_asset, IDPIntegration.supportedActions.BUY);
        }
        return _getIntegration(_integrationID).getMinimumERC20TokenAmountForExactAVAX(_asset, targetAVAXAmount);
    }

    modifier supportsAction(bytes32 _integrationID, IDPIntegration.supportedActions _action) {
        if(_integrationID != "ANY") {
            require(_getIntegration(_integrationID).isActionSupported(_action), "Action not supported");
        }
        _;
    }
}
