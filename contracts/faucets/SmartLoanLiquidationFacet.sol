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

    /**
         * This function can be accessed by any user when Prime Account is insolvent and perform partial liquidation
         * (selling assets, closing positions and repaying debts) to bring the account back to a solvent state. At the end
         * of liquidation resulting solvency of account is checked to make sure that the account is between maximum and minimum
         * solvency.
         * @dev This function uses the redstone-evm-connector
         * @param _toRepayInUsd amount in USD calculated off-chain that has to be repaid to pools to make account solvent again
         * @param _orderOfPools order in which debts are repaid to pools, defined by liquidator for efficiency
         **/
    function liquidateLoan(uint256 _toRepayInUsd, uint256[] memory _orderOfPools) external payable nonReentrant {
        LibDiamond.LiquidationStorage storage ls = LibDiamond.liquidationStorage();
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        uint256 leftToRepayInUsd = _toRepayInUsd;

        require(LTVLib.calculateLTV(assets, prices) >= SmartLoanLib.getMaxLtv(), "Cannot sellout a solvent account");
        ls._liquidationInProgress = true;

        //in case critically insolvent loans it might be needed to use native AVAX a loan has to bring loan to solvency.
        //AVAX can be also provided in the transaction as well to "rescue" a loan
        SmartLoanLib.getNativeTokenWrapped().deposit{value: address(this).balance}();

        //to avoid stack too deep error
        {
            uint256 debt = LTVLib.calculateDebt(assets, prices);

            if (leftToRepayInUsd > debt) {
                leftToRepayInUsd = debt;
            }
        }

        uint256 bonus = (leftToRepayInUsd * SmartLoanLib.getLiquidationBonus()) / SmartLoanLib.getPercentagePrecision();

        //repay iterations without swapping assets
        uint32 i;

        while (leftToRepayInUsd > 0 && i < _orderOfPools.length) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[_orderOfPools[i]];
            IERC20Metadata poolToken = LTVLib.getERC20TokenInstance(assets[assetIndex]);


            uint256 repaid = LTVLib.repayAmount(
                LTVLib.RepayConfig(
                    false,
                    leftToRepayInUsd * 10 ** poolToken.decimals() / (prices[assetIndex]) / 10**10,
                    assetIndex,
                    0,
                    prices,
                    assets
                )
            );

            uint256 repaidInUsd = repaid * prices[assetIndex] * 10**10 / 10 ** poolToken.decimals();

            if (repaidInUsd > leftToRepayInUsd) {
                leftToRepayInUsd = 0;
                break;
            } else {
                leftToRepayInUsd -= repaidInUsd;
            }

            i++;
        }

        //repay iterations with swapping assets
        i = 0;
        uint256 sentToLiquidator;

        while (i < _orderOfPools.length) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[_orderOfPools[i]];
            sentToLiquidator = 0;
            IERC20Metadata poolToken = LTVLib.getERC20TokenInstance(assets[assetIndex]);

            //only for a native token- we perform bonus transfer for a liquidator
            if (_orderOfPools[i] == 0) {
                sentToLiquidator = bonus * 10 ** poolToken.decimals() / prices[assetIndex] / 10**10;
            }

            uint256 repaid = LTVLib.repayAmount(
                LTVLib.RepayConfig(
                    true,
                    leftToRepayInUsd *  10 ** poolToken.decimals() / prices[assetIndex] / 10**10,
                    assetIndex,
                    sentToLiquidator,
                    prices,
                    assets
                )
            );

            uint256 repaidInUsd = repaid * prices[assetIndex] * 10**10 / 10 ** poolToken.decimals();

            if (repaidInUsd >= leftToRepayInUsd) {
                leftToRepayInUsd = 0;
                break;
            } else {
                leftToRepayInUsd -= repaidInUsd;
            }

            i++;
        }

        //TODO: make more generic in the future
        //repay with staked tokens
        uint256 avaxToRepay = leftToRepayInUsd * 10**8 / prices[0];
        uint256 stakedAvaxRepaid = Math.min(avaxToRepay, SmartLoanLib.getYieldYakRouter().getTotalStakedValue());

        if (repayWithStakedAVAX(stakedAvaxRepaid)) {
            leftToRepayInUsd -= stakedAvaxRepaid * prices[0] / 10**8;
        }

        uint256 LTV = LTVLib.calculateLTV(assets, prices);

        emit Liquidated(msg.sender, _toRepayInUsd - leftToRepayInUsd, bonus, LTV, block.timestamp);

        if (msg.sender != LibDiamond.contractOwner()) {
            require(LTV >= SmartLoanLib.getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        require(LTV < SmartLoanLib.getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
        ls._liquidationInProgress = false;
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
     * Unstake AVAX amount to perform repayment to a pool
     * @param _targetAvaxAmount amount of AVAX to be repaid from staking position
     **/
    function repayWithStakedAVAX(uint256 _targetAvaxAmount) private returns(bool) {
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

        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(bytes32("AVAX")));

        address(SmartLoanLib.getNativeTokenWrapped()).safeApprove(address(pool), 0);
        address(SmartLoanLib.getNativeTokenWrapped()).safeApprove(address(pool), amount);

        bool successRepay;
        (successRepay, ) = address(pool).call{value: 0}(
            abi.encodeWithSignature("repay(uint256)", amount)
        );

        return successRepay;
    }
}

