// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../lib/joe-v2/math/SafeCast.sol";
import "../interfaces/ISPrime.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/IPositionManager.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";

// SPrime contract declaration
contract SPrime is ISPrime, ReentrancyGuardUpgradeable, PendingOwnableUpgradeable, ERC20Upgradeable, ProxyConnector {
    using SafeERC20 for IERC20; // Using SafeERC20 for IERC20 for safe token transfers
    using LiquidityAmounts for address; // Using LiquidityAmounts for address for getting amounts of liquidity
    using SafeCast for uint256; // Using SafeCast for uint256 for safe type casting
    using Uint256x256Math for uint256;
    using PackedUint128Math for bytes32;

    // Constants declaration
    uint256 private constant _REBALANCE_MARGIN = 5;
    uint256 private constant _MAX_SLIPPAGE = 10;
    uint16 internal constant DEFAULT_BIN_STEP = 25;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    // Mapping for storing pair information and user shares
    mapping(address => LockDetails[]) public locks;

    // Immutable variables for storing token and pair information
    IERC20 public tokenX;
    IERC20 public tokenY;
    ILBPair public lbPair;
    IPositionManager public positionManager;
    address public vPrimeController;

    // Arrays for storing deltaIds and distributions
    int256[] private deltaIds;
    uint256[] private distributionX;
    uint256[] private distributionY;

    /**
    * @dev initialize of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param distributionX_ Pre-defined distribution X
    * @param distributionY_ Pre-defined distribution Y
    * @param deltaIds_ Delta id for bins
    * @param positionManager_ Position Manager contract for sPrime
    */
    function initialize(address tokenX_, address tokenY_, string memory name_, uint256[] memory distributionX_, uint256[] memory distributionY_, int256[] memory deltaIds_, address positionManager_) external initializer {
        __PendingOwnable_init();
        __ReentrancyGuard_init();
        __ERC20_init(name_, "sPrime");

        require(deltaIds_.length == distributionX_.length && deltaIds_.length == distributionY_.length, "Length Mismatch");

        ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
        ILBFactory lbFactory = traderJoeV2Router.getFactory();
        ILBFactory.LBPairInformation memory pairInfo = lbFactory.getLBPairInformation(IERC20(tokenX_), IERC20(tokenY_), DEFAULT_BIN_STEP);

        lbPair = pairInfo.LBPair;
        tokenX = lbPair.getTokenX();
        tokenY = lbPair.getTokenY();

        deltaIds = deltaIds_;
        distributionX = distributionX_;
        distributionY = distributionY_;

        positionManager = IPositionManager(positionManager_);
    }

    function setVPrimeControllerAddress(address _vPrimeController) public onlyOwner {
        vPrimeController = _vPrimeController;
    }

    /** Public View Functions */

    function getJoeV2RouterAddress() public view virtual returns (address){
        return 0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30;
    }

    function getLBPair() public view returns (address) {
        return address(lbPair);
    }

    function getTokenX() public view returns (address) {
        return address(tokenX);
    }

    function getTokenY() public view returns (address) {
        return address(tokenY);
    }

    /**
     * @dev Check if the active id is in the user position range
     * @param user User Address.
     * @return status bin status
     */
    function binInRange(address user) public view returns(bool) {
        uint256 tokenId = getUserTokenId(user);
        require(tokenId > 0, "No position");

        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfigFromTokenId(tokenId);

        uint256[] memory depositIds = depositConfig.depositIds;
        uint256 activeId = lbPair.getActiveId();
        if (depositIds[0] <= activeId && depositIds[depositIds.length - 1] >= activeId) {
            return true;
        }
        return false;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @return Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(address user) public view returns (uint256) {
        (,,,,uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(getUserTokenId(user));
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
        (uint256 amountX, uint256 amountY) = _getLiquidityTokenAmounts(depositConfig.depositIds, liquidityMinted);
        return _getTotalInTokenY(amountX, amountY);
    }

    /**
    * @dev Returns the fully vested locked balance for an account.
    * @dev Full business logic description can be found in Pool::getFullyVestedLockedBalance() docstring
    * @param account The address of the account.
    * @return fullyVestedBalance Fully vested locked balance
    */
    function getFullyVestedLockedBalance(address account) public view returns (uint256 fullyVestedBalance) {
        for (uint256 i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                fullyVestedBalance += locks[account][i].amount * locks[account][i].lockPeriod / MAX_LOCK_TIME;
            }
        }
    }

    /**
    * @dev Returns the total locked balance of an account.
    * @param account The address of the account.
    * @return The total locked balance of the account.
    */
    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance;
        for (uint256 i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    /**
    * @dev Returns the token id for the user
    * @param user The user address
    * @return tokenId token id owned by the user
    */
    function getUserTokenId(address user) public view returns(uint256 tokenId){
        if(positionManager.balanceOf(user) > 0) {
            tokenId = positionManager.tokenOfOwnerByIndex(user, 0);
        }
    }

    /** Internal Functions */
    
    /**
    * @dev Returns the token balances for the specific bin.
    * @param depositIds Deposited bin id list.
    * @param liquidityMinted Liquidity minted for each bin.
    */
    function _getLiquidityTokenAmounts(uint256[] memory depositIds, uint256[] memory liquidityMinted) internal view returns(uint256 amountX, uint256 amountY) {
        for (uint256 i; i < depositIds.length; ++i) {
            uint24 id = depositIds[i].safe24();

            uint256 liquidity = liquidityMinted[i];
            (uint256 binReserveX, uint256 binReserveY) = lbPair.getBin(id);
            uint256 totalSupply = lbPair.totalSupply(id);

            amountX += liquidity.mulDivRoundDown(binReserveX, totalSupply);
            amountY += liquidity.mulDivRoundDown(binReserveY, totalSupply);
        }
    }

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @param amountX Token X Amount.
     * @param amountY Token Y Amount.
     * @return weight The total weight of the tokens.
     */
    function _getTotalInTokenY(uint256 amountX, uint256 amountY) internal view returns(uint256 weight) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        weight = amountY + amountXToY;
    }


    /**
     * @dev Returns the estimated token Y amount from token X.
     * @param amountX Token X Amount.
     * @return amountY Token Y Amount to return.
     */
    function _getTokenYFromTokenX(uint256 amountX) internal view returns(uint256 amountY) {
        (uint128 reserveA, ) = lbPair.getReserves();
        if(reserveA > 0) {
            uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId()));
            // Swap For Y : Convert token X to token Y
            amountY = amountX * (10 ** IERC20Metadata(address(tokenY)).decimals()) / price;
        } else {
            amountY = 0;
        }
    }

    /**
    * @dev Returns the updated amounts of tokens.
    * @return amountX The updated amount of token X.
    * @return amountY The updated amount of token Y.
    */
    function _swapForEqualValues(uint256 amountX, uint256 amountY, uint256 swapSlippage) internal returns(uint256, uint256) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        bool swapTokenX = amountY < amountXToY;
        uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;
        // (amountXToY != 0 || amountX == 0) for excluding the initial LP deposit
        if(amountY * _REBALANCE_MARGIN / 100 < diff && (amountXToY > 0 || amountX == 0)) {
            uint256 amountIn;
            {
                uint256 price = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(lbPair.getActiveId()));
                // Swap For X : Convert token Y to token X
                amountIn = (diff / 2) * price / (10 ** IERC20Metadata(address(tokenY)).decimals());
            }

            uint256 amountOut = diff / 2; 

            (amountIn, amountOut) = swapTokenX ? (amountIn, amountOut) : (amountOut, amountIn);
            IERC20[] memory tokenPathDynamic = new IERC20[](2);
            if (swapTokenX) {
                tokenPathDynamic[0] = tokenX;
                tokenPathDynamic[1] = tokenY;
                tokenX.safeApprove(getJoeV2RouterAddress(), amountIn);
            } else {
                tokenPathDynamic[0] = tokenY;
                tokenPathDynamic[1] = tokenX;
                tokenY.safeApprove(getJoeV2RouterAddress(), amountIn);
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
            amountOut = ILBRouter(getJoeV2RouterAddress()).swapExactTokensForTokens(amountIn, amountOut * (100 - swapSlippage) / 100, path, address(this), block.timestamp);
            (amountX, amountY) = swapTokenX ? (amountX - amountIn,amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
        }
        return (amountX, amountY);
    }

    /**
    * @dev Returns the liquidity configurations for the given range.
    * @param centerId The active id of the pair.
    * @return liquidityConfigs The liquidity configurations for the given range.
    * @return depositIds Deposit ID list.
    */
    function _encodeDepositConfigs(uint256 centerId) internal view returns (bytes32[] memory liquidityConfigs, uint256[] memory depositIds) {
        uint256 length = deltaIds.length;
        liquidityConfigs = new bytes32[](length);
        depositIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            int256 _id = int256(centerId) + deltaIds[i];
            require(_id >= 0 && uint256(_id) <= type(uint24).max, "Overflow");
            depositIds[i] = uint256(_id);
            liquidityConfigs[i] = LiquidityConfigurations.encodeParams(uint64(distributionX[i]), uint64(distributionY[i]), uint24(uint256(_id)));
        }
    }

    /**
    * @dev Withdraws tokens from the Liquidity Book Pair.
    * @param depositIds Deposit ID list.
    * @param liquidityMinted The amount of ids to withdraw.
    * @param share sPrime amount to withdraw.
    * @return balanceX The amount of token X received.
    * @return balanceY The amount of token Y received.
    */
    function _withdrawFromLB(uint256[] memory depositIds, uint256[] memory liquidityMinted, uint256 share) internal returns (uint256 balanceX, uint256 balanceY, uint256[] memory liquidityAmounts) {
        uint256 length;
        uint256 totalShare = balanceOf(_msgSender());
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = depositIds.length;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);
        liquidityAmounts  = new uint256[](delta);

        // Get the ids and amounts of the tokens to withdraw.
        for (uint256 i; i < delta;) {
            uint256 id = depositIds[i];
            liquidityAmounts[i] = liquidityMinted[i] * share / totalShare;
            if (liquidityAmounts[i] != 0) {
                ids[length] = id;
                amounts[length] = liquidityAmounts[i];

                unchecked {
                    ++length;
                }
            }

            unchecked {
                ++i;
            }
        }
        uint256 balanceXBefore = tokenX.balanceOf(address(this));
        uint256 balanceYBefore = tokenY.balanceOf(address(this));

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
        balanceX = tokenX.balanceOf(address(this)) - balanceXBefore;
        balanceY = tokenY.balanceOf(address(this)) - balanceYBefore;
    }

    /**
     * @dev Deposits tokens into the lbPair.
     * @param user The user address to receive sPrime.
     * @param centerId The active Id.
     */
    function _depositToLB(address user, uint256 centerId) internal {
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
        if(depositConfig.depositIds.length == 0) {
            (depositConfig.liquidityConfigs, depositConfig.depositIds) = _encodeDepositConfigs(centerId);
        }

        // Mint the liquidity tokens.
        (bytes32 amountsReceived, bytes32 amountsLeft, uint256[] memory liquidityMinted) = lbPair.mint(address(this), depositConfig.liquidityConfigs, user);
        
        uint256 share = _getTotalInTokenY(amountsReceived.decodeX() - amountsLeft.decodeX(), amountsReceived.decodeY() - amountsLeft.decodeY());
        uint256 tokenId = getUserTokenId(user);
        if(tokenId == 0) {
            tokenId = positionManager.mint(IPositionManager.MintParams({
                recipient: user,
                totalShare: share,
                centerId: centerId,
                liquidityMinted: liquidityMinted,
                liquidityConfigs: depositConfig.liquidityConfigs,
                depositIds: depositConfig.depositIds
            }));
        } else  {
            positionManager.update(IPositionManager.UpdateParams({
                tokenId: tokenId,
                share: share,
                liquidityAmounts: liquidityMinted,
                isAdd: true
            }));
        }
        _mint(user, share);
    }

    /**
    * @dev Internal function to transfer tokens between addresses.
    * @param from The address from which tokens are being transferred.
    * @param to The address to which tokens are being transferred.
    * @param amountX The amount of token X to transfer.
    * @param amountY The amount of token Y to transfer.
    */
    function _transferTokens(address from, address to, uint256 amountX, uint256 amountY) internal {
        if(from == address(this)) {
            if(amountX > 0) tokenX.safeTransfer(to, amountX);
            if(amountY > 0) tokenY.safeTransfer(to, amountY);
        } else {
            if(amountX > 0) tokenX.safeTransferFrom(from, to, amountX);
            if(amountY > 0) tokenY.safeTransferFrom(from, to, amountY);
        }
    }


    /** Public And External Functions */

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param isRebalance Rebalance the existing position with deposit.
    * @param swapSlippage Slippage for the rebalance.
    */
    function deposit(uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) public {
        require(swapSlippage <= _MAX_SLIPPAGE, "Slippage too high");

        _transferTokens(_msgSender(), address(this), amountX, amountY);
        uint256 tokenId = getUserTokenId(_msgSender());
        uint256 activeId = lbPair.getActiveId();
        if(tokenId > 0) {
            (,,, uint256 share, uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
            activeId = centerId;
            if(isRebalance) { // Withdraw Position For Rebalance
                IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
                (uint256 amountXBefore, uint256 amountYBefore, ) = _withdrawFromLB(depositConfig.depositIds, liquidityMinted, share);
                
                positionManager.burn(tokenId);   
                _burn(_msgSender(), share);

                (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
                tokenId = 0;
            }
        }
        (amountX, amountY) = _swapForEqualValues(amountX, amountY, swapSlippage);
        
        // Revert if active id moved without rebalancing
        require(activeId == lbPair.getActiveId() || tokenId == 0, "Bin id changed");
        activeId = lbPair.getActiveId();

        require(activeIdDesired + idSlippage >= activeId && activeId + idSlippage >= activeIdDesired, "Slippage High");

        _transferTokens(address(this), address(lbPair), amountX, amountY);
        _depositToLB(_msgSender(), activeId);
        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", _msgSender()),
            false
        );
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param user The active id that user wants to add liquidity from
    * @param percentForLocks sPrime amount % to lock
    * @param lockPeriods Lock period to Lock for each amount
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    */
    function mintForUserAndLock(address user, uint256[] calldata percentForLocks, uint256[] calldata lockPeriods, uint256 amountX, uint256 amountY) public {
        uint256 activeId = lbPair.getActiveId();

        require(balanceOf(user) == 0, "User already has position");
        require(percentForLocks.length == lockPeriods.length, "Length dismatch");

        deposit(activeId, 0, amountX, amountY, false, 0);

        uint256 balance = balanceOf(user);
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            require(lockPeriods[i] <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
            locks[user].push(LockDetails({
                lockPeriod: lockPeriods[i],
                amount: balance * percentForLocks[i] / 100,
                unlockTime: block.timestamp + lockPeriods[i]
            }));
        }

        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", user),
            false
        );
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param ids Depoisit Ids from TraderJoe
    * @param amounts Minted LBT amount for each deposit id
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param swapSlippage Slippage for the rebalance.
    */
    function migrateLiquidity(uint256[] calldata ids, uint256[] calldata amounts, uint256 activeIdDesired, uint256 idSlippage, uint256 swapSlippage) public {
        uint256 balanceXBefore = tokenX.balanceOf(address(this));
        uint256 balanceYBefore = tokenY.balanceOf(address(this));

        lbPair.burn(address(this), address(this), ids, amounts);

        deposit(activeIdDesired, idSlippage, tokenX.balanceOf(address(this)) - balanceXBefore, tokenY.balanceOf(address(this)) - balanceYBefore, true, swapSlippage);
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param share Amount to withdraw
    */
    function withdraw(uint256 share) external {
        uint256 tokenId = getUserTokenId(_msgSender());
        require(tokenId > 0, "No Position to withdraw");

        (,,,, uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);

        uint256 lockedBalance = getLockedBalance(_msgSender());
        require(balanceOf(_msgSender()) >= share + lockedBalance, "Balance is locked");

        (uint256 amountX, uint256 amountY, uint256[] memory liquidityAmounts) = _withdrawFromLB(depositConfig.depositIds, liquidityMinted, share);

        positionManager.update(IPositionManager.UpdateParams({
            tokenId: tokenId,
            share: share,
            liquidityAmounts: liquidityAmounts,
            isAdd: false
        }));

        // Burn Position NFT
        if(balanceOf(_msgSender()) == share) {
            positionManager.burn(tokenId);
        }

        _burn(_msgSender(), share);

        // Send the tokens to the user.
        _transferTokens(address(this), _msgSender(), amountX, amountY);
        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", _msgSender()),
            false
        );
    }

    /**
    * @dev Locks a specified amount of balance for a specified lock period.
    * @param amount The amount of balance to be locked.
    * @param lockPeriod The duration for which the balance will be locked.
    */
    function lockBalance(uint256 amount, uint256 lockPeriod) public {
        uint256 lockedBalance = getLockedBalance(_msgSender());
        require(balanceOf(_msgSender()) >= amount + lockedBalance, "Insufficient balance to lock");
        require(lockPeriod <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
        locks[_msgSender()].push(LockDetails({
            lockPeriod: lockPeriod,
            amount: amount,
            unlockTime: block.timestamp + lockPeriod
        }));
        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", _msgSender()),
            false
        );
    }

    /**
    * @dev Releases a locked balance at a specified index.
    * @param index The index of the lock to be released.
    */
    function releaseBalance(uint256 index) public {
        require(locks[_msgSender()][index].unlockTime <= block.timestamp, "Still in the lock period");
        uint256 length = locks[_msgSender()].length;
        locks[_msgSender()][index] = locks[_msgSender()][length - 1];

        locks[_msgSender()].pop();
        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", _msgSender()),
            false
        );
    }


    /** Overrided Functions */

    /**
    * @dev The hook that happens before token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if(from != address(0) && to != address(0)) {
            uint256 lockedBalance = getLockedBalance(from);
            require(balanceOf(from) >= amount + lockedBalance, "Insufficient Balance");
            require(getUserTokenId(to) == 0, "Receiver already has a postion");
            
            uint256 tokenId = getUserTokenId(from);

            if(balanceOf(from) == amount) {
                positionManager.forceTransfer(from, to, tokenId);
            } else {
                (,,,,uint256 centerId, uint256[] memory liquidityMinted) = positionManager.positions(tokenId);
                IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfig(centerId);
                for(uint256 i = 0 ; i < liquidityMinted.length ; i ++) {
                    liquidityMinted[i] = liquidityMinted[i] * amount / balanceOf(from);
                }

                positionManager.update(IPositionManager.UpdateParams({
                    tokenId: tokenId,
                    share: amount,
                    liquidityAmounts: liquidityMinted,
                    isAdd: false
                }));

                positionManager.mint(IPositionManager.MintParams({
                    recipient: to,
                    totalShare: amount,
                    centerId: centerId,
                    liquidityMinted: liquidityMinted,
                    liquidityConfigs: depositConfig.liquidityConfigs,
                    depositIds: depositConfig.depositIds
                }));
            }
        }
    }
}