// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "../lib/joe-v2/math/SafeCast.sol";
import "../lib/joe-v2/PriceHelper.sol";
import "../interfaces/joe-v2/ILBPair.sol";
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

    struct RangeData {
        uint24 lowerRange;
        uint24 upperRange;
        uint64 lastRebalance;
        uint256 totalShare;
    }

    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _MAX_RANGE = 51;
    uint256 private constant _PACKED_DISTRIBS_SIZE = 16;

    mapping(uint256 => RangeData) private rangeList;

    IERC20 public immutable tokenX;
    IERC20 public immutable tokenY;
    ILBPair public immutable lbPair;

    event RangeSet(uint24 low, uint24 upper);

    /**
     * @dev Constructor of the contract.
     */
    constructor(address tokenX_, address tokenY_, address lbPair_, string memory name_) ERC20(name_, "sPrime"){
        tokenX = IERC20(tokenX_);
        tokenY = IERC20(tokenY_);
        lbPair = ILBPair(lbPair_);
    }

    /**
     * @notice Returns the range of the sPrime contract.
     * @return lower The lower bound of the range.
     * @return upper The upper bound of the range.
     */
    function getRange(uint256 index) external view returns (uint24 lower, uint24 upper) {
        return (rangeList[index].lowerRange, rangeList[index].upperRange);
    }

    /**
     * @notice Returns the balances of the sPrime contract.
     * @return amountX The amount of token X.
     * @return amountY The amount of token Y.
     */
    function getBalances(uint256 index) external view returns (uint256 amountX, uint256 amountY) {
        return _getBalances(index);
    }

    /**
     * @notice Returns the idle balances of the sPrime contract.
     * @return amountX The idle amount of token X.
     * @return amountY The idle amount of token Y.
     */
    function getIdleBalances() external view returns (uint256 amountX, uint256 amountY) {
        amountX = tokenX.balanceOf(address(this));
        amountY = tokenY.balanceOf(address(this));
    }

    /**
     * @notice Returns the last rebalance timestamp.
     * @return lastRebalance The last rebalance timestamp.
     */
    function getLastRebalance(uint256 index) external view returns (uint256 lastRebalance) {
        return rangeList[index].lastRebalance;
    }

    /**
     * @notice Rebalances the sPrime contract by withdrawing the entire position and depositing the new position.
     * It will deposit the tokens following the amounts valued in Y.
     * @dev Only the operator can call this function.
     * @param newLower The lower bound of the new range.
     * @param newUpper The upper bound of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The slippage active id.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function rebalance(
        uint256 index,
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        bytes calldata distributions
    ) external onlyOwner {

        (uint256 amountX, uint256 amountY) = _withdrawAndResetRange(index);

        // Check if the operator wants to deposit tokens.
        if (desiredActiveId > 0 || slippageActiveId > 0) {
            uint24 activeId;
            (activeId, newLower, newUpper) = _adjustRange(newLower, newUpper, desiredActiveId, slippageActiveId);

            // Get the distributions and the amounts to deposit
            bytes32[] memory liquidityConfigs = _getLiquidityConfigs(newLower, newUpper, distributions);

            _depositToLB(index, newLower, newUpper, liquidityConfigs, amountX, amountY);
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
    function _getBalances(uint256 index) internal view returns (uint256 amountX, uint256 amountY) {
        // Get the balances of the tokens in the contract.
        amountX = tokenX.balanceOf(address(this));
        amountY = tokenY.balanceOf(address(this));

        // Get the range of the tokens in the pool.
        (uint24 lower, uint24 upper) = (rangeList[index].lowerRange, rangeList[index].upperRange);

        // If the range is not empty, get the balances of the tokens in the range.
        if (upper != 0) {
            uint256[] memory ids = _getIds(lower, upper);

            (uint256 depositedX, uint256 depositedY) = address(this).getAmountsOf(ids, address(lbPair));

            amountX += depositedX;
            amountY += depositedY;
        }
    }

    /**
     * @dev Returns the active id of the pair.
     * @return activeId The active id of the pair.
     */
    function _getActiveId() internal view returns (uint24 activeId) {
        activeId = lbPair.getActiveId();
    }

    /**
     * @dev Adjusts the range if the active id is different from the desired active id.
     * Will revert if the active id is not within the desired active id and the slippage.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The allowed slippage of the active id.
     */
    function _adjustRange(uint24 newLower, uint24 newUpper, uint24 desiredActiveId, uint24 slippageActiveId)
        internal
        view
        returns (uint24 activeId, uint24, uint24)
    {
        activeId = _getActiveId();

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

        return (activeId, newLower, newUpper);
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
    function _setRange(uint256 index, uint24 newLower, uint24 newUpper) internal {
        require(newUpper != 0 && newLower <= newUpper, "InvalidRange");
        require(newUpper - newLower + 1 <= _MAX_RANGE, "RangeTooWide");

        uint24 previousUpper = rangeList[index].upperRange;

        require(previousUpper == 0, "RangeAlreadySet");

        rangeList[index].lowerRange = newLower;
        rangeList[index].upperRange = newUpper;

        emit RangeSet(newLower, newUpper);
    }

    /**
     * @dev Resets the range.
     */
    function _resetRange(uint256 index) internal {
        rangeList[index].lowerRange = 0;
        rangeList[index].upperRange = 0;

        emit RangeSet(0, 0);
    }

    /**
     * @dev Deposits tokens into the pair.
     * @param lower The lower end of the range.
     * @param upper The upper end of the range.
     * @param liquidityConfigs The liquidity configurations, encoded as bytes32.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     */
    function _depositToLB(
        uint256 index,
        uint24 lower,
        uint24 upper,
        bytes32[] memory liquidityConfigs,
        uint256 amountX,
        uint256 amountY
    ) internal {
        // Set the range, will check if the range is valid.
        _setRange(index, lower, upper);

        require(amountX != 0 || amountY != 0, "ZeroAmounts");

        // Get the pair address and transfer the tokens to the pair.
        address pair = address(lbPair);

        if (amountX > 0) tokenX.safeTransfer(pair, amountX);
        if (amountY > 0) tokenY.safeTransfer(pair, amountY);

        // Mint the liquidity tokens.
        ILBPair(pair).mint(address(this), liquidityConfigs, address(this));
    }

    /**
     * @dev Withdraws tokens from the pair and applies the AUM annual fee. This function will also reset the range.
     * Will never charge for more than a day of AUM fees, even if the sPrime contract has not been rebalanced for a longer period.
     */
    function _withdrawAndResetRange(uint256 index) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        // Get the range and reset it.
        (uint24 lowerRange, uint24 upperRange) = (rangeList[index].lowerRange, rangeList[index].upperRange);
        if (upperRange > 0) _resetRange(index);

        (totalBalanceX, totalBalanceY) = _withdraw(lowerRange, upperRange, _PRECISION);

        // Ge the last rebalance timestamp and update it.
        rangeList[index].lastRebalance = block.timestamp.safe64();
    }

    /**
     * @dev Withdraws tokens from the pair also withdraw the pending withdraws.
     * @param removedLower The lower end of the range to remove.
     * @param removedUpper The upper end of the range to remove.
     * @param share The share amount to remove from the sPrime LP.
     */
    function _withdraw(uint24 removedLower, uint24 removedUpper, uint256 share)
        internal
        returns (uint256 amountX, uint256 amountY)
    {
        // Withdraw from the Liquidity Book Pair and get the amounts of tokens in the sPrime contract.
        (uint256 balanceX, uint256 balanceY) = _withdrawFromLB(removedLower, removedUpper, share);

        // Get the amount that were not pending for withdrawal.
        amountX = balanceX;
        amountY = balanceY;
    }

    /**
     * @dev Withdraws tokens from the Liquidity Book Pair.
     * @param removedLower The lower end of the range to remove.
     * @param removedUpper The upper end of the range to remove.
     * @param share The amount of share to withdraw.
     * @return balanceX The amount of token X in the sPrime contract.
     * @return balanceY The amount of token Y in the sPrime contract.
     */
    function _withdrawFromLB(uint24 removedLower, uint24 removedUpper, uint256 share)
        internal
        returns (uint256 balanceX, uint256 balanceY)
    {
        uint256 length;

        // Get the pair address and the delta between the upper and lower range.
        address pair = address(lbPair);
        uint256 delta = removedUpper - removedLower + 1;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);

        if (removedUpper > 0) {
            // Get the ids and amounts of the tokens to withdraw.
            for (uint256 i; i < delta;) {
                uint256 id = removedLower + i;
                uint256 amount = ILBToken(pair).balanceOf(address(this), id);

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

        // If the range is not empty, burn the tokens from the pair.
        if (length > 0) {
            // If the length is different than the delta, update the arrays, this allows to avoid the zero share error.
            if (length != delta) {
                assembly {
                    mstore(ids, length)
                    mstore(amounts, length)
                }
            }

            ILBPair(pair).burn(address(this), address(this), ids, amounts);
        }

        // Get the amount of tokens in the sPrime contract.
        balanceX = tokenX.balanceOf(address(this));
        balanceY = tokenY.balanceOf(address(this));
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param index The index of range list.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function deposit(uint256 index, uint256 amountX, uint256 amountY, bytes calldata distributions) external {
        uint24 _lowerRange = rangeList[index].lowerRange;
        uint24 _upperRange = rangeList[index].upperRange;
        bytes32[] memory liquidityConfigs = _getLiquidityConfigs(_lowerRange, _upperRange, distributions);

        _depositToLB(index, _lowerRange, _upperRange, liquidityConfigs, amountX, amountY);
    }

    /**
     * @dev Only the vault can call this function.
     * @param index The index of range list.
     * @param shareWithdraw The amount of share to withdraw.
     */
    function withdraw(uint256 index, uint256 shareWithdraw) external {
        require(shareWithdraw <= balanceOf(_msgSender()), "Insufficient Balance");

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        (uint256 amountX, uint256 amountY) = _withdraw(rangeList[index].lowerRange, rangeList[index].upperRange, shareWithdraw * _PRECISION / rangeList[index].totalShare);

        // Send the tokens to the vault.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }
}
