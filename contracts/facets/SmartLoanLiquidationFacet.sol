// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SolvencyFacet.sol";
import "../lib/SolvencyMethodsLib.sol";

import "../lib/SmartLoanConfigLib.sol";
import "../Pool.sol";
import "../TokenManager.sol";

contract SmartLoanLiquidationFacet is ReentrancyGuard, SolvencyMethodsLib {
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
                assetsToRepay: assetsToRepay,
                amountsToRepay: amountsToRepay,
                liquidationBonus: _liquidationBonus,
                allowUnprofitableLiquidation: true
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
                assetsToRepay: assetsToRepay,
                amountsToRepay: amountsToRepay,
                liquidationBonus: _liquidationBonus,
                allowUnprofitableLiquidation: false
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
        TokenManager tokenManager = SmartLoanConfigLib.getTokenManager();

        uint256[] memory prices = SolvencyMethodsLib.executeGetPricesFromMsg(config.assetsToRepay);


        {
            uint256 initialTotal = _getTotalValue();
            uint256 initialDebt = _getDebt();

            require(config.liquidationBonus <= SmartLoanConfigLib.getMaxLiquidationBonus(), "Defined liquidation bonus higher than max. value");
            require(_getLTV() >= SmartLoanConfigLib.getMaxLtv(), "Cannot sellout a solvent account");
            require(initialDebt < initialTotal || config.allowUnprofitableLiquidation, "Trying to liquidate bankrupt loan");
        }
        //healing means bringing a bankrupt loan to a state when debt is smaller than total value again
        // TODO: Recalculating TV and Debt because of stack to deep. Could be optimized
        bool healingLoan = config.allowUnprofitableLiquidation && _getDebt() > _getTotalValue();

        uint256 suppliedInUSD;
        uint256 repaidInUSD;

        for (uint256 i = 0; i < config.assetsToRepay.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(config.assetsToRepay[i]));

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
        bytes32[] memory assetsOwned = SmartLoanConfigLib.getAllOwnedAssets();
        uint256 bonus;

        //after healing bankrupt loan (debt > total value), no tokens are returned to liquidator
        if (!healingLoan) {
            uint256 valueOfTokens = _getTotalValue();

            bonus = repaidInUSD * config.liquidationBonus / SmartLoanConfigLib.getPercentagePrecision();

            uint256 partToReturn = 10 ** 18;

            if (valueOfTokens >= suppliedInUSD + bonus) {
                partToReturn = (suppliedInUSD + bonus) * 10 ** 18 / total;
            }

            // Native token transfer
            if (address(this).balance > 0) {
                payable(msg.sender).safeTransferETH(address(this).balance * partToReturn / 10 ** 18);
            }

            for (uint256 i; i < assetsOwned.length; i++) {
                IERC20Metadata token = getERC20TokenInstance(assetsOwned[i]);
                uint256 balance = token.balanceOf(address(this));

                address(token).safeTransfer(msg.sender, balance * partToReturn / 10 ** 18);
            }
        }

        uint256 LTV = _getLTV();

        emit Liquidated(msg.sender, repaidInUSD, bonus, LTV, block.timestamp);

        if (msg.sender != DiamondStorageLib.smartLoanStorage().contractOwner) {
            require(LTV >= SmartLoanConfigLib.getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        require(LTV < SmartLoanConfigLib.getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a successful liquidation operation
     * @param liquidator the address that initiated the liquidation operation
     * @param repayAmount requested amount (AVAX) of liquidation
     * @param bonus an amount of bonus (AVAX) received by the liquidator
     * @param ltv a new LTV after the liquidation operation
     * @param timestamp a time of the liquidation
     **/
    event Liquidated(address indexed liquidator, uint256 repayAmount, uint256 bonus, uint256 ltv, uint256 timestamp);

    /**
    * @dev emitted after closing a loan by the owner
    * @param timestamp a time of the loan's closure
    **/
    event LoanClosed(uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool during a liquidation
     * @param borrower the address initiating repayment
     * @param _asset asset repaid by an investor
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event LiquidationRepay(address indexed borrower, bytes32 indexed _asset, uint256 amount, uint256 timestamp);
}

