pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./aave_v3/flashloan/base/FlashLoanReceiverBase.sol";
import "./facets/SmartLoanLiquidationFacet.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";

contract LiquidationFlashloan is FlashLoanReceiverBase, OwnableUpgradeable {
  using TransferHelper for address payable;
  using TransferHelper for address;

  IUniswapV2Router01 uniswapV2Router;
  address wrappedNativeToken;

  struct AssetAmount {
    address asset;
    uint256 amount;
  }

  struct LiqEnrichedParams {
    address loan;
    address liquidator;
    address tokenManager;
    uint256 bonus;
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
  }

  constructor(
    address _addressProvider,
    address _uniswapV2Router,
    address _wrappedNativeToken
  ) FlashLoanReceiverBase(IPoolAddressesProvider(_addressProvider)) {
    uniswapV2Router = IUniswapV2Router01(_uniswapV2Router);
    wrappedNativeToken = _wrappedNativeToken;
  }

  // ---- Extract calldata arguments ----
  function getAssets() internal view returns (address[] calldata result) {
    assembly {
      result.length := calldataload(add(calldataload(0x04), 0x04))
      result.offset := add(calldataload(0x04), 0x24)
    }
    return result;
  }

  function getAmounts() internal view returns (uint256[] calldata result) {
    assembly {
      result.length := calldataload(add(calldataload(0x24), 0x04))
      result.offset := add(calldataload(0x24), 0x24)
    }
    return result;
  }

  function getPremiums() internal view returns (uint256[] calldata result) {
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
   * @param _initiator The address of the flashloan initiator
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
    LiqEnrichedParams memory lep = getLiqEnrichedParams(_params);
    address[] memory supportedTokens = TokenManager(lep.tokenManager).getSupportedTokensAddresses();

    AssetAmount[] memory assetSurplus = new AssetAmount[](supportedTokens.length);
    AssetAmount[] memory assetDeficit = new AssetAmount[](supportedTokens.length);

    // Use calldata instead of memory in order to avoid the "Stack Too deep" CompileError
    address[] calldata assets = getAssets();
    uint256[] calldata amounts = getAmounts();
    uint256[] calldata premiums = getPremiums();

    for (uint32 i = 0; i < assets.length; i++) {
      IERC20(assets[i]).approve(lep.loan, 0);
      IERC20(assets[i]).approve(lep.loan, amounts[i]);
    }

    // Liquidate loan
    {
      (bool success,) = lep.loan.call(
        abi.encodePacked(
          abi.encodeWithSelector(
            SmartLoanLiquidationFacet.liquidateLoan.selector,
            TokenManager(lep.tokenManager).getAllPoolAssets(),
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
      uint256 balance = IERC20Metadata(supportedTokens[i]).balanceOf(address(this));

      if (index != - 1) {
        int256 amount = int256(balance) - int256(amounts[uint256(index)]) - int256(premiums[uint256(index)]);
        if (amount > 0) {
          assetSurplus[i] = AssetAmount(supportedTokens[uint256(index)], uint256(amount));
        } else if (amount < 0) {
          assetDeficit[i] = AssetAmount(supportedTokens[uint256(index)], uint256(amount * - 1));
        }
      } else if (balance > 0){
          assetSurplus[i] = AssetAmount(
            supportedTokens[i],
            balance
          );
      }
    }

    // Swap to negate deficits
    for (uint32 i = 0; i < assetDeficit.length; i++) {
      if (assetDeficit[i].amount != 0) {
        for (uint32 j = 0; j < assetSurplus.length; j++) {
          if (assetSurplus[j].amount != 0) {
            if (swapToNegateDeficits(assetDeficit[i], assetSurplus[j])) {
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
      IERC20(assets[i]).approve(address(POOL), 0);
      IERC20(assets[i]).approve(address(POOL), amounts[i] + premiums[i]);
    }

    return true;
  }

  function executeFlashloan(FlashLoanArgs calldata _args) public {
    bytes memory enrichedParams = bytes.concat(abi.encodePacked(_args.loanAddress), abi.encodePacked(_args.liquidator), abi.encodePacked(_args.tokenManager), abi.encodePacked(_args.bonus), _args.params);

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

  function getLiqEnrichedParams(bytes memory _enrichedParams) internal returns (LiqEnrichedParams memory) {
    address _loan;
    address _liquidator;
    address _tokenManager;
    uint256 _bonus;
    assembly {
    // Read 32 bytes from _enrichedParams ptr + 32 bytes offset, shift right 12 bytes
      _loan := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x20)))
    // Read 32 bytes from _enrichedParams ptr + 52 bytes offset, shift right 12 bytes
      _liquidator := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x34)))
    // Read 32 bytes from _enrichedParams ptr + 72 bytes offset, shift right 12 bytes
      _tokenManager := shr(mul(0x0c, 0x08), mload(add(_enrichedParams, 0x48)))
    // Read 32 bytes from _enrichedParams ptr + 92 bytes offset
      _bonus := mload(add(_enrichedParams, 0x5c))
    }
    return LiqEnrichedParams({
      loan : _loan,
      liquidator : _liquidator,
      tokenManager : _tokenManager,
      bonus : _bonus
    });
  }

  function swapToNegateDeficits(
    AssetAmount memory _deficit,
    AssetAmount memory _surplus
  ) private returns (bool shouldBreak) {

    uint256[] memory amounts;
    uint256 soldTokenAmountNeeded = uniswapV2Router
    .getAmountsIn(
      _deficit.amount,
      getPath(_surplus.asset, _deficit.asset)
    )[0];

    if (soldTokenAmountNeeded > _surplus.amount) {
      address(_surplus.asset).safeApprove(address(uniswapV2Router), 0);
      address(_surplus.asset).safeApprove(
        address(uniswapV2Router),
        _surplus.amount
      );

      amounts = uniswapV2Router.swapExactTokensForTokens(
        _surplus.amount,
        // TODO: figure out the amount minOUT
        (soldTokenAmountNeeded * _deficit.amount) / _surplus.amount,
        getPath(_deficit.asset, _surplus.asset),
        address(this),
        block.timestamp
      );
      _deficit.amount = _deficit.amount - amounts[amounts.length - 1];
      _surplus.amount = _surplus.amount - amounts[0];
      return false;
    } else {
      address(_surplus.asset).safeApprove(address(uniswapV2Router), 0);
      address(_surplus.asset).safeApprove(
        address(uniswapV2Router),
        soldTokenAmountNeeded
      );

      amounts = uniswapV2Router.swapTokensForExactTokens(
        _deficit.amount,
        soldTokenAmountNeeded,
        getPath(_surplus.asset, _deficit.asset),
        address(this),
        block.timestamp
      );
      _deficit.amount = _deficit.amount - amounts[amounts.length - 1];
      _surplus.amount = _surplus.amount - amounts[0];
      return true;
    }
  }

  //TODO: pretty inefficient, find better way
  function findIndex(address addr, address[] memory array)
  internal
  view
  returns (int256)
  {
    int256 index = - 1;
    for (uint256 i; i < array.length; i++) {
      if (array[i] == addr) {
        index = int256(i);
        break;
      }
    }

    return index;
  }

  function getPath(address _token1, address _token2) internal virtual view returns (address[] memory) {
    address[] memory path;

    if (_token1 != wrappedNativeToken && _token2 != wrappedNativeToken) {
      path = new address[](3);
      path[0] = _token1;
      path[1] = wrappedNativeToken;
      path[2] = _token2;
    } else {
      path = new address[](2);
      path[0] = _token1;
      path[1] = _token2;
    }

    return path;
  }
}
