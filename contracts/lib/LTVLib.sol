pragma solidity ^0.8.4;

import "./SmartLoanLib.sol";
import "../ERC20Pool.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

library LTVLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
     * Calculates the current debt as a sum of debts from all lending pools
     * @param _prices current prices
     **/
    function calculateDebt(uint256[] memory _prices) public view returns (uint256) {
        uint256 debt = 0;

        for (uint256 i = 0; i < SmartLoanLib.getPoolTokens().length; i++) {
            IERC20Metadata token = SmartLoanLib.getPoolTokens()[i];
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[i];
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10

            debt = debt + SmartLoanLib.getPools()[i].getBorrowed(address(this)) * _prices[assetIndex] * 10**10
            / 10 ** token.decimals();
        }

        return debt;
    }


    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset) public view returns (IERC20Metadata) {
        address assetAddress = SmartLoanLib.getExchange().getAssetAddress(_asset);
        IERC20Metadata token = IERC20Metadata(assetAddress);
        return token;
    }

    //TODO: we should have a data with staking and LP positions as well
    /**
     * Returns the balances of all assets served by the price provider
     * It could be used as a helper method for UI
     **/
    function getAllAssetsBalances() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory balances = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            balances[i] = getBalance(assets[i]);
        }

        return balances;
    }

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) public view returns (uint256) {
        IERC20 token = IERC20(SmartLoanLib.getExchange().getAssetAddress(_asset));
        return token.balanceOf(address(this));
    }

    /**
    * Calculates the current value of all tokens of Prime Account in USD
    **/
    function calculateAssetsValue(uint256[] memory prices) public view returns (uint256) {
        uint256 total = address(this).balance * prices[0] / 10**8;
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();

        for (uint256 i = 0; i < prices.length; i++) {
            require(prices[i] != 0, "Asset price returned from oracle is zero");

            bytes32 _asset = assets[i];
            IERC20Metadata token = getERC20TokenInstance(_asset);
            uint256 assetBalance = getBalance(_asset);

            total = total + (prices[i] * 10**10 * assetBalance / (10 ** token.decimals()));
        }

        return total;
    }

    /**
     * This function role is to repay a defined amount of debt during liquidation or closing account.
     * @param _repayConfig configuration for repayment
     **/
    function repayAmount(RepayConfig memory _repayConfig) external returns (uint256) {
        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(_repayConfig.assets[_repayConfig.poolAssetIndex]));
        IERC20Metadata poolToken = getERC20TokenInstance(_repayConfig.assets[_repayConfig.poolAssetIndex]);

        uint256 availableTokens = poolToken.balanceOf(address(this));

        uint256 neededTokensForRepay = Math.min(
            _repayConfig.leftToRepay,
            pool.getBorrowed(address(this))
        );

        uint256 neededTokensWithBonus = neededTokensForRepay + _repayConfig.tokensForLiquidator;

        if (_repayConfig.allowSwaps) {
            uint32 j;

            // iteration with swapping assets
            while (availableTokens < neededTokensWithBonus && j < _repayConfig.assets.length) {
                // no slippage protection during liquidation
                if (j != _repayConfig.poolAssetIndex) {
                    availableTokens += swapToPoolToken(
                        SwapConfig(j, _repayConfig.poolAssetIndex, neededTokensWithBonus - availableTokens, _repayConfig.prices, _repayConfig.assets)
                    );
                }

                j++;
            }
        }

        uint256 repaidAmount = Math.min(neededTokensForRepay, availableTokens);

        if (repaidAmount > 0) {
            address(poolToken).safeApprove(address(pool), 0);
            address(poolToken).safeApprove(address(pool), repaidAmount);

            bool successRepay;
            (successRepay, ) = address(pool).call{value: 0}(
                abi.encodeWithSignature("repay(uint256)", repaidAmount)
            );

            if (!successRepay) {
                repaidAmount = 0;
            }
        }

        if (_repayConfig.tokensForLiquidator > 0) {
            address(poolToken).safeTransfer(msg.sender, Math.min(availableTokens - repaidAmount, _repayConfig.tokensForLiquidator));
        }

        return repaidAmount;
    }

    /**
     * Swap to pool token for repayment during liquidation or closing account.
     * @param _swapConfig configuration for swap
     **/
    function swapToPoolToken(SwapConfig memory _swapConfig) private returns (uint256) {
        IERC20Metadata token = getERC20TokenInstance(_swapConfig.assets[_swapConfig.assetIndex]);
        IERC20Metadata poolToken = getERC20TokenInstance(SmartLoanLib.getExchange().getAllAssets()[_swapConfig.poolAssetIndex]);

        //if amount needed for swap equals 0 because of limited accuracy of calculations, we swap 1
        uint256 swapped = Math.min(
            Math.max(_swapConfig.neededSwapInPoolToken * _swapConfig.prices[_swapConfig.poolAssetIndex] * 10 ** token.decimals() / (_swapConfig.prices[_swapConfig.assetIndex] * 10 ** poolToken.decimals()), 1),
            token.balanceOf(address(this))
        );

        // TODO: Save getExchange() result to a in-memory variable?
        if (swapped > 0) {
            address(token).safeTransfer(address(SmartLoanLib.getExchange()), swapped);
            (bool success, bytes memory result) = address(SmartLoanLib.getExchange()).call{value: 0}(
                abi.encodeWithSignature("swap(bytes32,bytes32,uint256,uint256)",
                _swapConfig.assets[_swapConfig.assetIndex], _swapConfig.assets[_swapConfig.poolAssetIndex], swapped, 0)
            );

            if (success) {
                uint256[] memory amounts = abi.decode(result, (uint256[]));

                return amounts[amounts.length - 1];
            }
        }

        return 0;
    }

    /**
    * Returns current Loan To Value (solvency ratio) associated with the loan, defined as debt / (total value - debt)
    * @param _prices current prices
    **/
    function calculateLTV(uint256[] memory _prices) public view returns (uint256) {
        uint256 debt = calculateDebt(_prices);
        uint256 totalValue = calculateTotalValue(_prices);

        if (debt == 0) {
            return 0;
        } else if (debt < totalValue) {
            return (debt * SmartLoanLib.getPercentagePrecision()) / (totalValue - debt);
        } else {
            return SmartLoanLib.getMaxLtv();
        }
    }

    /**
    * Calculates the current value of Prime Account in USD including all tokens as well as staking and LP positions
    **/
    function calculateTotalValue(uint256[] memory prices) public view returns (uint256) {
        return calculateAssetsValue(prices) + SmartLoanLib.getYieldYakRouter().getTotalStakedValue() * prices[0] / 10**8;
    }

    struct RepayConfig {
        bool allowSwaps;
        uint256 leftToRepay;
        uint256 poolAssetIndex;
        uint256 tokensForLiquidator;
        uint256[] prices;
        bytes32[] assets;
    }

    struct SwapConfig {
        uint256 assetIndex;
        uint256 poolAssetIndex;
        uint256 neededSwapInPoolToken;
        uint256[] prices;
        bytes32[] assets;
    }
}