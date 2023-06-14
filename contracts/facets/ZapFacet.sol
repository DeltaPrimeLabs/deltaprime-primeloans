// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {DiamondStorageLib, IZapPositions} from "../lib/DiamondStorageLib.sol";
import "../ReentrancyGuardKeccak.sol";
import {AssetsOperationsHelper} from "../helpers/AssetsOperationsHelper.sol";
import {YieldYakSwapHelper} from "../helpers/YieldYakSwapHelper.sol";
import {ParaSwapHelper, IParaSwapRouter} from "../helpers/ParaSwapHelper.sol";

contract ZapFacet is ReentrancyGuardKeccak, AssetsOperationsHelper, YieldYakSwapHelper, ParaSwapHelper {
    bytes32 public constant STABLE_ASSET = "USDC";

    bytes1 public constant YIELD_YAK = 0x00;
    bytes1 public constant PARA_SWAP = 0x01;

    function long(
        uint256 _amount,
        bytes32 _toAsset,
        bytes32 _farmAsset,
        bytes1 _selector,
        bytes memory _data
    ) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        _borrow(STABLE_ASSET, _amount);

        IERC20Metadata fromToken = getERC20TokenInstance(STABLE_ASSET, false);
        IERC20Metadata toToken = getERC20TokenInstance(_toAsset, false);
        uint256 farmAmount = _swap(_selector, _data, address(fromToken), address(toToken), _amount);

        _farm(_toAsset, farmAmount, _farmAsset);

        DiamondStorageLib.addLongPosition(IZapPositions.Position({
            startAmount: _amount,
            asset: address(toToken),
            symbol: _toAsset,
            identifier: _farmAsset,
            amount: farmAmount
        }));

        emit Long(
            msg.sender,
            _toAsset,
            _farmAsset,
            _amount,
            farmAmount,
            block.timestamp
        );
    }

    function closeLongPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data
    ) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        IZapPositions.Position memory position = DiamondStorageLib.getLongPosition(_positionIndex);

        uint256 positionAmount = position.amount;
        positionAmount = _unfarm(position.symbol, positionAmount, position.identifier);

        IERC20Metadata toToken = getERC20TokenInstance(STABLE_ASSET, false);
        uint256 amount = _swap(_selector, _data, position.asset, address(toToken), positionAmount);

        uint256 startAmount = position.startAmount;
        if (amount > startAmount) {
            uint256 profit = amount - startAmount;
            amount = startAmount;
            _fund(STABLE_ASSET, profit);
        }
        _repay(STABLE_ASSET, amount);

        DiamondStorageLib.remoteLongPosition(_positionIndex);
    }

    function short(
        bytes32 _fromAsset,
        uint256 _amount,
        bytes32 _farmAsset,
        bytes1 _selector,
        bytes memory _data
    ) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        _borrow(_fromAsset, _amount);

        IERC20Metadata fromToken = getERC20TokenInstance(_fromAsset, false);
        IERC20Metadata toToken = getERC20TokenInstance(STABLE_ASSET, false);
        uint256 farmAmount = _swap(_selector, _data, address(fromToken), address(toToken), _amount);

        _farm(STABLE_ASSET, farmAmount, _farmAsset);

        DiamondStorageLib.addShortPosition(IZapPositions.Position({
            startAmount: _amount,
            asset: address(fromToken),
            symbol: _fromAsset,
            identifier: _farmAsset,
            amount: farmAmount
        }));

        emit Short(
            msg.sender,
            _fromAsset,
            _farmAsset,
            _amount,
            farmAmount,
            block.timestamp
        );
    }

    function closeShortPosition(
        uint256 _positionIndex,
        bytes1 _selector,
        bytes memory _data
    ) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        IZapPositions.Position memory position = DiamondStorageLib.getShortPosition(_positionIndex);

        uint256 positionAmount = position.amount;
        bytes32 symbol = position.symbol;
        _unfarm(symbol, positionAmount, position.identifier);

        IERC20Metadata fromToken = getERC20TokenInstance(STABLE_ASSET, false);
        uint256 amount = _swap(_selector, _data, address(fromToken), position.asset, positionAmount);

        uint256 startAmount = position.startAmount;
        if (amount > startAmount) {
            uint256 profit = amount - startAmount;
            amount = startAmount;
            _fund(symbol, profit);
        }
        _repay(symbol, amount);

        DiamondStorageLib.remoteShortPosition(_positionIndex);
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

    function _farm(bytes32 _asset, uint256 _amount, bytes32 _farmAsset) internal {
    }

    function _unfarm(bytes32 _asset, uint256 _amount, bytes32 _farmAsset) internal returns (uint256) {
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
        * @param toAsset the asset that was used for farm
        * @param farmAsset the asset that received after farm
        * @param stableTokenAmount how much of stable token was borrowed
        * @param toTokenAmount how much of to token was received and farmed
        * @param timestamp of long
    **/
    event Long(address indexed user, bytes32 indexed toAsset, bytes32 indexed farmAsset, uint256 stableTokenAmount, uint256 toTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing short
        * @param fromAsset the asset that is borrowed
        * @param farmAsset the asset that received after farm
        * @param fromTokenAmount how much of from token was borrowed
        * @param stableTokenAmount how much of stable token was received and farmed
        * @param timestamp of short
    **/
    event Short(address indexed user, bytes32 indexed fromAsset, bytes32 indexed farmAsset, uint256 fromTokenAmount, uint256 stableTokenAmount, uint256 timestamp);
}
