// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

import "../lib/joe-v2/math/SafeCast.sol";
import "../lib/joe-v2/PriceHelper.sol";
import "../interfaces/joe-v2/ILBPair.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/joe-v2/ILBToken.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract sPrime is ReentrancyGuard, Ownable, ERC20 {
    using SafeERC20 for IERC20;
    using LiquidityAmounts for address;
    using PriceHelper for uint24;
    using SafeCast for uint256;
    using Uint256x256Math for uint256;

    struct PairInfo {
        uint24 lowerRange;
        uint24 upperRange;
        uint64 lastRebalance;
        uint256 totalShare;
        address lbPair;
    }

    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _MAX_RANGE = 51;
    uint256 private constant _PACKED_DISTRIBS_SIZE = 16;

    // activeId => Bin Info
    mapping(uint24 => PairInfo) public pairList;

    IERC20 public immutable tokenX;
    IERC20 public immutable tokenY;
    ILBRouter public immutable lbRouter;

    event RangeSet(uint24 activeInd, uint24 low, uint24 upper);

    /**
     * @dev Constructor of the contract.
     */
    constructor(address tokenX_, address tokenY_, address lbRouter_, string memory name_) ERC20(name_, "sPrime"){
        tokenX = IERC20(tokenX_);
        tokenY = IERC20(tokenY_);
        lbRouter = ILBRouter(lbRouter_);
    }

    /**
     * @notice Returns the range of the sPrime contract.
     * @return lower The lower bound of the range.
     * @return upper The upper bound of the range.
     */
    function getRange(uint24 activeId) external view returns (uint24 lower, uint24 upper) {
        PairInfo memory pair = pairList[activeId];
        return (pair.lowerRange, pair.upperRange);
    }

    /**
     * @notice Returns the balances of the sPrime contract.
     * @return amountX The amount of token X.
     * @return amountY The amount of token Y.
     */
    function getBalances(uint24 activeId) external view returns (uint256 amountX, uint256 amountY) {
        return _getBalances(activeId);
    }

    /**
     * @notice Returns the last rebalance timestamp.
     * @return lastRebalance The last rebalance timestamp.
     */
    function getLastRebalance(uint24 activeId) external view returns (uint256 lastRebalance) {
        return pairList[activeId].lastRebalance;
    }

    /**
     * @notice Rebalances the sPrime contract by withdrawing the entire position and depositing the new position.
     * It will deposit the tokens following the amounts valued in Y.
     * @dev Only the operator can call this function.
     * @param activeId The id that should be rebalanced.
     * @param newLower The lower bound of the new range.
     * @param newUpper The upper bound of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The slippage active id.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function rebalance(
        uint24 activeId,
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        bytes calldata distributions
    ) external {

        (uint256 amountX, uint256 amountY) = _withdrawAndResetRange(activeId, balanceOf(_msgSender()));

        // Check if the operator wants to deposit tokens.
        if (desiredActiveId > 0 || slippageActiveId > 0) {
            (newLower, newUpper) = _adjustRange(activeId, newLower, newUpper, desiredActiveId, slippageActiveId);

            // Get the distributions and the amounts to deposit
            bytes32[] memory liquidityConfigs = _getLiquidityConfigs(newLower, newUpper, distributions);

            // Set the range, will check if the range is valid.
            _setRange(desiredActiveId, newLower, newUpper);

            _depositToLB(desiredActiveId, liquidityConfigs, amountX, amountY);
        }
    }

    /**
     * @dev Returns the ids of the tokens in the range.
     * @param lower The lower end of the range.
     * @param upper The upper end of the range.
     * @return ids The ids of the tokens in the range.
     */
    function _getIds(uint24 lower, uint24 upper) internal pure returns (uint256[] memory ids) {
        // Get the delta of the range, we add 1 because the upper bound is inclusive.
        uint256 delta = upper - lower + 1;

        // Get the ids from lower to upper (inclusive).
        ids = new uint256[](delta);
        for (uint256 i; i < delta;) {
            ids[i] = lower + i;

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Returns the balances of the contract, including those deposited in the LB pool.
     * @return amountX The balance of token X.
     * @return amountY The balance of token Y.
     */
    function _getBalances(uint24 activeId) internal view returns (uint256 amountX, uint256 amountY) {
        PairInfo memory pair = pairList[activeId];

        // Get the balances of the tokens in the contract.
        amountX = tokenX.balanceOf(address(this));
        amountY = tokenY.balanceOf(address(this));

        // Get the range of the tokens in the pool.
        (uint24 lower, uint24 upper) = (pair.lowerRange, pair.upperRange);

        // If the range is not empty, get the balances of the tokens in the range.
        if (upper != 0) {
            uint256[] memory ids = _getIds(lower, upper);

            (uint256 depositedX, uint256 depositedY) = address(this).getAmountsOf(ids, pair.lbPair);

            amountX += depositedX;
            amountY += depositedY;
        }
    }

    function _getTotalWeight(address pair, uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        (, uint128 amountXToY, ) = lbRouter.getSwapOut(ILBPair(pair), uint128(amountX), address(tokenX) < address(tokenY));
        weight = amountY + amountXToY;
    }

    /**
     * @dev Adjusts the range if the active id is different from the desired active id.
     * Will revert if the active id is not within the desired active id and the slippage.
     * @param activeId The current active id.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The allowed slippage of the active id.
     */
    function _adjustRange(uint24 activeId, uint24 newLower, uint24 newUpper, uint24 desiredActiveId, uint24 slippageActiveId) internal pure returns (uint24, uint24)
    {
        // If the active id is different from the desired active id, adjust the range.
        if (desiredActiveId != activeId) {
            uint24 delta;

            if (desiredActiveId > activeId) {
                // If the desired active id is greater than the active id, we need to decrease the range.
                unchecked {
                    delta = desiredActiveId - activeId;

                    newLower = newLower > delta ? newLower - delta : 0;
                    newUpper = newUpper > delta ? newUpper - delta : 0;
                }
            } else {
                unchecked {
                    delta = activeId - desiredActiveId;

                    newLower = newLower > type(uint24).max - delta ? type(uint24).max : newLower + delta;
                    newUpper = newUpper > type(uint24).max - delta ? type(uint24).max : newUpper + delta;
                }
            }

            require(delta <= slippageActiveId, "ActiveIdSlippage");
        }

        return (newLower, newUpper);
    }

    /**
     * @dev Returns the liquidity configurations for the given range.
     * @param idLower The lower end of the range.
     * @param idUpper The upper end of the range.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range. can be calculated as:
     * distributions = abi.encodePacked(uint64(distribX0), uint64(distribY0), uint64(distribX1), uint64(distribY1), ...)
     * @return liquidityConfigs The liquidity configurations for the given range.
     */
    function _getLiquidityConfigs(uint24 idLower, uint24 idUpper, bytes calldata distributions)
        internal
        pure
        returns (bytes32[] memory liquidityConfigs)
    {
        require(idUpper != 0 && idLower <= idUpper, "InvalidRange");
        require(distributions.length == (idUpper - idLower + 1) * _PACKED_DISTRIBS_SIZE, "InvalidLength");

        uint256 length = distributions.length / _PACKED_DISTRIBS_SIZE;

        liquidityConfigs = new bytes32[](length);

        uint256 index;
        for (uint256 i; i < length; ++i) {
            uint24 id = idLower + uint24(i);

            uint128 distribs = uint128(bytes16(distributions[index:index += _PACKED_DISTRIBS_SIZE]));

            liquidityConfigs[i] = LiquidityConfigurations.encodeParams(uint64(distribs >> 64), uint64(distribs), id);
        }
    }

    /**
     * @dev Sets the range only if it is not already set. Will revert if the range is already set.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     */
    function _setRange(uint24 activeId, uint24 newLower, uint24 newUpper) internal {
        PairInfo storage pair = pairList[activeId];

        require(newUpper != 0 && newLower <= newUpper, "InvalidRange");
        require(newUpper - newLower + 1 <= _MAX_RANGE, "RangeTooWide");

        uint24 previousUpper = pair.upperRange;

        require(previousUpper == 0, "RangeAlreadySet");

        pair.lowerRange = newLower;
        pair.upperRange = newUpper;

        emit RangeSet(activeId, newLower, newUpper);
    }

    /**
     * @dev Resets the range.
     */
    function _resetRange(uint24 activeId) internal {
        PairInfo storage pair = pairList[activeId];

        pair.lowerRange = 0;
        pair.upperRange = 0;

        emit RangeSet(activeId, 0, 0);
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param activeId The active Id.
     * @param liquidityConfigs The liquidity configurations, encoded as bytes32.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     */
    function _depositToLB(
        uint24 activeId,
        bytes32[] memory liquidityConfigs,
        uint256 amountX,
        uint256 amountY
    ) internal {
        PairInfo memory pair = pairList[activeId];

        require(amountX != 0 || amountY != 0, "ZeroAmounts");

        // Get the lbPair address and transfer the tokens to the lbPair.
        address lbPair = pair.lbPair;

        if (amountX > 0) tokenX.safeTransfer(lbPair, amountX);
        if (amountY > 0) tokenY.safeTransfer(lbPair, amountY);

        // Mint the liquidity tokens.
        ILBPair(lbPair).mint(address(this), liquidityConfigs, address(this));

        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances(activeId);
        uint256 share = pair.totalShare * _getTotalWeight(lbPair, amountX, amountY) / _getTotalWeight(lbPair, totalBalanceX, totalBalanceY);

        _mint(_msgSender(), share);

        pair.totalShare += share;
        
    }

    /**
     * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
     * Will never charge for more than a day of AUM fees, even if the sPrime scontract has not been rebalanced for a longer period.
     */
    function _withdrawAndResetRange(uint24 activeId, uint256 shares) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        PairInfo storage pair = pairList[activeId];

        // Get the range and reset it.
        (uint24 lowerRange, uint24 upperRange) = (pair.lowerRange, pair.upperRange);
        if (upperRange > 0) _resetRange(activeId);

        (totalBalanceX, totalBalanceY) = _withdrawFromLB(pair.lbPair, lowerRange, upperRange, shares * _PRECISION / pair.totalShare);

        _burn(_msgSender(), shares);
        pair.totalShare -= shares;

        // Ge the last rebalance timestamp and update it.
        pair.lastRebalance = block.timestamp.safe64();
    }

    /**
     * @dev Withdraws tokens from the Liquidity Book Pair.
     * @param removedLower The lower end of the range to remove.
     * @param removedUpper The upper end of the range to remove.
     * @param share The amount of share to withdraw.
     * @return balanceX The amount of token X in the sPrime contract.
     * @return balanceY The amount of token Y in the sPrime contract.
     */
    function _withdrawFromLB(address lbPair, uint24 removedLower, uint24 removedUpper, uint256 share)
        internal
        returns (uint256 balanceX, uint256 balanceY)
    {
        uint256 length;
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = removedUpper - removedLower + 1;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);

        if (removedUpper > 0) {
            // Get the ids and amounts of the tokens to withdraw.
            for (uint256 i; i < delta;) {
                uint256 id = removedLower + i;
                uint256 amount = ILBToken(lbPair).balanceOf(address(this), id);

                if (amount != 0) {
                    ids[length] = id;
                    amounts[length] = amount * share / _PRECISION;

                    unchecked {
                        ++length;
                    }
                }

                unchecked {
                    ++i;
                }
            }
        }

        // If the range is not empty, burn the tokens from the lbPair.
        if (length > 0) {
            // If the length is different than the delta, update the arrays, this allows to avoid the zero share error.
            if (length != delta) {
                assembly {
                    mstore(ids, length)
                    mstore(amounts, length)
                }
            }

            ILBPair(lbPair).burn(address(this), address(this), ids, amounts);
        }

        // Get the amount of tokens in the sPrime contract.
        balanceX = tokenX.balanceOf(address(this));
        balanceY = tokenY.balanceOf(address(this));
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param activeId The activeId of range list.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function deposit(uint24 activeId, uint256 amountX, uint256 amountY, bytes calldata distributions) external {
        PairInfo memory pair = pairList[activeId];

        bytes32[] memory liquidityConfigs = _getLiquidityConfigs(pair.lowerRange, pair.upperRange, distributions);

        _depositToLB(activeId, liquidityConfigs, amountX, amountY);
    }

    /**
     * @dev Only the vault can call this function.
     * @param activeId The activeId of range list.
     * @param shareWithdraw The amount of share to withdraw.
     */
    function withdraw(uint24 activeId, uint256 shareWithdraw) external {
        PairInfo storage pair = pairList[activeId];

        require(shareWithdraw <= balanceOf(_msgSender()), "Insufficient Balance");

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.lbPair, pair.lowerRange, pair.upperRange, shareWithdraw * _PRECISION / pair.totalShare);

        _burn(_msgSender(), shareWithdraw);
        pair.totalShare -= shareWithdraw;

        // Send the tokens to the vault.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }
}
