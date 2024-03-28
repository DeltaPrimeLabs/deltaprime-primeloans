// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

import "../lib/joe-v2/math/SafeCast.sol";
import "../lib/joe-v2/PriceHelper.sol";
import "../interfaces/ISPrime.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SPrime is ISPrime, ReentrancyGuard, Ownable, ERC20 {
    using SafeERC20 for IERC20;
    using LiquidityAmounts for address;
    using PriceHelper for uint24;
    using SafeCast for uint256;
    using Uint256x256Math for uint256;

    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _MAX_RANGE = 51;
    uint256 private constant _PACKED_DISTRIBS_SIZE = 16;

    // centerId => Pair Info
    mapping(uint24 => PairInfo) public pairList;
    mapping(uint24 => bool) public pairStatus;

    IERC20 public immutable tokenX;
    IERC20 public immutable tokenY;
    ILBPair public immutable lbPair;
    ILBRouter public immutable lbRouter;

    /**
     * @dev Constructor of the contract.
     * @param lbRouter_ The address of the liquidity book router.
     * @param lbPair_ The address of the pair pool.
     * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
     */
    constructor(address lbRouter_, address lbPair_, string memory name_) ERC20(name_, "sPrime"){
        lbPair = ILBPair(lbPair_);
        tokenX = lbPair.getTokenX();
        tokenY = lbPair.getTokenY();
        lbRouter = ILBRouter(lbRouter_);
    }

    /**
     * @notice Add a new bin for the PRIME-TOKEN pair.
     * @param centerId The unique identifier for the new bin.
     * @param lower The lower bound of the range.
     * @param upper The upper bound of the range.
     */
    function _addBins(uint24 centerId, uint24 lower, uint24 upper) internal {
        require(!pairStatus[centerId], "Active ID added already");
        PairInfo memory newPairInfo = PairInfo({
            lowerRange: 0,
            upperRange: 0,
            lastRebalance: block.timestamp.safe64(),
            totalShare: 0
        });

        pairList[centerId] = newPairInfo;
        pairStatus[centerId] = true;

        _setRange(centerId, lower, upper);
    }

    /**
     * @notice Rebalances the SPrime contract by withdrawing the entire position and depositing a new position within specified bounds.
     * It deposits tokens following the amounts valued in Y.
     * @param centerId The id of the bin to be rebalanced.
     * @param newLower The lower bound of the new range.
     * @param newUpper The upper bound of the new range.
     * @param slippageActiveId The slippage active id.
     * @param distributions The packed distributions of tokens.
     */
    function rebalance(
        uint24 centerId,
        uint24 newLower,
        uint24 newUpper,
        uint24 slippageActiveId,
        bytes calldata distributions
    ) external {
        
        (uint256 amountX, uint256 amountY) = _withdrawAndResetRange(centerId, balanceOf(_msgSender()));

        // Check if the operator wants to deposit tokens.
        if (slippageActiveId > 0) {
            uint24 activeId = lbPair.getActiveId();
            (newLower, newUpper) = _adjustRange(centerId, newLower, newUpper, activeId, slippageActiveId);

            // Get the distributions and the amounts to deposit
            bytes32[] memory liquidityConfigs = _getLiquidityConfigs(newLower, newUpper, distributions);

            // Set the range, will check if the range is valid.
            _setRange(activeId, newLower, newUpper);

            _depositToLB(activeId, liquidityConfigs, amountX, amountY);
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
     * @param centerId The active id of the pair.
     * @return amountX The balance of token X.
     * @return amountY The balance of token Y.
     */
    function _getBalances(uint24 centerId) internal view returns (uint256 amountX, uint256 amountY) {
        PairInfo memory pair = pairList[centerId];

        // Get the balances of the tokens in the contract.
        amountX = tokenX.balanceOf(address(this));
        amountY = tokenY.balanceOf(address(this));

        // Get the range of the tokens in the pool.
        (uint24 lower, uint24 upper) = (pair.lowerRange, pair.upperRange);

        // If the range is not empty, get the balances of the tokens in the range.
        if (upper != 0) {
            uint256[] memory ids = _getIds(lower, upper);

            (uint256 depositedX, uint256 depositedY) = address(this).getAmountsOf(ids, address(lbPair));

            amountX += depositedX;
            amountY += depositedY;
        }
    }

    /**
    * @dev Returns the total weight of tokens in a liquidity pair.
    * @param pair The address of the liquidity pair.
    * @param amountX The amount of token X.
    * @param amountY The amount of token Y.
    * @return weight The total weight of tokens in the liquidity pair.
    */
    function _getTotalWeight(address pair, uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        (, uint128 amountXToY, ) = lbRouter.getSwapOut(ILBPair(pair), uint128(amountX), address(tokenX) < address(tokenY));
        weight = amountY + amountXToY;
    }

    /**
     * @dev Adjusts the range if the active id is different from the desired active id.
     * Will revert if the active id is not within the desired active id and the slippage.
     * @param centerId The current active id.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The allowed slippage of the active id.
     * @return Adjusted lower and upper bounds of the new range.
     */
    function _adjustRange(uint24 centerId, uint24 newLower, uint24 newUpper, uint24 desiredActiveId, uint24 slippageActiveId) internal pure returns (uint24, uint24)
    {
        // If the active id is different from the desired active id, adjust the range.
        if (desiredActiveId != centerId) {
            uint24 delta;

            if (desiredActiveId > centerId) {
                // If the desired active id is greater than the active id, we need to decrease the range.
                unchecked {
                    delta = desiredActiveId - centerId;

                    newLower = newLower > delta ? newLower - delta : 0;
                    newUpper = newUpper > delta ? newUpper - delta : 0;
                }
            } else {
                unchecked {
                    delta = centerId - desiredActiveId;

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
     * @param centerId The active id of the pair.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     */
    function _setRange(uint24 centerId, uint24 newLower, uint24 newUpper) internal {
        PairInfo storage pair = pairList[centerId];

        require(newUpper != 0 && newLower <= newUpper, "InvalidRange");
        require(newUpper - newLower + 1 <= _MAX_RANGE, "RangeTooWide");

        uint24 previousUpper = pair.upperRange;

        require(previousUpper == 0, "RangeAlreadySet");

        pair.lowerRange = newLower;
        pair.upperRange = newUpper;

        emit RangeSet(centerId, newLower, newUpper);
    }

    /**
     * @dev Resets the range.
     * @param centerId The active id of the pair
     */
    function _resetRange(uint24 centerId) internal {
        PairInfo storage pair = pairList[centerId];

        pair.lowerRange = 0;
        pair.upperRange = 0;

        emit RangeSet(centerId, 0, 0);
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param centerId The active Id.
     * @param liquidityConfigs The liquidity configurations, encoded as bytes32.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     */
    function _depositToLB(
        uint24 centerId,
        bytes32[] memory liquidityConfigs,
        uint256 amountX,
        uint256 amountY
    ) internal {
        PairInfo memory pair = pairList[centerId];

        require(amountX != 0 || amountY != 0, "ZeroAmounts");

        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances(centerId);
        uint256 share = pair.totalShare * _getTotalWeight(address(lbPair), amountX, amountY) / _getTotalWeight(address(lbPair), totalBalanceX, totalBalanceY);

        if (amountX > 0) tokenX.safeTransfer(address(lbPair), amountX);
        if (amountY > 0) tokenY.safeTransfer(address(lbPair), amountY);

        // Mint the liquidity tokens.
        lbPair.mint(address(this), liquidityConfigs, address(this));

        _mint(_msgSender(), share);

        pair.totalShare += share;
        
    }

    /**
     * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
     * Will never charge for more than a day of AUM fees, even if the sPrime scontract has not been rebalanced for a longer period.
     * @param centerId The active Id of the pair
     * @param share The amount of share to withdraw.
     * @return totalBalanceX The amount of token X withdrawn.
     * @return totalBalanceY The amount of token Y withdrawn.
     */
    function _withdrawAndResetRange(uint24 centerId, uint256 share) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        PairInfo storage pair = pairList[centerId];

        // Get the range and reset it.
        (uint24 lowerRange, uint24 upperRange) = (pair.lowerRange, pair.upperRange);
        if (upperRange > 0) _resetRange(centerId);

        _burn(_msgSender(), share);

        (totalBalanceX, totalBalanceY) = _withdrawFromLB(lowerRange, upperRange, share * _PRECISION / pair.totalShare);

        pair.totalShare -= share;

        // Ge the last rebalance timestamp and update it.
        pair.lastRebalance = block.timestamp.safe64();
    }

    /**
     * @dev Withdraws tokens from the Liquidity Book Pair.
     * @param removedLower The lower end of the range to remove.
     * @param removedUpper The upper end of the range to remove.
     * @param share The amount of share to withdraw.
     * @return balanceX The amount of token X received.
     * @return balanceY The amount of token Y received.
     */
    function _withdrawFromLB(uint24 removedLower, uint24 removedUpper, uint256 share)
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

            lbPair.burn(address(this), address(this), ids, amounts);
        }

        // Get the amount of tokens in the sPrime contract.
        balanceX = tokenX.balanceOf(address(this));
        balanceY = tokenY.balanceOf(address(this));
    }

    /**
     * @dev Users can use deposit function for depositing tokens to the specific bin.
     * @param slippageActiveId The slippage active id.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function deposit(uint24 slippageActiveId, uint256 amountX, uint256 amountY, uint24 lower, uint24 upper, bytes calldata distributions) external {
        uint24 activeId = lbPair.getActiveId();

        if(pairStatus[activeId] == false) {
            (lower, upper) = _adjustRange(activeId, lower, upper, activeId, slippageActiveId);
            _addBins(activeId, lower, upper);
        }

        PairInfo memory pair = pairList[activeId];

        bytes32[] memory liquidityConfigs = _getLiquidityConfigs(pair.lowerRange, pair.upperRange, distributions);

        _depositToLB(activeId, liquidityConfigs, amountX, amountY);
    }

    /**
     * @param centerId The centerId of range list.
     * @param shareWithdraw The amount of share to withdraw.
     */
    function withdraw(uint24 centerId, uint256 shareWithdraw) external {
        PairInfo storage pair = pairList[centerId];

        require(shareWithdraw <= balanceOf(_msgSender()), "Insufficient Balance");

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        _burn(_msgSender(), shareWithdraw);

        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.lowerRange, pair.upperRange, shareWithdraw * _PRECISION / pair.totalShare);

        pair.totalShare -= shareWithdraw;

        // Send the tokens to the vault.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }
}
