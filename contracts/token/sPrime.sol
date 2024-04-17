// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../lib/joe-v2/math/SafeCast.sol";
import "../interfaces/ISPrime.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/ITokenManager.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "../lib/SolvencyMethods.sol";
import "../lib/local/DeploymentConstants.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// SPrime contract declaration
contract SPrime is ISPrime, ReentrancyGuard, Ownable, ERC20, SolvencyMethods {
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20 for safe token transfers
    using LiquidityAmounts for address; // Using LiquidityAmounts for address for getting amounts of liquidity
    using SafeCast for uint256; // Using SafeCast for uint256 for safe type casting

    // Constants declaration
    uint256 private constant _PRECISION = 1e18;
    uint256 private constant _MAX_RANGE = 51;
    uint256 private constant _PACKED_DISTRIBS_SIZE = 16;
    uint256 private constant _MAX_SIPPIAGE = 5;

    // Mapping for storing pair information and user shares
    mapping(uint256 => PairInfo) public pairList;
    mapping(address => UserInfo) public userInfo;
    mapping(uint256 => bool) public pairStatus;

    // Immutable variables for storing token and pair information
    IERC20Metadata public immutable tokenX;
    IERC20Metadata public immutable tokenY;
    ILBPair public immutable lbPair;
    uint16 internal constant DEFAULT_BIN_STEP = 25;
    uint256 internal constant DEFAULT_SLIPPAGE = 10;

    // Arrays for storing deltaIds and distributions
    int256[] private deltaIds;
    uint256[] private distributionX;
    uint256[] private distributionY;

    /**
    * @dev Constructor of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param distributionX_ Pre-defined distribution X
    * @param distributionY_ Pre-defined distribution Y
    * @param deltaIds_ Delta id for bins
    */
    constructor(address tokenX_, address tokenY_, string memory name_, uint256[] memory distributionX_, uint256[] memory distributionY_, int256[] memory deltaIds_) ERC20(name_, "sPrime"){
        require(deltaIds_.length == distributionX_.length && deltaIds_.length == distributionY_.length, "Length Mismatch");

        tokenX = IERC20Metadata(tokenX_);
        tokenY = IERC20Metadata(tokenY_);

        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(tokenX, tokenY, DEFAULT_BIN_STEP);

        lbPair = pairInfo.LBPair;

        deltaIds = deltaIds_;
        distributionX = distributionX_;
        distributionY = distributionY_;
    }

    /**
     * @dev Returns the address of the JoeV2Router.
     * @return The address of the JoeV2Router.
     */
    function getJoeV2RouterAddress() public view virtual returns (address){
        return 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;
    }

    /**
     * @dev Returns the estimated token Y amount from token X.
     * @param amountX Token X Amount.
     * @return status Rebalance status
     */
    function rebalanceStatus(uint256 amountX) public view returns(bool) {
        bool status = false;
        (uint128 reserverA, ) = lbPair.getReserves();
        if(reserverA > 0) {
            ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
            (uint128 amountInLeft, , ) = traderJoeV2Router.getSwapOut(lbPair, uint128(amountX), true);
            if(amountInLeft == 0) {
                status = true;
            }
        }
        return status;
    }

    /**
     * @dev Check if the active id is in the user position range
     * @param user User Address.
     * @return status bin status
     */
    function binInRange(address user) public view returns(bool) {
        bool status = false;
        uint256[] memory depositIds = pairList[userInfo[user].centerId].depositIds;
        uint256 activeId = lbPair.getActiveId();
        if(depositIds[0] <= activeId && depositIds[depositIds.length - 1] >= activeId) {
            status = true;
        }
        return status;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @return totalValue Total Value in USD for the user's position.
     */
    function getUserPosition(address user) public view returns (uint256 totalValue) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 centerId = userInfo[user].centerId;
        uint256 pairSupply = pairList[centerId].totalShare;

        (uint256 totalX, uint256 totalY) = _getBalances(centerId);
        (uint256 amountX, uint256 amountY) = (totalX * userInfo[user].share / pairSupply, totalY * userInfo[user].share / pairSupply);
        amountY = amountY + _getTokenYFromTokenX(amountX);

        uint256 tokenYPrice = getPrice(tokenManager.tokenAddressToSymbol(address(tokenY)));

        totalValue = tokenYPrice * amountY / tokenY.decimals();
    }

    /**
    * @dev Adds a new bin for the PRIME-TOKEN pair.
    * @param centerId The unique identifier for the new bin.
    * @param ids Deposit IDs for the pair.
    */
    function _addBins(uint256 centerId, uint256[] memory ids) internal {
        require(!pairStatus[centerId], "Active ID added already");
        PairInfo memory newPairInfo = PairInfo({
            depositIds: ids,
            lastRebalance: block.timestamp.safe64(),
            totalShare: 0
        });

        pairList[centerId] = newPairInfo;
        pairStatus[centerId] = true;
    }

    /**
    * @dev Returns the balances of the contract, including those deposited in the LB pool.
    * @param centerId The active id of the pair.
    * @return amountX The balance of token X.
    * @return amountY The balance of token Y.
    */
    function _getBalances(uint256 centerId) internal view returns (uint256 amountX, uint256 amountY) {
        PairInfo memory pair = pairList[centerId];

        amountX = 0;
        amountY = 0;
        if (pairStatus[centerId] == true) {
            (uint256 depositedX, uint256 depositedY) = address(this).getAmountsOf(pair.depositIds, address(lbPair));

            amountX += depositedX;
            amountY += depositedY;
        }
    }

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @param amountX Token X Amount.
     * @param amountY Token Y Amount.
     * @return weight The total weight of tokens in the liquidity pair.
     */
    function _getTotalWeight(uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        weight = amountY + amountXToY;
    }


    /**
     * @dev Returns the estimated token Y amount from token X.
     * @param amountX Token X Amount.
     * @return amountY Token Y Amount to return.
     */
    function _getTokenYFromTokenX(uint256 amountX) internal view returns(uint256 amountY) {
        (uint128 reserverA, ) = lbPair.getReserves();
        if(reserverA > 0) {
            uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId())); 
            amountY = amountX * price / 1e18;
        } else {
            amountY = 0;
        }
    }

    /**
    * @dev Returns the updated amounts of tokens.
    * @return amountX The updated amount of token X.
    * @return amountY The updated amount of token Y.
    */
    function _getUpdatedAmounts(uint256 amountX, uint256 amountY) internal returns(uint256, uint256) {
        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        uint256 amountXToY = _getTokenYFromTokenX(amountX);

        if(amountXToY != 0) {
            bool swapTokenX = amountY < amountXToY;
            uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;
            if(amountY * _MAX_SIPPIAGE / 100 < diff) {
                uint256 amountIn = swapTokenX ? amountX * diff / amountXToY / 2 : diff / 2;

                IERC20[] memory tokenPathDynamic = new IERC20[](2);
                if (swapTokenX) {
                    tokenPathDynamic[0] = tokenX;
                    tokenPathDynamic[1] = tokenY;
                    tokenX.safeApprove(address(traderJoeV2Router), amountIn);
                } else {
                    tokenPathDynamic[0] = tokenY;
                    tokenPathDynamic[1] = tokenX;
                    tokenY.safeApprove(address(traderJoeV2Router), amountIn);
                }

                ILBRouter.Version[] memory versionsDynamic = new ILBRouter.Version[](1);
                versionsDynamic[0] = ILBRouter.Version.V2_1;

                uint256[] memory binStepsDynamic = new uint256[](1);
                binStepsDynamic[0] = DEFAULT_BIN_STEP;

                ILBRouter.Path memory path = ILBRouter.Path({
                    pairBinSteps: binStepsDynamic,
                    versions: versionsDynamic,
                    tokenPath: tokenPathDynamic
                });

                uint256 amountOut = traderJoeV2Router.swapExactTokensForTokens(amountIn, 0, path, address(this), block.timestamp + 1000);

                (amountX, amountY) = swapTokenX ? (amountX - amountIn, amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
            }
        }
        return (amountX, amountY);
    }

    /**
    * @dev Returns the liquidity configurations for the given range.
    * @param centerId The active id of the pair.
    * @return liquidityConfigs The liquidity configurations for the given range.
    * @return depositIds Deposit ID list.
    */
    function _getLiquidityConfigs(uint256 centerId)
    internal
    view
    returns (bytes32[] memory liquidityConfigs, uint256[] memory depositIds)
    {
        liquidityConfigs = new bytes32[](deltaIds.length);
        depositIds = new uint256[](deltaIds.length);
        {
            for (uint256 i; i < liquidityConfigs.length; ++i) {
                int256 _id = int256(centerId) + deltaIds[i];

                require(_id >= 0 && uint256(_id) <= type(uint24).max, "Overflow");
                depositIds[i] = uint256(_id);
                liquidityConfigs[i] = LiquidityConfigurations.encodeParams(
                    uint64(distributionX[i]), uint64(distributionY[i]), uint24(uint256(_id))
                );
            }
        }
    }

    /**
    * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
    * @param centerId The active Id of the pair
    * @param share The amount of share to withdraw.
    * @return totalBalanceX The amount of token X withdrawn.
    * @return totalBalanceY The amount of token Y withdrawn.
    */
    function _withdrawAndUpdateShare(uint256 centerId, uint256 share) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        PairInfo storage pair = pairList[centerId];

        (totalBalanceX, totalBalanceY) = _withdrawFromLB(pair.depositIds, share * _PRECISION / pair.totalShare);

        _burn(_msgSender(), share);

        // Ge the last rebalance timestamp and update it.
        pair.lastRebalance = block.timestamp.safe64();
    }

    /**
    * @dev Withdraws tokens from the Liquidity Book Pair.
    * @param depositIds Deposit ID list.
    * @param share The amount of share to withdraw.
    * @return balanceX The amount of token X received.
    * @return balanceY The amount of token Y received.
    */
    function _withdrawFromLB(uint256[] memory depositIds, uint256 share)
    internal
    returns (uint256 balanceX, uint256 balanceY)
    {
        uint256 length;
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = depositIds.length;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);

        // Get the ids and amounts of the tokens to withdraw.
        for (uint256 i; i < delta;) {
            uint256 id = depositIds[i];
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
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    */
    function deposit(uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY) public {
        if(amountX > 0) tokenX.safeTransferFrom(_msgSender(), address(this), amountX);
        if(amountY > 0) tokenY.safeTransferFrom(_msgSender(), address(this), amountY);

        if(userInfo[_msgSender()].share > 0) {
            (amountX, amountY) = _withdrawAndUpdateShare(userInfo[_msgSender()].centerId, userInfo[_msgSender()].share);
        }
        
        (amountX, amountY) = _getUpdatedAmounts(amountX, amountY);
        
        uint256 activeId = lbPair.getActiveId();
        require(activeIdDesired + idSlippage >= activeId && activeId + idSlippage >= activeIdDesired, "Slippage High");
        
        uint256 share = _depositToLB(_msgSender(), activeId, amountX, amountY);

        userInfo[_msgSender()].centerId = activeId;
        userInfo[_msgSender()].share = share;
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param user The user address to receive sPrime.
     * @param centerId The active Id.
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     * @return share The amount sPrime token to mint.
     */
    function _depositToLB(
        address user,
        uint256 centerId,
        uint256 amountX,
        uint256 amountY
    ) internal returns (uint256 share) {

        (bytes32[] memory liquidityConfigs, uint256[] memory depositIds) = _getLiquidityConfigs(centerId);

        (uint256 beforeBalanceX, uint256 beforeBalanceY) = _getBalances(centerId);

        if(pairStatus[centerId] == false) {
            _addBins(centerId, depositIds);
        }

        PairInfo storage pair = pairList[centerId];

        if (amountX > 0) tokenX.safeTransfer(address(lbPair), amountX);
        if (amountY > 0) tokenY.safeTransfer(address(lbPair), amountY);

        // Mint the liquidity tokens.
        lbPair.mint(address(this), liquidityConfigs, user);

        (uint256 afterBalanceX, uint256 afterBalanceY) = _getBalances(centerId);
        uint256 afterWeight = _getTotalWeight(afterBalanceX, afterBalanceY);
        uint256 beforeWeight = _getTotalWeight(beforeBalanceX, beforeBalanceY);

        share = afterWeight;
        if(pair.totalShare > 0) {
            share = pair.totalShare * (afterWeight - beforeWeight) / beforeWeight;
        }

        _mint(user, share);
        pair.totalShare += share;
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param shareWithdraw The amount of share to withdraw.
    */
    function withdraw(uint256 shareWithdraw) external {
        require(shareWithdraw <= userInfo[_msgSender()].share, "Insufficient Balance");

        PairInfo storage pair = pairList[userInfo[_msgSender()].centerId];

        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.depositIds, shareWithdraw * _PRECISION / pair.totalShare);

        // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
        _burn(_msgSender(), shareWithdraw);

        // Send the tokens to the user.
        tokenX.safeTransfer(_msgSender(), amountX);
        tokenY.safeTransfer(_msgSender(), amountY);
    }

    function lockBalance(uint256 amount, uint256 lockPeriod) public {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to lock");
        require(lockPeriod <= 3 * 365 days, "Cannot lock for more than 3 years");
        
        userInfo[_msgSender()].locked += amount;
        userInfo[_msgSender()].unlockAt = block.timestamp + lockPeriod;
    }

    function releaseBalance() public {
        require(userInfo[_msgSender()].unlockAt <= block.timestamp, "Still in the lock period");

        userInfo[_msgSender()].locked = 0;
        userInfo[_msgSender()].unlockAt = 0;
    }

    /**
    * @dev The hook that happens before token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {

        if (from != address(0)) {

            if(to != address(0)) {
                require(userInfo[from].share - userInfo[from].locked >= amount, "Insufficient balance to transfer");
            }

            uint256 centerId = userInfo[from].centerId;

            require(userInfo[from].share >= amount, "Insufficient");

            if (to != address(0)) {
                UserInfo storage userTo = userInfo[to];
                if(userTo.centerId == centerId) {
                    userTo.share += amount;
                } else if (userTo.share > 0) {
                    // Should process the rebalance for the existing position and the receiving position                                        
                    (uint256 amountXFrom, uint256 amountYFrom) = _withdrawAndUpdateShare(userInfo[from].centerId, amount);

                    uint256 share = _depositToLB(to, userTo.centerId, amountXFrom, amountYFrom);
                    userTo.share += share;

                } else {
                    userTo.centerId = centerId;
                    userTo.share = amount;
                }
            } else {
                pairList[centerId].totalShare -= amount;
                if(pairList[centerId].totalShare == 0) {
                    pairStatus[centerId] = false;
                }
            }
            userInfo[from].share -= amount;
        }
    }
}
