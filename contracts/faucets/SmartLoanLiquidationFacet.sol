pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SolvencyFacet.sol";
import "../lib/SolvencyMethodsLib.sol";

import "../lib/SmartLoanLib.sol";
import "../Pool.sol";
import "../PoolManager.sol";

contract SmartLoanLiquidationFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /** @param amountsToRepay amounts of tokens to be repaid to pools (the same order as in getPools() method)
      * @param liquidationBonus per mille bonus for liquidator. Must be smaller or equal to getMaxLiquidationBonus(). Defined for
      * liquidating loans where debt ~ total value
      * @param allowUnprofitableLiquidation allows performing liquidation of bankrupt loans (total value smaller than debt)
    **/

    struct AssetAmountPair {
        bytes32 asset;
        uint256 amount;
    }

    struct LiquidationConfig {
        AssetAmountPair[] assetsAmountsToRepay;
        uint256 liquidationBonus;
        bool allowUnprofitableLiquidation;
    }

    /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return SmartLoanLib.getMaxBlockTimestampDelay();
    }

    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return SmartLoanLib.getRedstoneConfigManager().signerExists(_receivedSigner);
    }


    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * This function can be accessed by any user when Prime Account is insolvent or bankrupt and repay part of the loan
    * with his approved tokens.
    * BE CAREFUL: in contrast to liquidateLoan() method, this one doesn't necessarily return tokens to liquidator, nor give him
    * a bonus. It's purpose is to bring the loan to a solvent position even if it's unprofitable for liquidator.
    * @dev This function uses the redstone-evm-connector
    * @param _assetsAmountsToRepay assets' names and amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than or equal to getMaxLiquidationBonus()
    **/
    function unsafeLiquidateLoan(AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(LiquidationConfig(_assetsAmountsToRepay, _liquidationBonus, true));
    }

    /**
    * This function can be accessed by any user when Prime Account is insolvent and liquidate part of the loan
    * with his approved tokens.
    * A liquidator has to approve adequate amount of tokens to repay debts to liquidity pools if
    * there is not enough of them in a SmartLoan. For that he will receive the corresponding amount from SmartLoan
    * with the same USD value + bonus.
    * @dev This function uses the redstone-evm-connector
    * @param _assetsAmountsToRepay assets' names and amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than or equal to  getMaxLiquidationBonus()
    **/
    function liquidateLoan(AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(LiquidationConfig(_assetsAmountsToRepay, _liquidationBonus, false));
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
        PoolManager poolManager = SmartLoanLib.getPoolManager();
        // TODO: this is not optimal - let's later check if changing list of AssetAmount to two separate lists will be more efficient
        bytes32[] memory assetsToRepay = new bytes32[](config.assetsAmountsToRepay.length);
        for(uint i=0; i< assetsToRepay.length; i++){
            assetsToRepay[i] = config.assetsAmountsToRepay[i].asset;
        }
        uint256[] memory prices = getPricesFromMsg(assetsToRepay);


        {
            uint256 initialTotal = _calculateTotalValue();
            uint256 initialDebt = _calculateDebt();

            require(config.liquidationBonus <= SmartLoanLib.getMaxLiquidationBonus(), "Defined liquidation bonus higher than max. value");
            require(_calculateLTV() >= SmartLoanLib.getMaxLtv(), "Cannot sellout a solvent account");
            require(initialDebt < initialTotal || config.allowUnprofitableLiquidation, "Trying to liquidate bankrupt loan");
        }
        //healing means bringing a bankrupt loan to a state when debt is smaller than total value again
        // TODO: Recalculating TV and Debt because of stack to deep. Could be optimized
        bool healingLoan = config.allowUnprofitableLiquidation && _calculateDebt() > _calculateTotalValue();

        uint256 suppliedInUSD;
        uint256 repaidInUSD;

        for (uint256 i = 0; i < config.assetsAmountsToRepay.length; i++) {
            IERC20Metadata token = IERC20Metadata(poolManager.getAssetAddress(config.assetsAmountsToRepay[i].asset));

            uint256 balance = token.balanceOf(address(this));
            uint256 needed;

            if (healingLoan) {
                needed = config.assetsAmountsToRepay[i].amount;
            } else if (config.assetsAmountsToRepay[i].amount > balance) {
                needed = config.assetsAmountsToRepay[i].amount - balance;
            }

            if (needed > 0) {
                require(needed <= token.allowance(msg.sender, address(this)), "Not enough allowance for the token");
                require(needed <= token.balanceOf(msg.sender), "Msg.sender supplied token balance is insufficient");

                address(token).safeTransferFrom(msg.sender, address(this), needed);
                suppliedInUSD += needed * prices[i] * 10 ** 10 / 10 ** token.decimals();
            }

            Pool pool = Pool(poolManager.getPoolAddress(assetsToRepay[i]));

            uint256 repayAmount = Math.min(pool.getBorrowed(address(this)), config.assetsAmountsToRepay[i].amount);

            address(token).safeApprove(address(pool), 0);
            address(token).safeApprove(address(pool), repayAmount);

            repaidInUSD += repayAmount * prices[i] * 10 ** 10 / 10 ** token.decimals();

            pool.repay(repayAmount);

            if (token.balanceOf(address(this)) == 0) {
                LibDiamond.removeOwnedAsset(config.assetsAmountsToRepay[i].asset);
            }

            emit LiquidationRepay(msg.sender, config.assetsAmountsToRepay[i].asset, repayAmount, block.timestamp);
        }

        uint256 total = _calculateTotalValue();
        bytes32[] memory assetsOwned = SmartLoanLib.getAllOwnedAssets();
        uint256 bonus;

        //after healing bankrupt loan (debt > total value), no tokens are returned to liquidator
        if (!healingLoan) {
            uint256 valueOfTokens = _getTotalValue();

            bonus = repaidInUSD * config.liquidationBonus / SmartLoanLib.getPercentagePrecision();

            uint256 partToReturn = 10 ** 18;

            if (valueOfTokens >= suppliedInUSD + bonus) {
                partToReturn = (suppliedInUSD + bonus) * 10 ** 18 / total;
            }

            for (uint256 i; i < assetsOwned.length; i++) {
                IERC20Metadata token = getERC20TokenInstance(assetsOwned[i]);
                uint256 balance = token.balanceOf(address(this));

                address(token).safeTransfer(msg.sender, balance * partToReturn / 10 ** 18);
            }
        }

        uint256 LTV = _calculateLTV();

        emit Liquidated(msg.sender, repaidInUSD, bonus, LTV, block.timestamp);

        if (msg.sender != LibDiamond.smartLoanStorage().contractOwner) {
            require(LTV >= SmartLoanLib.getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        require(LTV < SmartLoanLib.getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
    }

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
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

