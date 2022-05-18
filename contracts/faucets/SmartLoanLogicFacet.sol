pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "../lib/SmartLoanLib.sol";
import { LibDiamond } from "../lib/LibDiamond.sol";
import "../mock/WAVAX.sol";
import "../ERC20Pool.sol";


// TODO: Optimize getting diamondStorage - once per function
contract SmartLoanLogicFacet is PriceAware, ReentrancyGuard {
    using TransferHelper for address payable;
    using TransferHelper for address;

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
     * Funds the loan with a specified amount of a defined token
     * @dev Requires approval for ERC20 token on frontend side
     **/
    function fund(bytes32 _fundedAsset, uint256 _amount) public virtual {
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset);
        TransferHelper.safeTransferFrom(address(token), msg.sender, address(this), _amount);

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

   /**
   * Withdraws an amount of a defined asset from the loan
   * This method could be used to cash out profits from investments
   * The loan needs to remain solvent after the withdrawal
   * @param _withdrawnAsset asset to be withdrawn
   * @param _amount to be withdrawn
   * @dev This function uses the redstone-evm-connector
   **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset);
        require(getBalance(address(this), _withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

        token.transfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
     * Borrows funds from the pool
     * @param _asset to borrow
     * @param _amount of funds to borrow
     * @dev This function uses the redstone-evm-connector
     **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(_asset));
        pool.borrow(_amount);

        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }


    /**
     * Repays funds to the pool
     * @param _asset to repay
     * @param _amount of funds to repay
     * @dev This function uses the redstone-evm-connector
     **/
    function repay(bytes32 _asset, uint256 _amount) public payable {
        IERC20Metadata token = getERC20TokenInstance(_asset);
        SmartLoanLib.getNativeTokenWrapped().deposit{value: msg.value}();

        if (isSolvent() && SmartLoanLib.getLiquidationInProgress() == false) {
            LibDiamond.enforceIsContractOwner();
        }

        uint256 price = getPriceFromMsg(_asset);

        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(_asset));
        uint256 poolDebt = pool.getBorrowed(address(this)) * price * 10**10 / 10 ** token.decimals();

        _amount = Math.min(_amount, poolDebt);
        require(token.balanceOf(address(this)) >= _amount, "There is not enough funds to repay the loan");

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);
    }


   /**
   * Swaps one asset to another
   * @param _soldAsset asset to be sold
   * @param _boughtAsset asset to be bought
   * @param _exactSold exact amount of asset to be sold
   * @param _minimumBought minimum amount of asset to be bought
   * @dev This function uses the redstone-evm-connector
   **/
    function swap(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public virtual onlyOwner remainsSolvent returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }


   /**
   * Stakes AVAX in Yield Yak protocol
   * @param _amount amount of AVAX to be staked
   * @dev This function uses the redstone-evm-connector
   **/
    function stakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
        require(SmartLoanLib.getNativeTokenWrapped().balanceOf(address(this)) >= _amount, "Not enough AVAX available");

        SmartLoanLib.getNativeTokenWrapped().withdraw(_amount);
        SmartLoanLib.getYieldYakRouter().stakeAVAX{value: _amount}(_amount);
    }


    /**
   * Unstakes AVAX from Yield Yak protocol
   * @param _amount amount of AVAX to be unstaked
   * @dev This function uses the redstone-evm-connector
   **/
    function unstakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
        IYieldYakRouter yakRouter = SmartLoanLib.getYieldYakRouter();
        address(SmartLoanLib.getYakAvaxStakingContract()).safeApprove(address(yakRouter), _amount);

        require(yakRouter.unstakeAVAX(_amount), "Unstaking failed");
        SmartLoanLib.getNativeTokenWrapped().deposit{value: _amount}();
    }

    /**
   * This function can only be accessed by the owner and allows closing all positions and repaying all debts.
   * @dev This function uses the redstone-evm-connector
   **/
    function closeLoan() public virtual payable onlyOwner nonReentrant remainsSolvent {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        uint256 debt = calculateDebt(assets, prices);
        SmartLoanLib.getNativeTokenWrapped().deposit{value: address(this).balance}();

        require(calculateAssetsValue(assets, prices) >= debt, "Not possible to repay fully the debt");

        uint256 i;

        for (i = 0; i < SmartLoanLib.getPoolsAssetsIndices().length; i++) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[i];
            IERC20Metadata token = getERC20TokenInstance(assets[assetIndex]);
            address poolAddress = SmartLoanLib.getPoolAddress(assets[assetIndex]);

            if (poolAddress != address(0)) {
                repayAmount(
                    RepayConfig(
                        true,
                        ERC20Pool(poolAddress).getBorrowed(address(this)),
                        assetIndex,
                        0,
                        prices,
                        assets
                    )
                );
            }
        }

        for (i = 0; i < assets.length; i++) {
            IERC20Metadata token = getERC20TokenInstance(assets[i]);
            uint256 balance = token.balanceOf(address(this));

            if (balance > 0) {
                address(token).safeTransfer(msg.sender, balance);
            }
        }

        emit LoanClosed(debt, address(this).balance, block.timestamp);
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
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        uint256 leftToRepayInUsd = _toRepayInUsd;

        require(calculateLTV(assets, prices) >= SmartLoanLib.getMaxLtv(), "Cannot sellout a solvent account");
        ds._liquidationInProgress = true;

        //in case critically insolvent loans it might be needed to use native AVAX a loan has to bring loan to solvency.
        //AVAX can be also provided in the transaction as well to "rescue" a loan
        SmartLoanLib.getNativeTokenWrapped().deposit{value: address(this).balance}();

        //to avoid stack too deep error
        {
            uint256 debt = calculateDebt(assets, prices);

            if (leftToRepayInUsd > debt) {
                leftToRepayInUsd = debt;
            }
        }

        uint256 bonus = (leftToRepayInUsd * SmartLoanLib.getLiquidationBonus()) / SmartLoanLib.getPercentagePrecision();

        //repay iterations without swapping assets
        uint32 i;

        while (leftToRepayInUsd > 0 && i < _orderOfPools.length) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[_orderOfPools[i]];
            IERC20Metadata poolToken = getERC20TokenInstance(assets[assetIndex]);


            uint256 repaid = repayAmount(
                RepayConfig(
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
            IERC20Metadata poolToken = getERC20TokenInstance(assets[assetIndex]);

            //only for a native token- we perform bonus transfer for a liquidator
            if (_orderOfPools[i] == 0) {
                sentToLiquidator = bonus * 10 ** poolToken.decimals() / prices[assetIndex] / 10**10;
            }

            uint256 repaid = repayAmount(
                RepayConfig(
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

        uint256 LTV = calculateLTV(assets, prices);

        emit Liquidated(msg.sender, _toRepayInUsd - leftToRepayInUsd, bonus, LTV, block.timestamp);

        if (msg.sender != LibDiamond.contractOwner()) {
            require(LTV >= SmartLoanLib.getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
        }

        require(LTV < SmartLoanLib.getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
        ds._liquidationInProgress = false;
    }

    //TODO: write a test for it
    function wrapNativeToken(uint256 amount) onlyOwner public {
        require(amount <= address(this).balance, "Not enough AVAX to wrap");
        SmartLoanLib.getNativeTokenWrapped().deposit{value: amount}();
    }

    receive() external payable {}

    /* ========== VIEW FUNCTIONS ========== */


    /**
     * Returns the current debt from all lending pools
     * @dev This function uses the redstone-evm-connector
     **/
    function getDebt() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        return calculateDebt(assets, prices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getTotalValue() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        return calculateAssetsValue(assets, prices);
    }
    function getFullLoanStatus() public view returns (uint256[4] memory) {
        return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
    }

    /**
     * Checks if the loan is solvent.
     * It means that the ratio between debt and current collateral (defined as total value minus debt) is below safe level,
     * which is parametrized by the SmartLoanLib.getMaxLtv()
     * @dev This function uses the redstone-evm-connector
     **/
    function isSolvent() public view returns (bool) {
        return getLTV() < SmartLoanLib.getMaxLtv();
    }

    /**
     * Returns the balances of all assets served by the price provider
     * It could be used as a helper method for UI
     **/
    function getAllAssetsBalances() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory balances = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            balances[i] = getBalance(address(this), assets[i]);
        }

        return balances;
    }

    /**
     * Returns the prices of all assets served by the price provider
     * It could be used as a helper method for UI
     * @dev This function uses the redstone-evm-connector
     **/
    function getAllAssetsPrices() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();

        return getPricesFromMsg(assets);
    }

    /**
     * Returns the current debts associated with the loan as well as total debt
     **/
    function getDebts() public view virtual returns (uint256[] memory, uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        return calculateDebts(assets, prices);
    }

    /**
     * LoanToValue ratio is calculated as the ratio between debt and collateral (defined as total value minus debt).
     * The collateral is equal to total loan value takeaway debt.
     * @dev This function uses the redstone-evm-connector
     **/
    function getLTV() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        return calculateLTV(assets, prices);
    }

    /**
     * Returns a current balance of the asset held by a given account
     * @param _account the address of queried user
     * @param _asset the code of an asset
     **/
    function getBalance(address _account, bytes32 _asset) public view returns (uint256) {
        IERC20 token = IERC20(SmartLoanLib.getExchange().getAssetAddress(_asset));
        return token.balanceOf(_account);
    }

    /* ========== INTERNAL AND PRIVATE FUNCTIONS ========== */

    /**
     * Swaps one asset with another
     * @param _soldAsset asset to be sold
     * @param _boughtAsset asset to be bought
     * @param _exactSold exact amount of asset to be sold
     * @param _minimumBought minimum amount of asset to be bought
     **/
    function swapAssets(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) internal returns(uint256[] memory) {
        IERC20Metadata soldToken = getERC20TokenInstance(_soldAsset);

        require(soldToken.balanceOf(address(this)) >= _exactSold, "Not enough token to sell");
        address(soldToken).safeTransfer(address(SmartLoanLib.getExchange()), _exactSold);

        uint256[] memory amounts = SmartLoanLib.getExchange().swap(_soldAsset, _boughtAsset, _exactSold, _minimumBought);

        emit Swap(msg.sender, _soldAsset, _boughtAsset, amounts[0],  amounts[amounts.length - 1], block.timestamp);

        return amounts;
    }

    /**
     * Calculates the current value of Prime Account in USD including all tokens as well as staking and LP positions
     **/
    function calculateAssetsValue(bytes32[] memory assets, uint256[] memory prices) internal view virtual returns (uint256) {
        uint256 total = address(this).balance * prices[0] / 10**8;

        for (uint256 i = 0; i < prices.length; i++) {
            require(prices[i] != 0, "Asset price returned from oracle is zero");

            bytes32 _asset = assets[i];
            IERC20Metadata token = getERC20TokenInstance(_asset);
            uint256 assetBalance = getBalance(address(this), _asset);

            total = total + (prices[i] * 10**10 * assetBalance / (10 ** token.decimals()));
        }

        total += SmartLoanLib.getYieldYakRouter().getTotalStakedValue() * prices[0] / 10**8;

        return total;
    }

    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
        address assetAddress = SmartLoanLib.getExchange().getAssetAddress(_asset);
        IERC20Metadata token = IERC20Metadata(assetAddress);
        return token;
    }

    /**
     * Calculates the current debt as a sum of debts from all lending pools
     * @param _assets list of supported assets
     * @param _prices current prices
     **/
    function calculateDebt(bytes32[] memory _assets, uint256[] memory _prices) internal view virtual returns (uint256) {
        uint256 debt = 0;

        for (uint256 i = 0; i < SmartLoanLib.getPoolsAssetsIndices().length; i++) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[i];
            IERC20Metadata token = getERC20TokenInstance(_assets[assetIndex]);
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
            debt = debt + ERC20Pool(SmartLoanLib.getPoolAddress(_assets[assetIndex])).getBorrowed(address(this)) * _prices[assetIndex] * 10**10
            / 10 ** token.decimals();
        }

        return debt;
    }

    /**
     * Returns current debts associated with the loan and its total debt
     * @param _assets list of supported assets
     * @param _prices current prices
     **/
    function calculateDebts(bytes32[] memory _assets, uint256[] memory _prices) internal virtual view returns (uint256[] memory, uint256) {
        uint length = SmartLoanLib.getPoolsAssetsIndices().length;
        uint256[] memory debts = new uint256[](length);
        uint256 totalDebt;

        uint256 i;

        for (i = 0; i < length; i++) {
            uint256 assetIndex = SmartLoanLib.getPoolsAssetsIndices()[i];
            IERC20Metadata token = getERC20TokenInstance(_assets[assetIndex]);
            uint256 poolDebt = ERC20Pool(SmartLoanLib.getPoolAddress(_assets[assetIndex])).getBorrowed(address(this)) * _prices[assetIndex] * 10**10 / 10 ** token.decimals();
            debts[i] = poolDebt;
            totalDebt += poolDebt;
        }

        return (debts, totalDebt);
    }

    /**
     * Returns current Loan To Value (solvency ratio) associated with the loan, defined as debt / (total value - debt)
     * @param _assets list of supported assets
     * @param _prices current prices
     **/
    function calculateLTV(bytes32[] memory  _assets, uint256[] memory _prices) internal virtual view returns (uint256) {
        uint256 debt = calculateDebt(_assets, _prices);
        uint256 totalValue = calculateAssetsValue(_assets, _prices);

        if (debt == 0) {
            return 0;
        } else if (debt < totalValue) {
            return (debt * SmartLoanLib.getPercentagePrecision()) / (totalValue - debt);
        } else {
            return SmartLoanLib.getMaxLtv();
        }
    }

    /**
     * This function role is to repay a defined amount of debt during liquidation or closing account.
     * @param _repayConfig configuration for repayment
     **/
    function repayAmount(RepayConfig memory _repayConfig) private returns (uint256) {
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

    /* ========== MODIFIERS ========== */

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

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after a loan is funded
     * @param funder the address which funded the loan
     * @param asset funded by an investor
     * @param amount the amount of funds
     * @param timestamp time of funding
     **/
    event Funded(address indexed funder, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after the funds are withdrawn from the loan
     * @param owner the address which withdraws funds from the loan
     * @param asset withdrawn by an investor
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawn(address indexed owner, bytes32 indexed asset, uint256 amount, uint256 timestamp);

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
     * @dev emitted when funds are borrowed from the pool
     * @param borrower the address of borrower
     * @param asset borrowed by an investor
     * @param amount of the borrowed funds
     * @param timestamp time of the borrowing
     **/
    event Borrowed(address indexed borrower, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool
     * @param borrower the address initiating repayment
     * @param _asset asset repaid by an investor
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event Repaid(address indexed borrower, bytes32 indexed _asset, uint256 amount, uint256 timestamp);

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