// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAwareUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./Pool.sol";


/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract SmartLoan is OwnableUpgradeable, PriceAwareUpgradeable, ReentrancyGuardUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  uint256 public constant PERCENTAGE_PRECISION = 1000;
  // 10%
  uint256 public constant LIQUIDATION_BONUS = 100;

  // 500%
  uint256 public constant MAX_LTV = 5000;
  // 400%
  uint256 public constant MIN_SELLOUT_LTV = 4000;

  IAssetsExchange public exchange;
  Pool pool;

  function initialize(IAssetsExchange assetsExchange_, Pool pool_) external initializer {
    exchange = assetsExchange_;
    pool = pool_;
    __Ownable_init();
    __PriceAware_init();
  }


  /**
   * Override trustedSigner getter for safety reasons
  **/
  function getTrustedSigner() override virtual public view returns (address) {
    return 0x3a7d971De367FE15D164CDD952F64205F2D9f10c; //redstone-avalanche;
  }


  /**
   * Funds a loan with the value attached to the transaction
  **/
  function fund() external payable {

    emit Funded(msg.sender, msg.value, block.timestamp);
  }


  /**
   * This function allows selling assets without checking if the loan will remain solvent after this operation.
   * It is used as part of the sellout() function which sells part/all of assets in order to bring the loan back to solvency.
   * It is possible that multiple different assets will have to be sold and for that reason we do not use the remainsSolvent modifier.
  **/
  function sellAsset(bytes32 asset, uint256 _amount, uint256 _minAvaxOut) private {
    IERC20Metadata token = getERC20TokenInstance(asset);
    address(token).safeTransfer(address(exchange), _amount);
    exchange.sellAsset(asset, _amount, _minAvaxOut);
  }


  function withdrawAsset(bytes32 asset) external onlyOwner remainsSolvent {
    IERC20Metadata token = getERC20TokenInstance(asset);
    address(token).safeTransfer(msg.sender, token.balanceOf(address(this)));
  }


  /**
  * This function attempts to sell just enough asset to receive targetAvaxAmount.
  * If there is not enough asset's balance to cover the whole targetAvaxAmount then the whole asset's balance
  * is being sold.
  * It is possible that multiple different assets will have to be sold and for that reason we do not use the remainsSolvent modifier.
  **/
  function sellAssetForTargetAvax(bytes32 asset, uint256 targetAvaxAmount) private {
    IERC20Metadata token = getERC20TokenInstance(asset);
    uint256 balance = token.balanceOf(address(this));
    if (balance > 0) {
      uint256 minSaleAmount = exchange.getMinimumERC20TokenAmountForExactAVAX(targetAvaxAmount, address(token));
      if (balance < minSaleAmount) {
        sellAsset(asset, balance, 0);
      } else {
        sellAsset(asset, minSaleAmount, targetAvaxAmount);
      }
    }
  }


  /**
  * This function attempts to repay the _repayAmount back to the pool.
  * If there is not enough AVAX balance to repay the _repayAmount then the available AVAX balance will be repaid.
  **/
  function attemptRepay(uint256 _repayAmount) internal {
    repay(Math.min(address(this).balance, _repayAmount));
  }


  function payBonus(uint256 _bonus) internal {
    payable(msg.sender).safeTransferETH(Math.min(_bonus, address(this).balance));
  }



  /**
  * This function can only be accessed by the owner and allows selling all of the assets.
  **/
  function closeLoan() external payable onlyOwner remainsSolvent {
    bytes32[] memory assets = exchange.getAllAssets();
    for (uint i = 0; i < assets.length; i++) {
      uint256 balance = getERC20TokenInstance(assets[i]).balanceOf(address(this));
      if (balance > 0) {
        sellAsset(assets[i], balance, 0);
      }
    }

    uint256 debt = getDebt();
    if (address(this).balance < debt) revert DebtNotRepaidAfterLoanSelout();
    repay(debt);
    emit LoanClosed(debt, address(this).balance, block.timestamp);
    if (address(this).balance > 0) {
      withdraw(address(this).balance);
    }
  }


  function liquidateLoan(uint256 repayAmount) external payable successfulLiquidation {
    if(isSolvent()) revert LoanSolvent();

    uint256 debt = getDebt();
    if (repayAmount > debt) {
      repayAmount = debt;
    }
    uint256 bonus = repayAmount * LIQUIDATION_BONUS / PERCENTAGE_PRECISION;
    uint256 totalRepayAmount = repayAmount + bonus;

    sellout(totalRepayAmount);
    attemptRepay(repayAmount);
    payBonus(bonus);
    emit Liquidated(msg.sender, repayAmount, bonus, getLTV(), block.timestamp);
  }


  /**
  * This function role is to sell part/all of the available assets in order to receive the targetAvaxAmount.
  *
  **/
  function sellout(uint256 targetAvaxAmount) private {
      bytes32[] memory assets = exchange.getAllAssets();
      for (uint i = 0; i < assets.length; i++) {
        if (address(this).balance >= targetAvaxAmount) break;
        sellAssetForTargetAvax(assets[i], targetAvaxAmount - address(this).balance);
      }
  }


  /**
   * Withdraws an amount from the loan
   * This method could be used to cash out profits from investments
   * The loan needs to remain solvent after the withdrawal
   * @param _amount to be withdrawn
  **/
  function withdraw(uint256 _amount) public onlyOwner remainsSolvent nonReentrant {
    if(address(this).balance < _amount) revert InsufficientFundsForWithdrawal();

    payable(msg.sender).safeTransferETH(_amount);

    emit Withdrawn(msg.sender, _amount, block.timestamp);
  }


  /**
   * Invests an amount to buy an asset
   * @param _asset code of the asset
   * @param _exactERC20AmountOut exact amount of asset to buy
   * @param _maxAvaxAmountIn maximum amount of AVAX to sell
  **/
  function invest(bytes32 _asset, uint256 _exactERC20AmountOut, uint256 _maxAvaxAmountIn) external onlyOwner remainsSolvent {
    if(address(this).balance < _maxAvaxAmountIn) revert InsufficientFundsForInvestment();

    bool success = exchange.buyAsset{value : _maxAvaxAmountIn}(_asset, _exactERC20AmountOut);
    if (!success) revert InvestmentFailed();

    emit Invested(msg.sender, _asset, _exactERC20AmountOut, block.timestamp);
  }


  /**
   * Redeem an investment by selling an asset
   * @param _asset code of the asset
   * @param _exactERC20AmountIn exact amount of token to sell
   * @param _minAvaxAmountOut minimum amount of the AVAX token to buy
  **/
  function redeem(bytes32 _asset, uint256 _exactERC20AmountIn, uint256 _minAvaxAmountOut) external onlyOwner remainsSolvent {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    address(token).safeTransfer(address(exchange), _exactERC20AmountIn);
    bool success = exchange.sellAsset(_asset, _exactERC20AmountIn, _minAvaxAmountOut);
    if(!success) revert RedemptionFailed();

    emit Redeemed(msg.sender, _asset, _exactERC20AmountIn, block.timestamp);
  }


  /**
   * Borrows funds from the pool
   * @param _amount of funds to borrow
  **/
  function borrow(uint256 _amount) external onlyOwner remainsSolvent {
    pool.borrow(_amount);

    emit Borrowed(msg.sender, _amount, block.timestamp);
  }


  /**
   * Repays funds to the pool
   * @param _amount of funds to repay
  **/
  function repay(uint256 _amount) payable public {
    if (isSolvent()) {
      require(msg.sender == owner());
    }

    _amount = Math.min(_amount, getDebt());
    if (address(this).balance < _amount) revert InsufficientFundsToRepayDebt();

    pool.repay{value : _amount}();

    emit Repaid(msg.sender, _amount, block.timestamp);
  }


  receive() external payable {}


  /* ========== VIEW FUNCTIONS ========== */

  /**
    * Returns the current value of a loan including cash and investments
  **/
  function getTotalValue() public virtual view returns (uint256) {
    uint256 total = address(this).balance;
    bytes32[] memory assets = exchange.getAllAssets();

    for (uint i = 0; i < assets.length; i++) {
      total = total + getAssetValue(assets[i]);
    }
    return total;
  }


  /**
  * Returns the current balance of the asset held by a given user
  * @dev _asset the code of an asset
  * @dev _user the address of queried user
  **/
  function getBalance(address _user, bytes32 _asset) public  view returns(uint256) {
    IERC20 token = IERC20(exchange.getAssetAddress(_asset));
    return token.balanceOf(_user);
  }


  function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
    address assetAddress = exchange.getAssetAddress(_asset);
    IERC20Metadata token = IERC20Metadata(assetAddress);
    return token;
  }


  function getAssetPriceInAVAXWei(bytes32 _asset) internal view returns (uint256) {
    uint256 assetPrice = getPriceFromMsg(_asset);
    uint256 avaxPrice = getPriceFromMsg(bytes32('AVAX'));
    if (assetPrice == 0 || avaxPrice == 0) revert AssetPriceNotFoundInMsg();
    uint normalizedPrice = (assetPrice * 10 ** 18) / (avaxPrice);
    return normalizedPrice;
  }


  /**
    * Returns the current debt associated with the loan
  **/
  function getDebt() public virtual view returns (uint256) {
    return pool.getBorrowed(address(this));
  }


  /**
    * LoanToValue ratio is calculated as the ratio between debt and collateral.
    * The collateral is equal to total loan value takeaway debt.
  **/
  function getLTV() public view returns (uint256) {
    uint256 debt = getDebt();
    uint256 totalValue = getTotalValue();
    if (debt == 0) {
      return 0;
    } else if (debt < totalValue) {
      return debt * PERCENTAGE_PRECISION / (totalValue - debt);
    } else {
      return MAX_LTV;
    }
  }


  function getFullLoanStatus() public view returns (uint256[4] memory) {
    return [
    getTotalValue(),
    getDebt(),
    getLTV(),
    isSolvent() ? uint256(1) : uint256(0)
    ];
  }


  /**
    * Checks if the loan is solvent.
    * It means that the ratio between debt and collateral is below safe level,
    * which is parametrized by the MAX_LTV
  **/
  function isSolvent() public view returns (bool) {
    return getLTV() < MAX_LTV;
  }


  /**
    * Returns the value held on the loan contract in a given asset
    * @param _asset the code of the given asset
  **/
  function getAssetValue(bytes32 _asset) public view returns (uint256) {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    uint256 assetBalance = getBalance(address(this), _asset);
    if (assetBalance > 0) {
      return getAssetPriceInAVAXWei(_asset) * assetBalance / 10 ** token.decimals();
    } else {
      return 0;
    }
  }


  /**
    * Returns the balances of all assets served by the price provider
    * It could be used as a helper method for UI
  **/
  function getAllAssetsBalances() public view returns (uint256[] memory) {
    bytes32[] memory assets = exchange.getAllAssets();
    uint256[] memory balances = new uint256[] (assets.length);


    for (uint i = 0; i < assets.length; i++) {
      balances[i] = getBalance(address(this), assets[i]);
    }

    return balances;
  }


  /**
    * Returns the prices of all assets served by the price provider
    * It could be used as a helper method for UI
  **/
  function getAllAssetsPrices() public view returns (uint256[] memory) {
    bytes32[] memory assets = exchange.getAllAssets();
    uint256[] memory prices = new uint256[] (assets.length);


    for (uint i = 0; i < assets.length; i++) {
      prices[i] = getAssetPriceInAVAXWei(assets[i]);
    }

    return prices;
  }


  /* ========== MODIFIERS ========== */

  modifier remainsSolvent() {
    _;
    if(!isSolvent()) revert LoanInsolvent();
  }

  /**
  * This modifier checks if the LTV is between MIN_SELLOUT_LTV and MAX_LTV after performing the liquidateLoan() operation.
  * If the liquidateLoan() was not called by the owner then an additional check of making sure that LTV > MIN_SELLOUT_LTV is applied.
  * It protects the user from an unnecessarily costly liquidation.
  * The loan must be solvent after the liquidateLoan() operation.
  **/
  modifier successfulLiquidation() {
    _;
    uint256 LTV = getLTV();
    if (msg.sender != owner()) {
      if (LTV < MIN_SELLOUT_LTV) revert PostSelloutLtvTooLow();
    }
    if (LTV >= MAX_LTV) revert LoanInsolventAfterLiquidation();
  }


  /* ========== EVENTS ========== */

  /**
  * @dev emitted after a loan is funded
  * @param funder the address which funded the loan
  * @param amount the amount of funds
  * @param time of funding
  **/
  event Funded(address indexed funder, uint amount, uint time);


  /**
  * @dev emitted after the funds are withdrawn from the loan
  * @param owner the address which withdraws funds from the loan
  * @param amount the amount of funds withdrawn
  * @param time of the withdrawal
  **/
  event Withdrawn(address indexed owner, uint amount, uint time);


  /**
  * @dev emitted after the funds are invested into an asset
  * @param investor the address of investor making the purchase
  * @param asset bought by the investor
  * @param amount the investment
  * @param time of the investment
  **/
  event Invested(address indexed investor, bytes32 indexed asset, uint amount, uint time);


  /**
  * @dev emitted after the investment is sold
  * @param investor the address of investor selling the asset
  * @param asset sold by the investor
  * @param amount the investment
  * @param time of the redemption
  **/
  event Redeemed(address indexed investor, bytes32 indexed asset, uint amount, uint time);


  /**
  * @dev emitted when funds are borrowed from the pool
  * @param borrower the address of borrower
  * @param amount of the borrowed funds
  * @param time of the borrowing
  **/
  event Borrowed(address indexed borrower, uint amount, uint time);


  /**
  * @dev emitted when funds are repaid to the pool
  * @param borrower the address initiating repayment
  * @param amount of repaid funds
  * @param time of the repayment
  **/
  event Repaid(address indexed borrower, uint amount, uint time);


  /**
    * @dev emitted after a successful liquidation operation
    * @param liquidator the address that initiated the liquidation operation
    * @param repayAmount requested amount (AVAX) of liquidation
    * @param bonus an amount of bonus (AVAX) received by the liquidator
    * @param ltv a new LTV after the liquidation operation
    * @param time a time of the liquidation
  **/
  event Liquidated(address indexed liquidator, uint repayAmount, uint bonus, uint ltv, uint time);


  /**
    * @dev emitted after closing a loan by the owner
    * @param debtRepaid the amount of a borrowed AVAX that was repaid back to the pool
    * @param withdrawalAmount the amount of AVAX that was withdrawn by the owner after closing the loan
    * @param time a time of the loan's closure
  **/
  event LoanClosed(uint debtRepaid, uint withdrawalAmount, uint time);
}


/// Only the governor account can change the maximal LTV
error ChangeMaxLtvAccessDenied();

/// Only the governor account can change the minimal sellout LTV
error ChangeMinSelloutLTVAccessDenied();

/// Selling out all assets without repaying the whole debt is not allowed
error DebtNotRepaidAfterLoanSelout();

/// Cannot sellout a solvent account
error LoanSolvent();

/// There is not enough funds to withdraw
error InsufficientFundsForWithdrawal();

/// Not enough funds are available to invest in an asset
error InsufficientFundsForInvestment();

/// There is not enough funds to repay the loan
error InsufficientFundsToRepayDebt();

/// The action may cause an account to become insolvent
error LoanInsolvent();

/// This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss
error PostSelloutLtvTooLow();

/// This operation would not result in bringing the loan back to a solvent state
error LoanInsolventAfterLiquidation();

/// Investment failed
error InvestmentFailed();

/// Redemption failed
error RedemptionFailed();

/// Price for a chosen asset not found
error AssetPriceNotFoundInMsg();
