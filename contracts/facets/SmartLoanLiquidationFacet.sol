// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../lib/SolvencyMethods.sol";
import "../Pool.sol";
import "../TokenManager.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SmartLoanLiquidationFacet is ReentrancyGuardKeccak, SolvencyMethods {

    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MAX_LTV = 5000;

    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MIN_LTV_AFTER_LIQUIDATION = 4000;

    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MAX_LIQUIDATION_BONUS = 100;

    using TransferHelper for address payable;
    using TransferHelper for address;

    /** @param assetsToRepay names of tokens to be repaid to pools
    /** @param amountsToRepay amounts of tokens to be repaid to pools
      * @param liquidationBonus per mille bonus for liquidator. Must be smaller or equal to getMaxLiquidationBonus(). Defined for
      * liquidating loans where debt ~ total value
      * @param allowUnprofitableLiquidation allows performing liquidation of bankrupt loans (total value smaller than debt)
    **/

    struct LiquidationConfig {
        bytes32[] assetsToRepay;
        uint256[] amountsToRepay;
        uint256 liquidationBonus;
        bool allowUnprofitableLiquidation;
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * Returns max LTV (with the accuracy in a thousandth)
     * IMPORTANT: when changing, update other facets as well
     **/
    function getMaxLtv() public view returns (uint256) {
        return _MAX_LTV;
    }

    /**
      * Returns minimum acceptable LTV after liquidation
      **/
    function getMinLtvAfterLiquidation() public view returns (uint256) {
        return _MIN_LTV_AFTER_LIQUIDATION;
    }

    /**
      * Returns maximum acceptable liquidation bonus (bonus is provided by a liquidator)
      **/
    function getMaxLiquidationBonus() public view returns (uint256) {
        return _MAX_LIQUIDATION_BONUS;
    }

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * This function can be accessed by any user when Prime Account is insolvent or bankrupt and repay part of the loan
    * with his approved tokens.
    * BE CAREFUL: in contrast to liquidateLoan() method, this one doesn't necessarily return tokens to liquidator, nor give him
    * a bonus. It's purpose is to bring the loan to a solvent position even if it's unprofitable for liquidator.
    * @dev This function uses the redstone-evm-connector
    * @param assetsToRepay bytes32[] names of tokens provided by liquidator for repayment
    * @param amountsToRepay utin256[] amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than or equal to getMaxLiquidationBonus()
    **/
    function unsafeLiquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(
            LiquidationConfig({
                assetsToRepay : assetsToRepay,
                amountsToRepay : amountsToRepay,
                liquidationBonus : _liquidationBonus,
                allowUnprofitableLiquidation : true
            })
        );
    }

    /**
    * This function can be accessed by any user when Prime Account is insolvent and liquidate part of the loan
    * with his approved tokens.
    * A liquidator has to approve adequate amount of tokens to repay debts to liquidity pools if
    * there is not enough of them in a SmartLoan. For that he will receive the corresponding amount from SmartLoan
    * with the same USD value + bonus.
    * @dev This function uses the redstone-evm-connector
    * @param assetsToRepay bytes32[] names of tokens provided by liquidator for repayment
    * @param amountsToRepay utin256[] amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than or equal to  getMaxLiquidationBonus()
    **/
    function liquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(
            LiquidationConfig({
                assetsToRepay : assetsToRepay,
                amountsToRepay : amountsToRepay,
                liquidationBonus : _liquidationBonus,
                allowUnprofitableLiquidation : false
            })
        );
    }

    /**
    * This function can be accessed when Prime Account is insolvent and perform a partial liquidation of the loan
    * (selling assets, closing positions and repaying debts) to bring the account back to a solvent state. At the end
    * of liquidation resulting solvency of account is checked to make sure that the account is between maximum and minimum
    * solvency.
    * To diminish the potential effect of manipulation of liquidity pools by a liquidator, there are no swaps performed
    * during liquidation.
    * @dev This function uses the redstone-evm-connector
    * @param config configuration for liquidation
    **/
    function liquidate(LiquidationConfig memory config) internal {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256[] memory prices = SolvencyMethods.getPrices(config.assetsToRepay);

        uint256 initialTotal = _getTotalValue();
        uint256 initialDebt = _getDebt();

        require(config.liquidationBonus <= getMaxLiquidationBonus(), "Defined liquidation bonus higher than max. value");
        require(_getLTV() >= getMaxLtv(), "Cannot sellout a solvent account");
        require(initialDebt < initialTotal || config.allowUnprofitableLiquidation, "Trying to liquidate bankrupt loan");

        //healing means bringing a bankrupt loan to a state when debt is smaller than total value again
        bool healingLoan = config.allowUnprofitableLiquidation && initialDebt > initialTotal;

        uint256 suppliedInUSD;
        uint256 repaidInUSD;

        for (uint256 i = 0; i < config.assetsToRepay.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(config.assetsToRepay[i], true));

            uint256 balance = token.balanceOf(address(this));
            uint256 needed;

            if (healingLoan) {
                needed = config.amountsToRepay[i];
            } else if (config.amountsToRepay[i] > balance) {
                needed = config.amountsToRepay[i] - balance;
            }

            if (needed > 0) {
                require(needed <= token.allowance(msg.sender, address(this)), "Not enough allowance for the token");
                require(needed <= token.balanceOf(msg.sender), "Msg.sender supplied token balance is insufficient");

                address(token).safeTransferFrom(msg.sender, address(this), needed);
                suppliedInUSD += needed * prices[i] * 10 ** 10 / 10 ** token.decimals();
            }

            Pool pool = Pool(tokenManager.getPoolAddress(config.assetsToRepay[i]));

            uint256 repayAmount = Math.min(pool.getBorrowed(address(this)), config.amountsToRepay[i]);

            address(token).safeApprove(address(pool), 0);
            address(token).safeApprove(address(pool), repayAmount);

            repaidInUSD += repayAmount * prices[i] * 10 ** 10 / 10 ** token.decimals();

            pool.repay(repayAmount);

            if (token.balanceOf(address(this)) == 0) {
                DiamondStorageLib.removeOwnedAsset(config.assetsToRepay[i]);
            }

            emit LiquidationRepay(msg.sender, config.assetsToRepay[i], repayAmount, block.timestamp);
        }

        uint256 total = _getTotalValue();
        bytes32[] memory assetsOwned = DeploymentConstants.getAllOwnedAssets();
        uint256 bonus;

        //after healing bankrupt loan (debt > total value), no tokens are returned to liquidator

        bonus = repaidInUSD * config.liquidationBonus / DeploymentConstants.getPercentagePrecision();

        //meaning returning all tokens
        uint256 partToReturn = 10 ** 18; // 1
        uint256 assetsValue = _getTotalAssetsValue();

        if (!healingLoan && assetsValue >= suppliedInUSD + bonus) {
            //in that scenario we calculate how big part of token to return
            partToReturn = (suppliedInUSD + bonus) * 10 ** 18 / assetsValue;
        }

        // Native token transfer
        if (address(this).balance > 0) {
            payable(msg.sender).safeTransferETH(address(this).balance * partToReturn / 10 ** 18);
        }

        for (uint256 i; i < assetsOwned.length; i++) {
            IERC20Metadata token = getERC20TokenInstance(assetsOwned[i], true);
            uint256 balance = token.balanceOf(address(this));

            address(token).safeTransfer(msg.sender, balance * partToReturn / 10 ** 18);
            emit LiquidationTransfer(msg.sender, assetsOwned[i], balance * partToReturn / 10 ** 18, block.timestamp);
        }

        uint256 LTV = _getLTV();

        if (msg.sender != DiamondStorageLib.smartLoanStorage().contractOwner && !healingLoan) {
            require(LTV >= getMinLtvAfterLiquidation(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        if (healingLoan) {
            require(_getDebt() == 0, "Healing a loan must end up with 0 debt");
            require(_getTotalValue() == 0, "Healing a loan must end up with 0 total value");
        }

        require(LTV < getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");

        //TODO: include final debt and tv
        emit Liquidated(msg.sender, healingLoan, initialTotal, initialDebt, repaidInUSD, bonus, LTV, block.timestamp);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a successful liquidation operation
     * @param liquidator the address that initiated the liquidation operation
     * @param healing was the liquidation covering the bad debt (unprofitable liquidation)
     * @param initialTotal total value of assets before the liquidation
     * @param initialDebt sum of all debts before the liquidation
     * @param repayAmount requested amount (AVAX) of liquidation
     * @param bonus an amount of bonus (AVAX) received by the liquidator
     * @param ltv a new LTV after the liquidation operation
     * @param timestamp a time of the liquidation
     **/
    event Liquidated(address indexed liquidator, bool indexed healing, uint256 initialTotal, uint256 initialDebt, uint256 repayAmount, uint256 bonus, uint256 ltv, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool during a liquidation
     * @param liquidator the address initiating repayment
     * @param asset asset repaid by a liquidator
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event LiquidationRepay(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are sent to liquidator during liquidation
     * @param liquidator the address initiating repayment
     * @param asset token sent to a liquidator
     * @param amount of sent funds
     * @param timestamp of the transfer
     **/
    event LiquidationTransfer(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}

