// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./ERC20Pool.sol";
import "./SmartLoanProperties.sol";

/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract SmartLoan is SmartLoanProperties, PriceAware, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  function initialize() external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
  }

  /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

  /**
   * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
   **/
  function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
    return MAX_BLOCK_TIMESTAMP_DELAY;
  }

  /**
   * Override PriceAware method, addresses below belong to authorized signers of data feeds
   **/
  function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
    return (_receivedSigner == getPriceProvider1()) || (_receivedSigner == getPriceProvider2());
  }

  /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

  /**
   * Funds the loan with a specified amount of a defined token
   * @param _fundedAsset asset to be funded
   * @param _amount to be funded
   * @dev Requires approval for ERC20 token on frontend side
   **/
  function fund(bytes32 _fundedAsset, uint256 _amount) public virtual {
    IERC20Metadata token = getERC20TokenInstance(_fundedAsset);
    address(token).safeTransferFrom(msg.sender, address(this), _amount);

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
    require(getBalance(_withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

    address(token).safeTransfer(msg.sender, _amount);

    emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
  }

  /**
   * Borrows funds from the pool
   * @param _asset to be borrowed
   * @param _amount of funds to borrow
   * @dev This function uses the redstone-evm-connector
   **/
  function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
    ERC20Pool pool = ERC20Pool(getPoolAddress(_asset));
    pool.borrow(_amount);

    emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
  }

  /**
   * Repays funds to the pool
   * @param _asset to be repaid
   * @param _amount of funds to repay
   * @dev This function uses the redstone-evm-connector
   **/
  function repay(bytes32 _asset, uint256 _amount) public payable {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    getNativeTokenWrapped().deposit{value: msg.value}();

    if (isSolvent() && _liquidationInProgress == false) {
      require(msg.sender == owner());
    }

    uint256 price = getPriceFromMsg(_asset);

    ERC20Pool pool = ERC20Pool(getPoolAddress(_asset));
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
    require(getNativeTokenWrapped().balanceOf(address(this)) >= _amount, "Not enough AVAX available");

    getNativeTokenWrapped().withdraw(_amount);

    getYieldYakRouter().stakeAVAX{value: _amount}(_amount);
  }

  /**
   * Unstakes AVAX from Yield Yak protocol
   * @param _amount amount of AVAX to be unstaked
   * @dev This function uses the redstone-evm-connector
   **/
  function unstakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
    IYieldYakRouter yakRouter = getYieldYakRouter();
    address(getYakAvaxStakingContract()).safeApprove(address(yakRouter), _amount);

    require(yakRouter.unstakeAVAX(_amount), "Unstaking failed");
    getNativeTokenWrapped().deposit{value: _amount}();
  }


  /**
   * This function can be accessed by any user when Prime Account is insolvent and perform partial liquidation
   * (selling assets, closing positions and repaying debts) to bring the account back to a solvent state. At the end
   * of liquidation resulting solvency of account is checked to make sure that the account is between maximum and minimum
   * solvency.
   * To diminish the potential effect of manipulation of liquidity pools by a liquidator, there are no swaps performed
   * during liquidation. A liquidator has to approve adequate amount of tokens to repay debts to liquidity pools if
   * there is not enough of them in a SmartLoan. For that he will receive the corresponding amount from SmartLoan
   * with the same USD value + bonus.
   * @dev This function uses the redstone-evm-connector
   * @param _amountsToRepay amounts of tokens to be repaid to pools (the same order as in getPoolsAssetsIndices method)
   **/
  function liquidateLoan(uint256[] memory _amountsToRepay) external payable nonReentrant {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory prices = getPricesFromMsg(assets);

    require(calculateLTV(assets, prices) >= getMaxLtv(), "Cannot sellout a solvent account");

    uint256 suppliedInUSD;
    uint256 repaidInUSD;

    for (uint256 i; i < getPoolsAssetsIndices().length; i++) {
      uint256 poolAssetIndex = getPoolsAssetsIndices()[i];
      IERC20Metadata token = getERC20TokenInstance(assets[poolAssetIndex]);

      uint256 balance = token.balanceOf(address(this));
      uint256 allowance = token.allowance(msg.sender, address(this));
      uint256 needed;

      if (_amountsToRepay[i] > balance) {
        needed = _amountsToRepay[i] - balance;
      }

      if (needed > 0) {
        require(needed <= allowance, "Not enough allowance for the token");

      address(token).safeTransferFrom(msg.sender, address(this), needed);
        suppliedInUSD += needed * prices[poolAssetIndex] * 10**10 / 10 ** token.decimals();
      }

      ERC20Pool pool = ERC20Pool(getPoolAddress(assets[poolAssetIndex]));

      address(token).safeApprove(address(pool), 0);
      address(token).safeApprove(address(pool), _amountsToRepay[i]);

      repaidInUSD += _amountsToRepay[i] * prices[poolAssetIndex] * 10**10 / 10 ** token.decimals();

      pool.repay(_amountsToRepay[i]);
    }

    uint256 valueOfTokens = calculateAssetsValue(assets, prices);
    uint256 total = getTotalValue();

    uint256 bonus = repaidInUSD * getLiquidationBonus();

    uint256 partToReturn = 10**18;

    if (valueOfTokens >= suppliedInUSD + bonus) {
      uint256 partToReturn = suppliedInUSD * 10**18 / total + bonus * 10**18 / total / getPercentagePrecision();
    } else {
      //meaning staking or LP positions
      uint256 toReturnFromPositions = suppliedInUSD + bonus - valueOfTokens;
      liquidatePositions(toReturnFromPositions, msg.sender);
    }

    for (uint256 i; i < assets.length; i++) {
      IERC20Metadata token = getERC20TokenInstance(assets[i]);
      uint256 balance = token.balanceOf(address(this));

      address(token).safeTransfer(msg.sender, balance * partToReturn / 10**18);
    }

    uint256 LTV = calculateLTV(assets, prices);

    emit Liquidated(msg.sender, repaidInUSD, bonus, LTV, block.timestamp);

    if (msg.sender != owner()) {
      require(LTV >= getMinSelloutLtv(), "This operation would result in a loan with LTV lower than Minimal Sellout LTV which would put loan's owner in a risk of an unnecessarily high loss");
    }

    require(LTV < getMaxLtv(), "This operation would not result in bringing the loan back to a solvent state");
    _liquidationInProgress = false;
  }

  //TODO: write a test for it
  function wrapNativeToken(uint256 amount) onlyOwner public {
    require(amount <= address(this).balance, "Not enough AVAX to wrap");
    getNativeTokenWrapped().deposit{value: amount}();
  }

  function depositNativeToken() public payable virtual {
    getNativeTokenWrapped().deposit{value: msg.value}();

    emit DepositNative(msg.sender, msg.value, block.timestamp);
  }

  receive() external payable {}

  /* ========== VIEW FUNCTIONS ========== */


  /**
   * Returns the current debt from all lending pools
   * @dev This function uses the redstone-evm-connector
   **/
  function getDebt() public view virtual returns (uint256) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory prices = getPricesFromMsg(assets);

    return calculateDebt(assets, prices);
  }

  /**
   * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
   * @dev This function uses the redstone-evm-connector
   **/
  function getTotalValue() public view virtual returns (uint256) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory prices = getPricesFromMsg(assets);

    return calculateAssetsValue(assets, prices);
  }
  function getFullLoanStatus() public view returns (uint256[4] memory) {
    return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
  }

  /**
   * Checks if the loan is solvent.
   * It means that the ratio between debt and current collateral (defined as total value minus debt) is below safe level,
   * which is parametrized by the getMaxLtv()
   * @dev This function uses the redstone-evm-connector
   **/
  function isSolvent() public view returns (bool) {
    return getLTV() < getMaxLtv();
  }

  //TODO: we should have a data with staking and LP positions as well
  /**
   * Returns the balances of all assets served by the price provider
   * It could be used as a helper method for UI
   **/
  function getAllAssetsBalances() public view returns (uint256[] memory) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory balances = new uint256[](assets.length);

    for (uint256 i = 0; i < assets.length; i++) {
      balances[i] = getBalance(assets[i]);
    }

    return balances;
  }

  /**
   * Returns the prices of all assets served by the price provider
   * It could be used as a helper method for UI
   * @dev This function uses the redstone-evm-connector
   **/
  function getAllAssetsPrices() public view returns (uint256[] memory) {
    bytes32[] memory assets = getExchange().getAllAssets();

    return getPricesFromMsg(assets);
  }

  /**
   * Returns the current debts associated with the loan as well as total debt
   **/
  function getDebts() public view virtual returns (uint256[] memory) {
    bytes32[] memory assets = getExchange().getAllAssets();

    uint length = getPoolsAssetsIndices().length;
    uint256[] memory debts = new uint256[](length);

    uint256 i;


    for (i = 0; i < length; i++) {
      uint256 assetIndex = getPoolsAssetsIndices()[i];
      debts[i] = ERC20Pool(getPoolAddress(assets[assetIndex])).getBorrowed(address(this));
    }

    return debts;
  }

  /**
   * LoanToValue ratio is calculated as the ratio between debt and collateral (defined as total value minus debt).
   * The collateral is equal to total loan value takeaway debt.
   * @dev This function uses the redstone-evm-connector
   **/
  function getLTV() public view virtual returns (uint256) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory prices = getPricesFromMsg(assets);
    return calculateLTV(assets, prices);
  }

  /**
   * Returns a current balance of the asset held by the smart loan
   * @param _asset the code of an asset
   **/
  function getBalance(bytes32 _asset) public view returns (uint256) {
    IERC20 token = IERC20(getExchange().getAssetAddress(_asset));
    return token.balanceOf(address(this));
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
    address(soldToken).safeTransfer(address(getExchange()), _exactSold);

    uint256[] memory amounts = getExchange().swap(_soldAsset, _boughtAsset, _exactSold, _minimumBought);

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
      uint256 assetBalance = getBalance(_asset);

      total = total + (prices[i] * 10**10 * assetBalance / (10 ** token.decimals()));
    }

    total += getYieldYakRouter().getTotalStakedValue() * prices[0] / 10**8;

    return total;
  }

  /**
   * Returns IERC20Metadata instance of a token
   * @param _asset the code of an asset
   **/
  function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
    address assetAddress = getExchange().getAssetAddress(_asset);
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

    for (uint256 i = 0; i < getPoolsAssetsIndices().length; i++) {
      uint256 assetIndex = getPoolsAssetsIndices()[i];
      IERC20Metadata token = getERC20TokenInstance(_assets[assetIndex]);
      //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
      debt = debt + ERC20Pool(getPoolAddress(_assets[assetIndex])).getBorrowed(address(this)) * _prices[assetIndex] * 10**10
      / 10 ** token.decimals();
    }

    return debt;
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
      return (debt * getPercentagePrecision()) / (totalValue - debt);
    } else {
      return getMaxLtv();
    }
  }

  /**
   * Liquidates staking and LP positions and sends tokens to defined address
   * @param _targetUsdAmount value in USD to be repaid from positions
   * @param _to address to which send funds from liquidation
   **/
  function liquidatePositions(uint256 _targetUsdAmount, address _to) private returns(bool) {
      return liquidateYak(_targetUsdAmount, _to);
  }

    /**
     * Unstake AVAX amount to perform repayment to a pool
     * @param _targetAvaxAmount amount of AVAX to be repaid from staking position
     * @param _to address to which send funds from liquidation
   **/
  function liquidateYak(uint256 _targetAvaxAmount, address _to) private returns(bool) {
    address yakRouterAddress = address(getYieldYakRouter());
    (bool successApprove, ) = address(getYakAvaxStakingContract()).call(
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

    getNativeTokenWrapped().deposit{value: amount}();
    address(getNativeTokenWrapped()).safeTransfer(_to, _targetAvaxAmount);

    return successUnstake;
  }

  /* ========== MODIFIERS ========== */

  /**
  * Checks whether account is solvent (LTV lower than getMaxLtv())
  * @dev This modifier uses the redstone-evm-connector
  **/
  modifier remainsSolvent() {
    _;

    require(isSolvent(), "The action may cause an account to become insolvent");
  }

  /* ========== EVENTS ========== */

  /**
   * @dev emitted after a loan is funded
   * @param owner the address which funded the loan
   * @param asset funded by an investor
   * @param amount the amount of funds
   * @param timestamp time of funding
   **/
  event Funded(address indexed owner, bytes32 indexed asset, uint256 amount, uint256 timestamp);

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
   * @param owner the address of owner making the purchase
   * @param soldAsset sold by the investor
   * @param boughtAsset bought by the investor
   * @param _maximumSold maximum to be sold
   * @param _minimumBought minimum to be bought
   * @param timestamp time of the swap
   **/
  event Swap(address indexed owner, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 _maximumSold, uint256 _minimumBought, uint256 timestamp);

  /**
   * @dev emitted when funds are borrowed from the pool
   * @param owner the address of borrower
   * @param asset borrowed by an investor
   * @param amount of the borrowed funds
   * @param timestamp time of the borrowing
   **/
  event Borrowed(address indexed owner, bytes32 indexed asset, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted when funds are repaid to the pool
   * @param owner the address initiating repayment
   * @param _asset asset repaid by an investor
   * @param amount of repaid funds
   * @param timestamp of the repayment
   **/
  event Repaid(address indexed owner, bytes32 indexed _asset, uint256 amount, uint256 timestamp);

  /**
 * @dev emitted when funds are repaid to the pool
   * @param owner the address initiating repayment
   * @param amount of repaid funds
   * @param timestamp of the repayment
   **/
  event DepositNative(address indexed owner,  uint256 amount, uint256 timestamp);

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