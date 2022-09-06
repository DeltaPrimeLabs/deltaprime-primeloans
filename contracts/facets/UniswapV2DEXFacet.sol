// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract UniswapV2DEXFacet is ReentrancyGuardKeccak, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
    * Swaps one asset with another
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapAssets(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) internal remainsSolvent returns(uint256[] memory) {
        IERC20Metadata soldToken = getERC20TokenInstance(_soldAsset);
        IERC20Metadata boughtToken = getERC20TokenInstance(_boughtAsset);

        require(soldToken.balanceOf(address(this)) >= _exactSold, "Not enough token to sell");
        address(soldToken).safeTransfer(getExchangeIntermediaryContract(), _exactSold);

        IAssetsExchange exchange = IAssetsExchange(getExchangeIntermediaryContract());

        uint256[] memory amounts = exchange.swap(address(soldToken), address(boughtToken), _exactSold, _minimumBought);

        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        // Add asset to ownedAssets
        address boughtAssetAddress = tokenManager.getAssetAddress(_boughtAsset);

        if (boughtToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_boughtAsset, boughtAssetAddress);
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if(soldToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_soldAsset);
        }

        emit Swap(msg.sender, _soldAsset, _boughtAsset, amounts[0],  amounts[amounts.length - 1], block.timestamp);

        return amounts;
    }

    /**
     * Returns address of DeltaPrime intermediary contract of UniswapV2-like exchange
     **/
    //TO BE OVERRIDDEN
    function getExchangeIntermediaryContract() public virtual returns (address) {
        return address(0);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a swap of assets
     * @param investor the address of investor making the purchase
     * @param soldAsset sold by the investor
     * @param boughtAsset bought by the investor
     * @param _maximumSold maximum to be sold
     * @param _minimumBought minimum to be bought
     * @param timestamp time of the swap
     **/
    event Swap(address indexed investor, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 _maximumSold, uint256 _minimumBought, uint256 timestamp);
}