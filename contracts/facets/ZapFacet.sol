// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {DiamondStorageLib, IZapPositions} from "../lib/DiamondStorageLib.sol";
import "../ReentrancyGuardKeccak.sol";
import {AssetsOperationsHelper} from "../helpers/AssetsOperationsHelper.sol";
import {YieldYakSwapHelper} from "../helpers/YieldYakSwapHelper.sol";
import {ParaSwapHelper, IParaSwapRouter} from "../helpers/ParaSwapHelper.sol";
import "../DiamondHelper.sol";

contract ZapFacet is ReentrancyGuardKeccak, AssetsOperationsHelper, YieldYakSwapHelper, ParaSwapHelper {
    bytes1 public constant YIELD_YAK = 0x00;
    bytes1 public constant PARA_SWAP = 0x01;

    function _openPosition(
        bool _isLong,
        bytes32 _fromAsset,
        uint256 _amount,
        bytes32 _toAsset,
        bytes4 _stakeSelector,
        bytes4 _unstakeSelector,
        bytes1 _selector,
        bytes memory _data
    ) internal nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        _borrow(_fromAsset, _amount);

        IERC20Metadata fromToken = getERC20TokenInstance(_fromAsset, false);
        IERC20Metadata toToken = getERC20TokenInstance(_toAsset, false);
        uint256 stakeAmount = _swap(_selector, _data, address(fromToken), address(toToken), _amount);

        _stake(_stakeSelector, stakeAmount);

        if (_isLong) {
            DiamondStorageLib.addLongPosition(IZapPositions.Position({
                unstakeSelector: _unstakeSelector,
                fromAsset: address(fromToken),
                fromSymbol: _fromAsset,
                toAsset: address(toToken),
                fromAmount: _amount,
                toAmount: stakeAmount
            }));

            emit Long(
                msg.sender,
                _fromAsset,
                _toAsset,
                _amount,
                stakeAmount,
                block.timestamp
            );
        } else {
            DiamondStorageLib.addShortPosition(IZapPositions.Position({
                unstakeSelector: _unstakeSelector,
                fromAsset: address(fromToken),
                fromSymbol: _fromAsset,
                toAsset: address(toToken),
                fromAmount: _amount,
                toAmount: stakeAmount
            }));

            emit Short(
                msg.sender,
                _fromAsset,
                _toAsset,
                _amount,
                stakeAmount,
                block.timestamp
            );
        }
    }

    function _closePosition(
        bool _isLong,
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data,
        uint256 _minAmount
    ) internal nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        IZapPositions.Position memory position;
        if (_isLong) {
            position = DiamondStorageLib.getLongPosition(_positionIndex);
        } else {
            position = DiamondStorageLib.getShortPosition(_positionIndex);
        }

        uint256 unstakedAmount = _unstake(position.unstakeSelector, position.toAmount, _minAmount);

        IERC20 fromToken = IERC20(position.fromAsset);
        IERC20 toToken = IERC20(position.toAsset);
        uint256 amount = _swap(_selector, _data, address(toToken), address(fromToken), unstakedAmount);

        _repay(position.fromSymbol, amount);

        if (_isLong) {
            DiamondStorageLib.removeLongPosition(_positionIndex);
        } else {
            DiamondStorageLib.removeShortPosition(_positionIndex);
        }
    }

    function _swap(
        bytes1 _selector,
        bytes memory _data,
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) internal returns (uint256 amount) {
        if (_selector == YIELD_YAK) {
            (uint256 _amountOut, address[] memory _path, address[] memory _adapters) = abi.decode(_data, (uint256, address[], address[]));

            require(_path[0] == _fromToken, "Invalid swap data");
            require(_path[_path.length - 1] == _toToken, "Invalid swap data");

            amount = _yakSwap(_amount, _amountOut, _path, _adapters);
        } else if (_selector == PARA_SWAP) {
            IParaSwapRouter.SimpleData memory data = abi.decode(_data, (IParaSwapRouter.SimpleData));

            require(data.fromToken == _fromToken, "Invalid swap data");
            require(data.toToken == _toToken, "Invalid swap data");
            if (data.fromAmount != _amount) {
                data.toAmount = data.toAmount * _amount / data.fromAmount;
                data.fromAmount = _amount;
            }

            amount = _paraSwap(data);
        } else {
            revert("Invalid swap selector");
        }
    }

    function _stake(bytes4 _stakeSelector, uint256 _amount) internal {
        proxyDelegateCalldata(
            DiamondHelper._getFacetAddress(_stakeSelector),
            abi.encodeWithSelector(_stakeSelector, _amount)
        );
    }

    function _unstake(bytes4 _unstakeSelector, uint256 _amount, uint256 _minAmount) internal returns (uint256 unstaked) {
        unstaked = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(_unstakeSelector),
                abi.encodeWithSelector(_unstakeSelector, _amount, _minAmount)
            ),
            (uint256)
        );
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing long
        * @param fromAsset the stable asset that is borrowed
        * @param toAsset the asset that is staked
        * @param stableTokenAmount how much of stable token was borrowed
        * @param toTokenAmount how much of to token was received and staked
        * @param timestamp of long
    **/
    event Long(address indexed user, bytes32 indexed fromAsset, bytes32 indexed toAsset, uint256 stableTokenAmount, uint256 toTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing short
        * @param fromAsset the asset that is borrowed
        * @param toAsset the stable asset that is staked
        * @param fromTokenAmount how much of from token was borrowed
        * @param stableTokenAmount how much of stable token was received and staked
        * @param timestamp of short
    **/
    event Short(address indexed user, bytes32 indexed fromAsset, bytes32 indexed toAsset, uint256 fromTokenAmount, uint256 stableTokenAmount, uint256 timestamp);
}
