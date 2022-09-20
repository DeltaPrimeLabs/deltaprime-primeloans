// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../lib/SolvencyMethods.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";
import "../interfaces/IAssetsExchange.sol";

contract UniswapV2DEXFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
    * Swaps one asset with another
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapAssets(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) internal remainsSolvent returns (uint256[] memory) {
        IERC20Metadata soldToken = getERC20TokenInstance(_soldAsset, true);
        IERC20Metadata boughtToken = getERC20TokenInstance(_boughtAsset, false);

        require(soldToken.balanceOf(address(this)) >= _exactSold, "Not enough token to sell");
        address(soldToken).safeTransfer(getExchangeIntermediaryContract(), _exactSold);

        IAssetsExchange exchange = IAssetsExchange(getExchangeIntermediaryContract());

        uint256[] memory amounts = exchange.swap(address(soldToken), address(boughtToken), _exactSold, _minimumBought);

        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        // Add asset to ownedAssets
        address boughtAssetAddress = tokenManager.getAssetAddress(_boughtAsset, false);

        if (boughtToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_boughtAsset, boughtAssetAddress);
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the swap
        if (soldToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_soldAsset);
        }

        emit Swap(msg.sender, _soldAsset, _boughtAsset, amounts[0], amounts[amounts.length - 1], block.timestamp);

        return amounts;
    }

    /**
    * Adds liquidity
    **/
    function addLiquidity(bytes32 _firstAsset, bytes32 _secondAsset, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin) internal remainsSolvent {
        IERC20Metadata tokenA = getERC20TokenInstance(_firstAsset, true);
        IERC20Metadata tokenB = getERC20TokenInstance(_secondAsset, false);

        require(tokenA.balanceOf(address(this)) >= amountADesired, "Not enough tokenA to provide");
        require(tokenB.balanceOf(address(this)) >= amountBDesired, "Not enough tokenB to provide");

        address(tokenA).safeTransfer(getExchangeIntermediaryContract(), amountADesired);
        address(tokenB).safeTransfer(getExchangeIntermediaryContract(), amountBDesired);

        IAssetsExchange exchange = IAssetsExchange(getExchangeIntermediaryContract());

        address lpTokenAddress = exchange.addLiquidity(address(tokenA), address(tokenB), amountADesired, amountBDesired, amountAMin, amountBMin);

        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        if (IERC20Metadata(lpTokenAddress).balanceOf(address(this)) > 0) {
            //TODO
//            DiamondStorageLib.addOwnedAsset(IERC20Metadata(lpTokenAddress).symbol(), lpTokenAddress); //check the names
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the LP
        if (tokenA.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_firstAsset);
        }

        if (tokenB.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_secondAsset);
        }

        emit AddLiquidity(_firstAsset, _secondAsset, amountADesired, amountBDesired, amountAMin, amountBMin, block.timestamp);
    }

    /**
    * Removes liquidity
    **/
    function removeLiquidity(bytes32 _firstAsset, bytes32 _secondAsset, uint liquidity, uint amountAMin, uint amountBMin) internal remainsSolvent {
        IERC20Metadata tokenA = getERC20TokenInstance(_firstAsset, true);
        IERC20Metadata tokenB = getERC20TokenInstance(_secondAsset, false);

        IAssetsExchange exchange = IAssetsExchange(getExchangeIntermediaryContract());

        address lpTokenAddress = exchange.getPair(address(tokenA), address(tokenB));

        lpTokenAddress.safeTransfer(getExchangeIntermediaryContract(), liquidity);

        exchange.removeLiquidity(address(tokenA), address(tokenB), liquidity, amountAMin, amountBMin);

        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        // Remove asset from ownedAssets if the asset balance is 0 after the LP
        if (IERC20Metadata(lpTokenAddress).balanceOf(address(this)) == 0) {
            //TODO
//            DiamondStorageLib.removeOwnedAsset(IERC20Metadata(lpTokenAddress).symbol());
        }

        emit RemoveLiquidity(_firstAsset, _secondAsset, liquidity, amountAMin, amountBMin, block.timestamp);
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

    /**
     * @dev emitted after LP
     **/
    event AddLiquidity(bytes32 _firstAsset, bytes32 _secondAsset, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, uint256 timestamp);

    /**
     * @dev emitted after removing LP
     **/
    event RemoveLiquidity(bytes32 _firstAsset, bytes32 _secondAsset, uint liquidity, uint amountAMin, uint amountBMin, uint256 timestamp);
}