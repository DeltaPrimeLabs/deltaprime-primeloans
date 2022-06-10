pragma solidity ^0.8.4;


import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../lib/SmartLoanLib.sol";
import "../lib/LTVLib.sol";
import "../ERC20Pool.sol";

contract SmartLoanLiquidationFacet is PriceAware, ReentrancyGuard {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /** @param amountsToRepay amounts of tokens to be repaid to pools (the same order as in getPools() method)
      * @param liquidationBonus per mille bonus for liquidator. Must be smaller or equal to getMaxLiquidationBonus(). Defined for
      * liquidating loans where debt ~ total value
      * @param allowUnprofitableLiquidation allows performing liquidation of bankrupt loans (total value smaller than debt)
    **/
    struct LiquidationConfig {
        uint256[] amountsToRepay;
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
        return (_receivedSigner == SmartLoanLib.getPriceProvider1()) || (_receivedSigner == SmartLoanLib.getPriceProvider2());
    }


    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * This function can only be accessed by the owner and allows closing all positions and repaying all debts.
    * @param _amountsProvided amounts provided by owner to close a loan (when the tokens available in SmartLoan are not
    * enough to repay debts)
    * @dev This function uses the redstone-evm-connector
    **/
    function closeLoan(uint256[] memory _amountsProvided) public virtual payable onlyOwner nonReentrant remainsSolvent {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        uint256 debt = LTVLib.calculateDebt(prices);

        //TODO: update it after corrected on main
        IYieldYakRouter yakRouter = SmartLoanLib.getYieldYakRouter();
        uint256 stakedAmount = yakRouter.getTotalStakedValue();

        if (stakedAmount > 0) {
            address(SmartLoanLib.getYakAvaxStakingContract()).safeApprove(address(yakRouter), stakedAmount);
            require(yakRouter.unstakeAVAX(stakedAmount), "Unstaking failed");
        }

        uint256 i;

        for (i = 0; i < SmartLoanLib.getPoolTokens().length; i++) {
            IERC20Metadata token = SmartLoanLib.getPoolTokens()[i];

            //allowances are needed for insolvent/bankrupt loan or loans without enough token for repaying debts
            if (_amountsProvided[i] > 0) {
                uint256 allowance = token.allowance(msg.sender, address(this));

                if (allowance >= _amountsProvided[i]) {
                    address(token).safeTransferFrom(msg.sender, address(this), _amountsProvided[i]);
                }
            }

            ERC20Pool pool = SmartLoanLib.getPools()[i];
            uint256 borrowed = pool.getBorrowed(address(this));

            address(token).safeApprove(address(pool), 0);
            address(token).safeApprove(address(pool), borrowed);
            pool.repay(borrowed);
        }

        for (i = 0; i < assets.length; i++) {
            IERC20Metadata token = LTVLib.getERC20TokenInstance(assets[i]);
            uint256 balance = token.balanceOf(address(this));

            if (balance > 0) {
                address(token).safeTransfer(msg.sender, balance);
            }
        }

        // TODO: Possibly introduce getDebt() method like in SmartLoanLogicFacet.sol
        // Downside of this approach is code duplication across multiple facets, but it's not entirely
        // wrong as the "logic" of calculating the debt still resides in one place only - the LTVLib library

        require(LTVLib.calculateDebt(prices) == 0, "Debt not fully repaid");
        require(LTVLib.calculateAssetsValue(prices) == 0, "Final value of closed loan above 0");

        emit LoanClosed(debt, address(this).balance, block.timestamp);
    }

    /**
    * This function can be accessed by any user when Prime Account is insolvent or bankrupt and repay part of the loan
    * with his approved tokens.
    * BE CAREFUL: in contrast to liquidateLoan() method, this one doesn't necessarily return tokens to liquidator, nor give him
    * a bonus. It's purpose is to bring the loan to a solvent position even if it's unprofitable for liquidator.
    * @dev This function uses the redstone-evm-connector
    * @param _amountsToRepay amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than getMaxLiquidationBonus()
    **/
    function unsafeLiquidateLoan(uint256[] memory _amountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(LiquidationConfig(_amountsToRepay, _liquidationBonus, true));
    }

    /**
    * This function can be accessed by any user when Prime Account is critically insolvent and liquidate part of the loan
    * with his approved tokens.
    * A liquidator has to approve adequate amount of tokens to repay debts to liquidity pools if
    * there is not enough of them in a SmartLoan. For that he will receive the corresponding amount from SmartLoan
    * with the same USD value + bonus.
    * @dev This function uses the redstone-evm-connector
    * @param _amountsToRepay amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonus per mille bonus for liquidator. Must be lower than getMaxLiquidationBonus()
    **/
    function liquidateLoan(uint256[] memory _amountsToRepay, uint256 _liquidationBonus) external payable nonReentrant {
        liquidate(LiquidationConfig(_amountsToRepay, _liquidationBonus, false));
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
        SmartLoanLib.setLiquidationInProgress(true);

        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        {
            // TODO: Potentially re-create getTotalValue() & getDebt() methods in this facet as well
            uint256 initialTotal = LTVLib.calculateTotalValue(prices);
            uint256 initialDebt = LTVLib.calculateDebt(prices);

            require(config.liquidationBonus <= SmartLoanLib.getMaxLiquidationBonus(), "Defined liquidation bonus higher than max. value");
            require(LTVLib.calculateLTV(prices) >= SmartLoanLib.getMaxLtv(), "Cannot sellout a solvent account");
            require(initialDebt < initialTotal || config.allowUnprofitableLiquidation, "Trying to liquidate bankrupt loan");
        }
        //healing means bringing a bankrupt loan to a state when debt is smaller than total value again
        bool healingLoan = config.allowUnprofitableLiquidation && LTVLib.calculateDebt(prices) > LTVLib.calculateTotalValue(prices);

        uint256 suppliedInUSD;
        uint256 repaidInUSD;

        for (uint256 i; i < SmartLoanLib.getPoolTokens().length; i++) {
            uint256 poolAssetIndex = SmartLoanLib.getPoolsAssetsIndices()[i];
            IERC20Metadata token = SmartLoanLib.getPoolTokens()[i];

            uint256 balance = token.balanceOf(address(this));
            uint256 needed;

            if (healingLoan) {
                needed = config.amountsToRepay[i];
            } else if (config.amountsToRepay[i] > balance) {
                needed = healingLoan ? config.amountsToRepay[i] : (config.amountsToRepay[i] - balance);
            }

            if (needed > 0) {
                require(needed <= token.allowance(msg.sender, address(this)), "Not enough allowance for the token");

                address(token).safeTransferFrom(msg.sender, address(this), needed);
                suppliedInUSD += needed * prices[poolAssetIndex] * 10**10 / 10 ** token.decimals();
            }

            ERC20Pool pool = SmartLoanLib.getPools()[i];

            address(token).safeApprove(address(pool), 0);
            address(token).safeApprove(address(pool), config.amountsToRepay[i]);

            repaidInUSD += config.amountsToRepay[i] * prices[poolAssetIndex] * 10**10 / 10 ** token.decimals();

            pool.repay(config.amountsToRepay[i]);
        }

        uint256 total = LTVLib.calculateTotalValue(prices);
        uint256 bonus;

        //after healing bankrupt loan (debt > total value), no tokens are returned to liquidator
        if (!healingLoan) {
            uint256 valueOfTokens = LTVLib.calculateAssetsValue(prices);

            bonus = repaidInUSD * config.liquidationBonus / SmartLoanLib.getPercentagePrecision();

            uint256 partToReturn = 10**18;

            if (valueOfTokens >= suppliedInUSD + bonus) {
                partToReturn = suppliedInUSD * 10**18 / total + bonus * 10**18 / total;
            } else {
                //meaning staking or LP positions
                uint256 toReturnFromPositions = suppliedInUSD + bonus - valueOfTokens;
                liquidatePositions(toReturnFromPositions, msg.sender, prices);
            }

            for (uint256 i; i < assets.length; i++) {
                IERC20Metadata token = LTVLib.getERC20TokenInstance(assets[i]);
                uint256 balance = token.balanceOf(address(this));

                address(token).safeTransfer(msg.sender, balance * partToReturn / 10**18);
            }
        }

        uint256 LTV = LTVLib.calculateLTV(prices);

        emit Liquidated(msg.sender, repaidInUSD, bonus, LTV, block.timestamp);

        if (msg.sender != LibDiamond.smartLoanStorage().contractOwner) {
            require(LTV >= SmartLoanLib.getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        require(LTV < SmartLoanLib.getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
        SmartLoanLib.setLiquidationInProgress(false);
    }

    /**
    * Liquidates staking and LP positions and sends tokens to defined address
    * @param _targetUsdAmount value in USD to be repaid from positions
    * @param _to address to which send funds from liquidation
    **/
    function liquidatePositions(uint256 _targetUsdAmount, address _to, uint256[] memory _prices) private returns(bool) {
        return liquidateYak(_targetUsdAmount * 10**8 / _prices[0], _to);
    }

    /**
    * Unstake AVAX amount to perform repayment to a pool
    * @param _targetAvaxAmount amount of AVAX to be repaid from staking position
    * @param _to address to which send funds from liquidation
    **/
    function liquidateYak(uint256 _targetAvaxAmount, address _to) private returns(bool) {
        address yakRouterAddress = address(SmartLoanLib.getYieldYakRouter());
        (bool successApprove, ) = address(SmartLoanLib.getYakAvaxStakingContract()).call(
            abi.encodeWithSignature("approve(address,uint256)", yakRouterAddress, _targetAvaxAmount)
        );
        if (!successApprove) return false;

        (bool successUnstake, bytes memory result) = yakRouterAddress.call(
            abi.encodeWithSignature("unstakeAVAXForASpecifiedAmount(uint256)", _targetAvaxAmount)
        );

        if (!successUnstake) return false;

        //    uint256 amount = abi.decode(result, (uint256));
        //TODO: return from unstakeAVAX the real value ustaken
        uint256 amount = Math.min(_targetAvaxAmount, address(this).balance);

        SmartLoanLib.getNativeTokenWrapped().deposit{value: amount}();
        address(SmartLoanLib.getNativeTokenWrapped()).safeTransfer(_to, amount);

        return successUnstake;
    }

    // Needed for isSolvent() modifier - possibly #TODO: create a base class out of this
    /**
     * LoanToValue ratio is calculated as the ratio between debt and collateral (defined as total value minus debt).
     * The collateral is equal to total loan value takeaway debt.
     * @dev This function uses the redstone-evm-connector
     **/
    function getLTV() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        return LTVLib.calculateLTV(prices);
    }

    /**
    * Checks if the loan is solvent.
    * It means that the ratio between debt and current collateral (defined as total value minus debt) is below safe level,
    * which is parametrized by the getMaxLtv()
    * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view returns (bool) {
        return getLTV() < SmartLoanLib.getMaxLtv();
    }

    /**
    * Checks whether account is solvent (LTV lower than SmartLoanLib.getMaxLtv())
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;

        require(isSolvent(), "The action may cause an account to become insolvent");
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
    * @param debtRepaid the amount of a borrowed AVAX that was repaid back to the pool
    * @param withdrawalAmount the amount of AVAX that was withdrawn by the owner after closing the loan
    * @param timestamp a time of the loan's closure
    **/
    event LoanClosed(uint256 debtRepaid, uint256 withdrawalAmount, uint256 timestamp);
}

