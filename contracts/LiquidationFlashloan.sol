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
import "./interfaces/facets/IYieldYakRouter.sol";
import "./interfaces/balancer-v2/IBalancerV2Vault.sol";
import "./interfaces/balancer-v2/IAsset.sol";
import "./mock/WAVAX.sol";

contract LiquidationFlashloan is FlashLoanReceiverBase, Ownable {
  using TransferHelper for address payable;
  using TransferHelper for address;

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

  function balancerSwapToWAVAX(address tokenIn) internal {
    IVault balancerVault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8); // MASTER_VAULT_ADDRESS

    bytes32 _poolId;
    if (tokenIn == 0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3) {
      _poolId = 0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d;
    } else if (tokenIn == 0xF7D9281e8e363584973F946201b82ba72C965D27) {
      _poolId = 0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f;
    } else {
      revert("Unsupported swap");
    }

    uint256 balanceToSwap = IERC20Metadata(tokenIn).balanceOf(address(this));

    if(balanceToSwap > 0){
      IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
        poolId: _poolId,
        kind: IVault.SwapKind.GIVEN_IN, // OUT GIVEN EXACT IN
        assetIn: IAsset(tokenIn),
        assetOut: IAsset(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7), // WAVAX
        amount: balanceToSwap,
        userData: ""
      });
      IVault.FundManagement memory fundManagement = IVault.FundManagement({
        sender: address(this),
        fromInternalBalance: false,
        recipient: payable(address(this)),
        toInternalBalance: false
      });

      balancerVault.swap(
        singleSwap,
        fundManagement,
        balanceToSwap, // yy/ggAvax to AVAX price ratio serves as an good-enough slippage control ~10%
        block.timestamp
      );
    }
  }

  function balancerSwapYyAvaxToWAVAX() internal {
    balancerSwapToWAVAX(0xF7D9281e8e363584973F946201b82ba72C965D27);
  }

  function balancerSwapGgAvaxToWAVAX() internal {
    balancerSwapToWAVAX(0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3);
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
    address _initiator,
    bytes calldata _params
  ) public override returns (bool) {
    require(msg.sender == address(POOL), "msg.sender != POOL");
    require(_initiator == address(this), "unauthorized initiator");

    LiqEnrichedParams memory lep = getLiqEnrichedParams(_params);

    // Use calldata instead of memory in order to avoid the "Stack Too deep" CompileError
    address[] calldata assets = getAssets();
    uint256[] calldata amounts = getAmounts();
    uint256[] calldata premiums = getPremiums();

    for (uint32 i = 0; i < assets.length; i++) {
      assets[i].safeApprove(lep.loan, 0);
      assets[i].safeApprove(lep.loan, amounts[i]);
    }

    // Only liquidate
    liquidateLoan(_params, lep, amounts);

    // Swap yyavax/ggavax via Balancer to WAVAX
    balancerSwapYyAvaxToWAVAX();
    balancerSwapGgAvaxToWAVAX();

    // getSurplusDeficitAssets
    (
    AssetAmount[] memory assetSurplus,
    AssetAmount[] memory assetDeficit
    ) = getSurplusDeficitAssets(assets, premiums, amounts, lep.tokenManager);

    // Continue with the flow - make sure to have yakswap offers for AVAX -> borrowableTokens for the amount of yyavax/ggavax unwound

    // Swap to negate deficits
    for (uint32 i = 0; i < assetDeficit.length; i++) {
      if (assetDeficit[i].amount != 0) {
        for (uint32 j = 0; j < assetSurplus.length; j++) {
          if (assetSurplus[j].amount != 0) {
            bool deficitPaidInFull = false;
            for (uint32 k = 0; k < lep.offers.length; ++k) {
              // get next `offer`
              IYieldYakRouter.FormattedOffer memory offer = lep.offers[k];
              // * if offer is non-empty
              // * swap `from`, `to` elements match `assetSurplus[j].asset` and `assetDeficit[i].asset` respectively
              if (
                offer.path.length > 0 &&
                offer.path[0] == assetSurplus[j].asset &&
                offer.path[offer.path.length - 1] == assetDeficit[i].asset
              ) {
                uint256 remainDeficitAmount;
                // swap as much as possible and as little as necessary `assetSurplus[j].asset` in order to cover as much as possible / whole `assetDeficit[i].asset`
                (deficitPaidInFull, remainDeficitAmount) = swapToNegateDeficits(
                  assetDeficit[i],
                  assetSurplus[j],
                  offer
                );
                // There was enough of `assetSurplus[j].amount` to swap for `assetDeficit[i].amount` and potentially even a bit more; namely `remainDeficitAmount` more.
                // We send it to the liquidator if `remainDeficitAmount` > 0
                if (deficitPaidInFull && remainDeficitAmount > 0) {
                  address(assetDeficit[i].asset).safeTransfer(
                    lep.liquidator,
                    remainDeficitAmount
                  );
                }
                break; // Breaks out of offers-loop once one matching offer is found.
              }
            }
            if (deficitPaidInFull) {
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

  function getSurplusDeficitAssets(address[] calldata assets, uint256[] calldata premiums, uint256[] calldata amounts, address tokenManager) internal returns (
    AssetAmount[] memory assetSurplus,
    AssetAmount[] memory assetDeficit
  ){
    address[] memory supportedTokens = ITokenManager(tokenManager)
    .getSupportedTokensAddresses();
    assetSurplus = new AssetAmount[](supportedTokens.length);
    assetDeficit = new AssetAmount[](supportedTokens.length);

    // Calculate surpluses & deficits
    for (uint32 i = 0; i < supportedTokens.length; i++) {
      int256 index = findIndex(supportedTokens[i], assets);
      uint256 balance = IERC20(supportedTokens[i]).balanceOf(address(this));

      if (index != - 1) {
        int256 amount = int256(balance) -
        int256(amounts[uint256(index)]) -
        int256(premiums[uint256(index)]);
        if (amount > 0) {
          assetSurplus[i] = AssetAmount(
            supportedTokens[i],
            uint256(amount)
          );
        } else if (amount < 0) {
          assetDeficit[i] = AssetAmount(
            supportedTokens[i],
            uint256(amount * - 1)
          );
        }
      } else if (balance > 0) {
        assetSurplus[i] = AssetAmount(supportedTokens[i], balance);
      }
    }
  }

  function liquidateLoan(
    bytes calldata _params,
    LiqEnrichedParams memory lep,
    uint256[] calldata amounts
  )
  internal
  {
    // Liquidate loan
    {
      (bool success,) = lep.loan.call(
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
    address(_surplus.asset).safeApprove(YY_ROUTER(), 0);
    address(_surplus.asset).safeApprove(YY_ROUTER(), amountIn);

    uint256 beforeDeficitAmount = IERC20(_deficit.asset).balanceOf(
      address(this)
    );

    IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
      amountIn: amountIn,
      amountOut: 0,
      path: _offer.path,
      adapters: _offer.adapters
    });

    IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());
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
    int256 index = - 1;
    for (uint256 i; i < array.length; i++) {
      if (array[i] == addr) {
        index = int256(i);
        break;
      }
    }

    return index;
  }

  function YY_ROUTER() internal virtual pure returns (address) {
    return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
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