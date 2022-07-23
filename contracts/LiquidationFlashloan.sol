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

  struct AssetAmount {
    address asset;
    uint256 amount;
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

  address loan;
  IUniswapV2Router01 uniswapV2Router;

  AssetAmount[] assetSurplus;
  AssetAmount[] assetDeficit;
  address liquidator;
  uint256 bonus;
  address tokenManager;
  address wrappedNativeToken;

  constructor(
    address _addressProvider,
    address _uniswapV2Router,
    address _wrappedNativeToken
  ) FlashLoanReceiverBase(IPoolAddressesProvider(_addressProvider)) {
    uniswapV2Router = IUniswapV2Router01(_uniswapV2Router);
    wrappedNativeToken = _wrappedNativeToken;
  }

  /**
   * @notice Executes an operation after receiving the flash-borrowed assets
   * @dev Ensure that the contract can return the debt + premium, e.g., has
   *      enough funds to repay and has approved the Pool to pull the total amount
   * @param _assets The addresses of the flash-borrowed assets
   * @param _amounts The amounts of the flash-borrowed assets
   * @param _premiums The fee of each flash-borrowed asset
   * @param _initiator The address of the flashloan initiator
   * @param _params The byte-encoded params passed when initiating the flashloan
   * @return True if the execution of the operation succeeds, false otherwise
   */
  function executeOperation(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    bytes calldata _params
  ) public override returns (bool) {
    for (uint32 i = 0; i < _assets.length; i++) {
      IERC20(_assets[i]).approve(loan, 0);
      IERC20(_assets[i]).approve(loan, _amounts[i]);
    }

    // liquidate loan
    {
      (bool success, ) = loan.call(
        abi.encodePacked(
          abi.encodeWithSelector(
            SmartLoanLiquidationFacet.liquidateLoan.selector,
            TokenManager(tokenManager).getAllPoolAssets(),
            _amounts,
            bonus
          ),
          _params
        )
      );
      require(success, "Liquidation failed");
    }

    address[] memory supportedTokens = TokenManager(tokenManager).getSupportedTokensAddresses();

    // calculate surpluses & deficits
    for (uint32 i = 0; i < supportedTokens.length; i++) {
      int256 index = findIndex(supportedTokens[i], _assets);

      if (index != -1) {
        int256 amount = int256(
          IERC20Metadata(_assets[uint256(index)]).balanceOf(address(this))
        ) -
          int256(_amounts[uint256(index)]) -
          int256(_premiums[uint256(index)]);

        if (amount > 0) {
          assetSurplus.push(
            AssetAmount(supportedTokens[uint256(index)], uint256(amount))
          );
        } else if (amount < 0) {
          assetDeficit.push(
            AssetAmount(supportedTokens[uint256(index)], uint256(amount * -1))
          );
        }
      } else if (
        IERC20Metadata(supportedTokens[i]).balanceOf(address(this)) > 0
      ) {
        assetSurplus.push(
          AssetAmount(
            supportedTokens[i],
            uint256(IERC20Metadata(supportedTokens[i]).balanceOf(address(this)))
          )
        );
      }
    }

    // swap to negate deficits
    for (uint32 i = 0; i < assetDeficit.length; i++) {
      for (uint32 j = 0; j < assetSurplus.length; j++) {
        if (swapToNegateDeficits(assetDeficit[i], assetSurplus[j])) {
          break;
        }
      }
    }

    // send remaining tokens (bonus) to initiator
    for (uint32 i = 0; i < assetSurplus.length; i++) {
      address(assetSurplus[i].asset).safeTransfer(
        liquidator,
        assetSurplus[i].amount
      );
    }

    // approves
    for (uint32 i = 0; i < _assets.length; i++) {
      IERC20(_assets[i]).approve(address(POOL), 0);
      IERC20(_assets[i]).approve(address(POOL), _amounts[i] + _premiums[i]);
    }

    //empty arrays
    delete assetSurplus;
    delete assetDeficit;

    // success
    return true;
  }

  function executeFlashloan(FlashLoanArgs calldata _args) public {
    //TODO: this shouldn't be kept in contract
    loan = _args.loanAddress;
    bonus = _args.bonus;
    liquidator = _args.liquidator;
    tokenManager = _args.tokenManager;

    IPool(address(POOL)).flashLoan(
      address(this),
      _args.assets,
      _args.amounts,
      _args.interestRateModes,
      address(this),
      _args.params,
      0
    );
  }

  //argument storage, bo przechowujemy w tablicy storage
  function swapToNegateDeficits(
    AssetAmount storage _deficit,
    AssetAmount storage _surplus
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
        (soldTokenAmountNeeded * _deficit.amount) / _surplus.amount,
        getPath(_deficit.asset, _surplus.asset), //todo: migrate getPath to this contract
        address(this),
        block.timestamp
      );
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

  function toUint256(bytes memory _bytes)
    internal
    pure
    returns (uint256 value)
  {
    assembly {
      value := mload(add(_bytes, 0x20))
    }
  }

  //TODO: pretty inefficient, find better way
  function findIndex(address addr, address[] memory array)
    internal
    view
    returns (int256)
  {
    int256 index = -1;
    for (uint256 i; i < array.length; i++) {
      if (array[i] == addr) {
        index = int256(i);
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
