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

    // binStep => activeId => Pair Info
    mapping(uint16 => mapping(uint24 => PairInfo)) public pairList;
    mapping(uint16 => mapping(uint24 => bool)) public pairStatus;

    IERC20 public immutable tokenX;
    IERC20 public immutable tokenY;
    ILBRouter public immutable lbRouter;
    ILBFactory public immutable lbFactory;

    /**
     * @dev Constructor of the contract.
     * @param tokenX_ The address of token X.
     * @param tokenY_ The address of token Y.
     * @param lbRouter_ The address of the liquidity book router.
     * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
     */
    constructor(address tokenX_, address tokenY_, address lbRouter_, string memory name_) ERC20(name_, "sPrime"){
        tokenX = IERC20(tokenX_);
        tokenY = IERC20(tokenY_);
        lbRouter = ILBRouter(lbRouter_);
        lbFactory = lbRouter.getFactory();
    }

    /**
     * @notice Add a new bin for the PRIME-TOKEN pair.
     * @param binStep The binStep for the pair.
     * @param activeId The unique identifier for the new bin.
     * @param lower The lower bound of the range.
     * @param upper The upper bound of the range.
     */
    function _addBins(uint16 binStep, uint24 activeId, uint24 lower, uint24 upper) internal {
        address lbPair = address(lbFactory.getLBPairInformation(tokenX, tokenY, binStep).LBPair);

        require(!pairStatus[binStep][activeId], "Active ID added already");
        PairInfo memory newPairInfo = PairInfo({
            lowerRange: 0,
            upperRange: 0,
            lastRebalance: block.timestamp.safe64(),
            totalShare: 0,
            lbPair: lbPair
        });

        pairList[binStep][activeId] = newPairInfo;
        pairStatus[binStep][activeId] = true;

        _setRange(binStep, activeId, lower, upper);
    }

    /**
     * @notice Rebalances the SPrime contract by withdrawing the entire position and depositing a new position within specified bounds.
     * It deposits tokens following the amounts valued in Y.
     * @param binStep The binStep for the pair.
     * @param activeId The id of the bin to be rebalanced.
     * @param newLower The lower bound of the new range.
     * @param newUpper The upper bound of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The slippage active id.
     * @param distributions The packed distributions of tokens.
     */
    function rebalance(
        uint16 binStep,
        uint24 activeId,
        uint24 newLower,
        uint24 newUpper,
        uint24 desiredActiveId,
        uint24 slippageActiveId,
        bytes calldata distributions
    ) external {

        (uint256 amountX, uint256 amountY) = _withdrawAndResetRange(binStep, activeId, balanceOf(_msgSender()));

        // Check if the operator wants to deposit tokens.
        if (desiredActiveId > 0 || slippageActiveId > 0) {
            (newLower, newUpper) = _adjustRange(activeId, newLower, newUpper, desiredActiveId, slippageActiveId);

            // Get the distributions and the amounts to deposit
            bytes32[] memory liquidityConfigs = _getLiquidityConfigs(newLower, newUpper, distributions);

            // Set the range, will check if the range is valid.
            _setRange(binStep, desiredActiveId, newLower, newUpper);

            _depositToLB(binStep, desiredActiveId, liquidityConfigs, amountX, amountY);
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
     * @param binStep The binStep for the pair.
     * @param activeId The active id of the pair.
     * @return amountX The balance of token X.
     * @return amountY The balance of token Y.
     */
    function _getBalances(uint16 binStep, uint24 activeId) internal view returns (uint256 amountX, uint256 amountY) {
        PairInfo memory pair = pairList[binStep][activeId];

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
     * @param activeId The current active id.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     * @param desiredActiveId The desired active id.
     * @param slippageActiveId The allowed slippage of the active id.
     * @return Adjusted lower and upper bounds of the new range.
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
     * @param binStep The binStep for the pair.
     * @param activeId The active id of the pair.
     * @param newLower The lower end of the new range.
     * @param newUpper The upper end of the new range.
     */
    function _setRange(uint16 binStep, uint24 activeId, uint24 newLower, uint24 newUpper) internal {
        PairInfo storage pair = pairList[binStep][activeId];

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
     * @param binStep The binStep for the pair.
     * @param activeId The active id of the pair
     */
    function _resetRange(uint16 binStep, uint24 activeId) internal {
        PairInfo storage pair = pairList[binStep][activeId];

        pair.lowerRange = 0;
        pair.upperRange = 0;

        emit RangeSet(activeId, 0, 0);
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param binStep The binStep for the pair.
     * @param activeId The active Id.
     * @param liquidityConfigs The liquidity configurations, encoded as bytes32.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     */
    function _depositToLB(
        uint16 binStep,
        uint24 activeId,
        bytes32[] memory liquidityConfigs,
        uint256 amountX,
        uint256 amountY
    ) internal {
        PairInfo memory pair = pairList[binStep][activeId];

        require(amountX != 0 || amountY != 0, "ZeroAmounts");

        // Get the lbPair address and transfer the tokens to the lbPair.
        address lbPair = pair.lbPair;

        if (amountX > 0) tokenX.safeTransfer(lbPair, amountX);
        if (amountY > 0) tokenY.safeTransfer(lbPair, amountY);

        // Mint the liquidity tokens.
        ILBPair(lbPair).mint(address(this), liquidityConfigs, address(this));

        (uint256 totalBalanceX, uint256 totalBalanceY) = _getBalances(binStep, activeId);
        uint256 share = pair.totalShare * _getTotalWeight(lbPair, amountX, amountY) / _getTotalWeight(lbPair, totalBalanceX, totalBalanceY);

        _mint(_msgSender(), share);

        pair.totalShare += share;
        
    }

    /**
     * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
     * Will never charge for more than a day of AUM fees, even if the sPrime scontract has not been rebalanced for a longer period.
     * @param binStep The binStep for the pair.
     * @param activeId The active Id of the pair
     * @param share The amount of share to withdraw.
     * @return totalBalanceX The amount of token X withdrawn.
     * @return totalBalanceY The amount of token Y withdrawn.
     */
    function _withdrawAndResetRange(uint16 binStep, uint24 activeId, uint256 share) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        PairInfo storage pair = pairList[binStep][activeId];

        // Get the range and reset it.
        (uint24 lowerRange, uint24 upperRange) = (pair.lowerRange, pair.upperRange);
        if (upperRange > 0) _resetRange(binStep, activeId);

        _burn(_msgSender(), share);

        (totalBalanceX, totalBalanceY) = _withdrawFromLB(pair.lbPair, lowerRange, upperRange, share * _PRECISION / pair.totalShare);

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
     * @param binStep The binStep for the pair.
     * @param activeId The activeId of range list.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @param distributions The packed distributions. Each bytes16 of the distributions bytes is
     * (distributionX, distributionY) from the `newLower`to the `newUpper` range.
     */
    function deposit(uint16 binStep, uint24 activeId, uint256 amountX, uint256 amountY, bytes calldata distributions) external {
        PairInfo memory pair = pairList[binStep][activeId];

        bytes32[] memory liquidityConfigs = _getLiquidityConfigs(pair.lowerRange, pair.upperRange, distributions);

        _depositToLB(binStep, activeId, liquidityConfigs, amountX, amountY);
    }

    /**
     * @param binStep The binStep for the pair.
     * @param activeId The activeId of range list.
     * @param shareWithdraw The amount of share to withdraw.
     */
    function withdraw(uint16 binStep, uint24 activeId, uint256 shareWithdraw) external {
        PairInfo storage pair = pairList[binStep][activeId];

        require(shareWithdraw <= balanceOf(_msgSender()), "Insufficient Balance");

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        _burn(_msgSender(), shareWithdraw);

        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.lbPair, pair.lowerRange, pair.upperRange, shareWithdraw * _PRECISION / pair.totalShare);

        pair.totalShare -= shareWithdraw;

        // Send the tokens to the vault.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }
}
