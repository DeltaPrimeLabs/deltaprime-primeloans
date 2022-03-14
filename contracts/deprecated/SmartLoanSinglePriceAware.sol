// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/deprecated/message-based/SinglePriceAwareUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../interfaces/IAssetsExchange.sol";
import "../Pool.sol";
import "../SmartLoanProperties.sol";

/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract SmartLoanSinglePriceAware is OwnableUpgradeable, SinglePriceAwareUpgradeable, ReentrancyGuardUpgradeable, SmartLoanProperties {
  using TransferHelper for address payable;
  using TransferHelper for address;

  function initialize() external initializer {
    __Ownable_init();
    __PriceAware_init();
  }


  function executeGetTotalValue() public virtual returns (uint256) {
    return getTotalValue();
  }


  function executeGetAllAssetsPrices() public returns (uint256[] memory) {
    return getAllAssetsPrices();
  }

  /**
   * Override trustedSigner getter for safety reasons
   **/
  function getTrustedSigner() public view virtual override returns (address) {
    return 0xFE71e9691B9524BC932C23d0EeD5c9CE41161884; //redstone-provider;
  }

  /**
   * Funds a loan with the value attached to the transaction
   **/
  function fund() external payable {
    emit Funded(msg.sender, msg.value, block.timestamp);
  }

  /**
   * Invests an amount to buy an asset
   * @param _asset code of the asset
   * @param _exactERC20AmountOut exact amount of asset to buy
   * @param _maxAvaxAmountIn maximum amount of AVAX to sell
   **/
  function invest(bytes32 _asset, uint256 _exactERC20AmountOut, uint256 _maxAvaxAmountIn) external onlyOwner nonReentrant remainsSolvent {
    require(address(this).balance >= _maxAvaxAmountIn, "Not enough funds are available to invest in an asset");

    bool success = getExchange().buyAsset{value: _maxAvaxAmountIn}(_asset, _exactERC20AmountOut);
    require(success, "Investment failed");

    emit Invested(msg.sender, _asset, _exactERC20AmountOut, block.timestamp);
  }


  /**
   * Borrows funds from the pool
   * @param _amount of funds to borrow
   **/
  function borrow(uint256 _amount) external onlyOwner remainsSolvent {
    getPool().borrow(_amount);

    emit Borrowed(msg.sender, _amount, block.timestamp);
  }


  receive() external payable {}

  /* ========== VIEW FUNCTIONS ========== */

  /**
   * Returns the current value of a loan including cash and investments
   **/
  function getTotalValue() public view virtual returns (uint256) {
    uint256 total = address(this).balance;
    bytes32[] memory assets = getExchange().getAllAssets();

    for (uint256 i = 0; i < assets.length; i++) {
      total = total + getAssetValue(assets[i]);
    }
    return total;
  }

  /**
   * Returns the current balance of the asset held by a given user
   * @dev _asset the code of an asset
   * @dev _user the address of queried user
   **/
  function getBalance(address _user, bytes32 _asset) public view returns (uint256) {
    IERC20 token = IERC20(getExchange().getAssetAddress(_asset));
    return token.balanceOf(_user);
  }

  function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
    address assetAddress = getExchange().getAssetAddress(_asset);
    IERC20Metadata token = IERC20Metadata(assetAddress);
    return token;
  }

  function getAssetPriceInAVAXWei(bytes32 _asset) internal view returns (uint256) {
    uint256 assetPrice = getPriceFromMsg(_asset);
    uint256 avaxPrice = getPriceFromMsg(bytes32("AVAX"));
    require(assetPrice != 0 && avaxPrice != 0, "Price for a chosen asset not found");
    uint256 normalizedPrice = (assetPrice * 10**18) / (avaxPrice);
    return normalizedPrice;
  }

  /**
   * Returns the current debt associated with the loan
   **/
  function getDebt() public view virtual returns (uint256) {
    return getPool().getBorrowed(address(this));
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
      return (debt * getPercentagePrecision()) / (totalValue - debt);
    } else {
      return getMaxLtv();
    }
  }

  function getFullLoanStatus() public view returns (uint256[4] memory) {
    return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
  }

  /**
   * Checks if the loan is solvent.
   * It means that the ratio between debt and collateral is below safe level,
   * which is parametrized by the getMaxLtv()
   **/
  function isSolvent() public view returns (bool) {
    return getLTV() < getMaxLtv();
  }

  /**
   * Returns the value held on the loan contract in a given asset
   * @param _asset the code of the given asset
   **/
  function getAssetValue(bytes32 _asset) public view returns (uint256) {
    IERC20Metadata token = getERC20TokenInstance(_asset);
    uint256 assetBalance = getBalance(address(this), _asset);
    if (assetBalance > 0) {
      return (getAssetPriceInAVAXWei(_asset) * assetBalance) / 10**token.decimals();
    } else {
      return 0;
    }
  }

  /**
   * Returns the balances of all assets served by the price provider
   * It could be used as a helper method for UI
   **/
  function getAllAssetsBalances() public view returns (uint256[] memory) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory balances = new uint256[](assets.length);

    for (uint256 i = 0; i < assets.length; i++) {
      balances[i] = getBalance(address(this), assets[i]);
    }

    return balances;
  }

  /**
   * Returns the prices of all assets served by the price provider
   * It could be used as a helper method for UI
   **/
  function getAllAssetsPrices() public view returns (uint256[] memory) {
    bytes32[] memory assets = getExchange().getAllAssets();
    uint256[] memory prices = new uint256[](assets.length);

    for (uint256 i = 0; i < assets.length; i++) {
      prices[i] = getAssetPriceInAVAXWei(assets[i]);
    }

    return prices;
  }

  /* ========== MODIFIERS ========== */

  modifier remainsSolvent() {
    _;
    require(isSolvent(), "The action may cause an account to become insolvent");
  }


  /* ========== EVENTS ========== */

  /**
   * @dev emitted after a loan is funded
   * @param funder the address which funded the loan
   * @param amount the amount of funds
   * @param timestamp time of funding
   **/
  event Funded(address indexed funder, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted after the funds are invested into an asset
   * @param investor the address of investor making the purchase
   * @param asset bought by the investor
   * @param amount the investment
   * @param timestamp time of the investment
   **/
  event Invested(address indexed investor, bytes32 indexed asset, uint256 amount, uint256 timestamp);

  /**
   * @dev emitted when funds are borrowed from the pool
   * @param borrower the address of borrower
   * @param amount of the borrowed funds
   * @param timestamp time of the borrowing
   **/
  event Borrowed(address indexed borrower, uint256 amount, uint256 timestamp);
}