// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 628836252957dd59eefb208ff6d0fd6605fe3445;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./aave_v3/flashloan/base/FlashLoanReceiverBase.sol";
import "./facets/SmartLoanLiquidationFacet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IWrappedNativeToken.sol";
import "./interfaces/facets/avalanche/IYieldYakRouter.sol";

contract LiquidationFlashloan is FlashLoanReceiverBase, Ownable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  address private constant YY_ROUTER =
    0xC4729E56b831d74bBc18797e0e17A295fA77488c;
  address wrappedNativeToken;
  SmartLoanLiquidationFacet whitelistedLiquidatorsContract;

  struct AssetAmount {
    address asset;
    uint256 amount;
  }

  struct LiqEnrichedParams {
    address loan;
    address liquidator;
    address tokenManager;
    uint256 bonus;
    IYieldYakRouter.FormattedOffer[] offers;
  }

  struct FlashLoanArgs {
    address[] assets;
    uint256[] amounts;
    uint256[] interestRateModes;
    bytes params;
    uint256 bonus;
    address liquidator;
    address loanAddress;
    address tokenManager;
    IYieldYakRouter.FormattedOffer[] offers;
  }

  constructor(
    address _addressProvider,
    address _wrappedNativeToken,
    SmartLoanLiquidationFacet _whitelistedLiquidatorsContract
  ) FlashLoanReceiverBase(IPoolAddressesProvider(_addressProvider)) {
    wrappedNativeToken = _wrappedNativeToken;
    whitelistedLiquidatorsContract = _whitelistedLiquidatorsContract;
  }

  function transferERC20(
    address tokenAddress,
    address recipient,
    uint256 amount
  ) external onlyOwner {
    tokenAddress.safeTransfer(recipient, amount);
  }

  // ---- Extract calldata arguments ----
  function getAssets() internal pure returns (address[] calldata result) {
    assembly {
      result.length := calldataload(add(calldataload(0x04), 0x04))
      result.offset := add(calldataload(0x04), 0x24)
    }
    return result;
  }

  function getAmounts() internal pure returns (uint256[] calldata result) {
    assembly {
      result.length := calldataload(add(calldataload(0x24), 0x04))
      result.offset := add(calldataload(0x24), 0x24)
    }
    return result;
  }

  function getPremiums() internal pure returns (uint256[] calldata result) {
    assembly {
      result.length := calldataload(add(calldataload(0x44), 0x04))
      result.offset := add(calldataload(0x44), 0x24)
    }
    return result;
  }

  // --------------------------------------

  /**
   * @notice Executes an operation after receiving the flash-borrowed assets
   * @dev Ensure that the contract can return the debt + premium, e.g., has
   *      enough funds to repay and has approved the Pool to pull the total amount
   * assets The addresses of the flash-borrowed assets
   * amounts The amounts of the flash-borrowed assets
   * premiums The fee of each flash-borrowed asset
   * @param _params The byte-encoded params passed when initiating the flashloan
   * @return True if the execution of the operation succeeds, false otherwise
   */
  function executeOperation(
    address[] calldata,
    uint256[] calldata,
    uint256[] calldata,
    address,
    bytes calldata _params
  ) public override returns (bool) {
    require(msg.sender == address(POOL), "msg.sender != POOL");

    LiqEnrichedParams memory lep = getLiqEnrichedParams(_params);

    // Use calldata instead of memory in order to avoid the "Stack Too deep" CompileError
    address[] calldata assets = getAssets();
    uint256[] calldata amounts = getAmounts();
    uint256[] calldata premiums = getPremiums();

    for (uint32 i = 0; i < assets.length; i++) {
      assets[i].safeApprove(lep.loan, 0);
      assets[i].safeApprove(lep.loan, amounts[i]);
    }

    (
      AssetAmount[] memory assetSurplus,
      AssetAmount[] memory assetDeficit
    ) = liquidateLoanAndGetSurplusDeficitAssets(_params, lep, assets, amounts, premiums);

    // Swap to negate deficits
    for (uint32 i = 0; i < assetDeficit.length; i++) {
      if (assetDeficit[i].amount != 0) {
        for (uint32 j = 0; j < assetSurplus.length; j++) {
          if (assetSurplus[j].amount != 0) {
            bool shouldBreak;
            for (uint32 k = 0; k < lep.offers.length; ++k) {
              IYieldYakRouter.FormattedOffer memory offer = lep.offers[k];
              if (
                offer.path[0] == assetSurplus[j].asset &&
                offer.path[offer.path.length - 1] == assetDeficit[i].asset
              ) {
                uint256 remainDeficitAmount;
                (
                  shouldBreak,
                  remainDeficitAmount
                ) = swapToNegateDeficits(
                    assetDeficit[i],
                    assetSurplus[j],
                    offer
                  );
                if (shouldBreak) {
                  address(assetDeficit[i].asset).safeTransfer(
                    lep.liquidator,
                    remainDeficitAmount
                  );
                  break;
                }
              }
            }
            if (shouldBreak) {
              break;
            }
          }
        }
      }
    }

    // Send remaining tokens (bonus) to initiator
    for (uint32 i = 0; i < assetSurplus.length; i++) {
      if (assetSurplus[i].amount != 0) {
        address(assetSurplus[i].asset).safeTransfer(
          lep.liquidator,
          assetSurplus[i].amount
        );
      }
    }

    // Approve AAVE POOL
    for (uint32 i = 0; i < assets.length; i++) {
      assets[i].safeApprove(address(POOL), 0);
      assets[i].safeApprove(address(POOL), amounts[i] + premiums[i]);
    }

    return true;
  }

  function executeFlashloan(
    FlashLoanArgs calldata _args
  ) public onlyWhitelistedLiquidators {
    bytes memory encoded = abi.encode(_args.offers);
    bytes memory enrichedParams = bytes.concat(
      abi.encodePacked(_args.loanAddress),
      abi.encodePacked(_args.liquidator),
      abi.encodePacked(_args.tokenManager),
      abi.encodePacked(_args.bonus),
      abi.encodePacked(encoded.length),
      encoded,
      _args.params
    );

    IPool(address(POOL)).flashLoan(
      address(this),
      _args.assets,
      _args.amounts,
      _args.interestRateModes,
      address(this),
      enrichedParams,
      0
    );
  }

  function getLiqEnrichedParams(
    bytes memory _enrichedParams
  ) internal pure returns (LiqEnrichedParams memory) {
    address _loan;
    address _liquidator;
    address _tokenManager;
    uint256 _bonus;
    uint256 length;
    IYieldYakRouter.FormattedOffer[] memory _offers;
    assembly {
      // Read 32 bytes from _enrichedParams ptr + 32 bytes offset, shift right 12 bytes
      _loan := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x20)))
      // Read 32 bytes from _enrichedParams ptr + 52 bytes offset, shift right 12 bytes
      _liquidator := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x34)))
      // Read 32 bytes from _enrichedParams ptr + 72 bytes offset, shift right 12 bytes
      _tokenManager := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x48)))
      // Read 32 bytes from _enrichedParams ptr + 92 bytes offset
      _bonus := mload(add(_enrichedParams, 0x5c))
      // Read 32 bytes from _enrichedParams ptr + 124 bytes offset
      length := mload(add(_enrichedParams, 0x7c))
    }
    bytes memory encoded = new bytes(length);
    for (uint256 i = 0; i < length; ++i) {
      // Read length bytes from _enrichedParams + 124 bytes offset
      encoded[i] = _enrichedParams[124 + i];
    }
    _offers = abi.decode(encoded, (IYieldYakRouter.FormattedOffer[]));
    return
      LiqEnrichedParams({
        loan: _loan,
        liquidator: _liquidator,
        tokenManager: _tokenManager,
        bonus: _bonus,
        offers: _offers
      });
  }

  function liquidateLoanAndGetSurplusDeficitAssets(
    bytes calldata _params,
    LiqEnrichedParams memory lep,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums
  )
    internal
    returns (
      AssetAmount[] memory assetSurplus,
      AssetAmount[] memory assetDeficit
    )
  {
    address[] memory supportedTokens = ITokenManager(lep.tokenManager)
      .getSupportedTokensAddresses();

    assetSurplus = new AssetAmount[](supportedTokens.length);
    assetDeficit = new AssetAmount[](supportedTokens.length);

    // Liquidate loan
    {
      (bool success, ) = lep.loan.call(
        abi.encodePacked(
          abi.encodeWithSelector(
            SmartLoanLiquidationFacet.liquidateLoan.selector,
            ITokenManager(lep.tokenManager).getAllPoolAssets(),
            amounts,
            lep.bonus
          ),
          _params
        )
      );
      require(success, "Liquidation failed");
    }

    // Calculate surpluses & deficits
    for (uint32 i = 0; i < supportedTokens.length; i++) {
      int256 index = findIndex(supportedTokens[i], assets);
      uint256 balance = IERC20(supportedTokens[i]).balanceOf(address(this));

      if (index != -1) {
        int256 amount = int256(balance) -
          int256(amounts[uint256(index)]) -
          int256(premiums[uint256(index)]);
        if (amount > 0) {
          assetSurplus[i] = AssetAmount(
            supportedTokens[uint256(index)],
            uint256(amount)
          );
        } else if (amount < 0) {
          assetDeficit[i] = AssetAmount(
            supportedTokens[uint256(index)],
            uint256(amount * -1)
          );
        }
      } else if (balance > 0) {
        assetSurplus[i] = AssetAmount(supportedTokens[i], balance);
      }
    }
  }

  function swapToNegateDeficits(
    AssetAmount memory _deficit,
    AssetAmount memory _surplus,
    IYieldYakRouter.FormattedOffer memory _offer
  ) private returns (bool shouldBreak, uint256 remainDeficitAmount) {
    require(_offer.amounts[0] > 0, "YieldYak path, adapter is not initialized");

    uint256 expectedBuyTokenReturned = (_offer.amounts[
      _offer.amounts.length - 1
    ] *
      _surplus.amount *
      98) / (_offer.amounts[0] * 100);

    uint256 amountIn = expectedBuyTokenReturned > _deficit.amount
      ? (_surplus.amount * _deficit.amount) / expectedBuyTokenReturned
      : _surplus.amount;
    address(_surplus.asset).safeApprove(YY_ROUTER, 0);
    address(_surplus.asset).safeApprove(YY_ROUTER, amountIn);

    uint256 beforeDeficitAmount = IERC20(_deficit.asset).balanceOf(
      address(this)
    );

    IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
      amountIn: amountIn,
      amountOut: 0,
      path: _offer.path,
      adapters: _offer.adapters
    });

    IYieldYakRouter router = IYieldYakRouter(YY_ROUTER);
    router.swapNoSplit(trade, address(this), 0);

    uint256 swapAmount = IERC20(_deficit.asset).balanceOf(address(this)) -
      beforeDeficitAmount;

    _surplus.amount = _surplus.amount - amountIn;

    if (swapAmount >= _deficit.amount) {
      remainDeficitAmount = swapAmount - _deficit.amount;
      _deficit.amount = 0;
      return (true, remainDeficitAmount);
    } else {
      _deficit.amount = _deficit.amount - swapAmount;
      return (false, 0);
    }
  }

  //TODO: pretty inefficient, find better way
  function findIndex(
    address addr,
    address[] memory array
  ) internal pure returns (int256) {
    int256 index = -1;
    for (uint256 i; i < array.length; i++) {
      if (array[i] == addr) {
        index = int256(i);
        break;
      }
    }

    return index;
  }

  modifier onlyWhitelistedLiquidators() {
    // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
    require(
      whitelistedLiquidatorsContract.isLiquidatorWhitelisted(msg.sender),
      "Only whitelisted liquidators can execute this method"
    );
    _;
  }

  receive() external payable {
    IWrappedNativeToken wrapped = IWrappedNativeToken(
      DeploymentConstants.getNativeToken()
    );
    wrapped.deposit{value: msg.value}();
  }
}
