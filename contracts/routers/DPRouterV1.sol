// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../enums/IntegrationEnums.sol";
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


    // TODO: implement for staking and LP
    function getSwapAssetAddress(bytes32 _integration, bytes32 _asset) public view returns(address) {
        return _getIntegration(_integration).getSwapAssetAddress(_asset);
    }

    function getStakingAssetAddress(bytes32 _integration, bytes32 _asset) public view returns(address) {
        return _getIntegration(_integration).getStakingAssetAddress(_asset);
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function buy(bytes32 _integrationID, bytes32 _asset, uint256 _exactERC20AmountOut) external payable supportsAction(_integrationID, IDPIntegration.supportedActions.BUY) returns(bool) {
        (bool success, ) = address(_getIntegration(_integrationID)).call{value: msg.value}(
            abi.encodeWithSignature("buy(bytes32,uint256,address)", _asset, _exactERC20AmountOut, msg.sender)
        );
        return success;
    }

    // TODO: Replace with swap() once ERC20 pools are implemented
    function sell(bytes32 _integrationID, bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut) external supportsAction(_integrationID, IDPIntegration.supportedActions.SELL) returns(bool) {
        IDPIntegration integration = _getIntegration(_integrationID);
        IERC20Metadata token = IERC20Metadata(integration.getSwapAssetAddress(_asset));
        address(token).safeTransfer(address(integration), _exactERC20AmountIn);

        (bool success, ) = address(_getIntegration(_integrationID)).call(
            abi.encodeWithSignature("sell(bytes32,uint256,uint256,address)", _asset, _exactERC20AmountIn, _minAvaxAmountOut, msg.sender)
        );
        return success;
    }

    function stakeFor(bytes32 _integrationID, bytes32 _asset, uint256 _amount) external payable supportsAction(_integrationID, IDPIntegration.supportedActions.STAKE) returns(bool) {
        IDPIntegration integration = _getIntegration(_integrationID);
        bool success = integration.stakeFor{value: _amount}(_asset, _amount, msg.sender);
        return success;
    }

    function getStakingContract(bytes32 _integrationID, bytes32 _asset) public view returns (StakingToken) {
        IDPIntegration integration = _getIntegration(_integrationID);
        return integration.getStakingContract(_asset);
    }

    function unstake(bytes32 _integrationID, bytes32 _asset, uint256 _amount) external supportsAction(_integrationID, IDPIntegration.supportedActions.UNSTAKE) returns(bool) {
        IDPIntegration integration = _getIntegration(_integrationID);
        StakingToken stakingContract = getStakingContract(_integrationID, _asset);
        stakingContract.approve(address(integration), _amount);
        bool success = integration.stakeFor{value: _amount}(_asset, _amount, msg.sender);
        if (!success) {
            address(stakingContract).safeTransfer(msg.sender, _amount);
        }
        return success;
    }

    function addLiquidity(bytes32 _integrationID, bytes32 _asset1, bytes32 _asset2) internal supportsAction(_integrationID, IDPIntegration.supportedActions.ADD_LIQUIDITY) returns(bool) {
        // TODO: implement
        return false;
    }

    function removeLiquidity(bytes32 _integrationID, bytes32 _asset1, bytes32 _asset2) internal supportsAction(_integrationID, IDPIntegration.supportedActions.REMOVE_LIQUIDITY) returns(bool) {
        // TODO: implement
        return false;
    }

    function getSwapIntegrations() external view returns(bytes32[] memory) {
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

    function getLPIntegrations() external view returns(bytes32[] memory) {
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

    function getStakingIntegrations() external view returns(bytes32[] memory) {
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
        return _getIntegration(_integrationID).getMinimumERC20TokenAmountForExactAVAX(_asset, targetAVAXAmount);
    }

    modifier supportsAction(bytes32 _integration, IDPIntegration.supportedActions _action) {
        require(_getIntegration(_integration).isActionSupported(_action), "Action not supported");
        _;
    }
}
