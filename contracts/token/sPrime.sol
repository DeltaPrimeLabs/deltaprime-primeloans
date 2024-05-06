// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;

pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../lib/joe-v2/math/SafeCast.sol";
import "../interfaces/ISPrime.sol";
import "../interfaces/joe-v2/ILBRouter.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IPositionManager.sol";
import "../lib/joe-v2/LiquidityAmounts.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/math/LiquidityConfigurations.sol";
import "../lib/SolvencyMethods.sol";
import "../lib/local/DeploymentConstants.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// SPrime contract declaration
contract SPrime is ISPrime, ReentrancyGuardUpgradeable, OwnableUpgradeable, ERC20Upgradeable, SolvencyMethods {
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20 for safe token transfers
    using LiquidityAmounts for address; // Using LiquidityAmounts for address for getting amounts of liquidity
    using SafeCast for uint256; // Using SafeCast for uint256 for safe type casting
    using PackedUint128Math for bytes32;

    // Constants declaration
    uint256 private constant _MAX_SIPPIAGE = 5;
    uint16 internal constant DEFAULT_BIN_STEP = 25;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    // Mapping for storing pair information and user shares
    mapping(uint256 => PairInfo) public pairList;
    mapping(address => UserInfo) public userInfo;
    mapping(address => LockDetails[]) public locks;
    mapping(uint256 => bool) public pairStatus;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    ILBPair public lbPair;
    IPositionManager public positionManager;

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
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC20_init(name_, "sPrime");

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

        positionManager = IPositionManager(positionManager_);
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
     * @dev Returns the estimated token Y amount from token X.
     * @param tokenId Position Manager token id to rebalance
     * @return status Rebalance status
     */
    function rebalanceStatus(uint256 tokenId) public view returns(bool) {
        (uint128 reserveA, ) = lbPair.getReserves();
        if (reserveA == 0) return false;

        (,,,address sPrimeAddr,,,,uint256 amountX, uint256 amountY) = positionManager.positions(tokenId);

        require(sPrimeAddr == address(this) && (amountX > 0 || amountY > 0), "Wrong Position");

        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        uint256 diff = amountY > amountXToY ? amountY - amountXToY : amountXToY - amountY;

        if(amountY * _MAX_SIPPIAGE / 100 < diff) {
            bool swapTokenX = amountY < amountXToY;
            uint256 amountIn = swapTokenX ? amountX * diff / amountXToY / 2 : diff / 2;
            ILBRouter traderJoeV2Router = ILBRouter(getJoeV2RouterAddress());
            (uint128 amountInLeft, , ) = traderJoeV2Router.getSwapOut(lbPair, uint128(amountIn), swapTokenX);
            return amountInLeft == 0;
        }

        return true;
    }

    /**
     * @dev Check if the active id is in the user position range
     * @param user User Address.
     * @return status bin status
     */
    function binInRange(address user) public view returns(bool) {
        require(userInfo[user].amount > 0, "No position");
        uint256[] memory tokenIds = userInfo[user].tokenIds;
        for (uint256 i = 0; i < userInfo[user].amount; i++) {
            (,,,,, uint256 centerId,,,) = positionManager.positions(tokenIds[i]);
            uint256[] memory depositIds = pairList[centerId].depositIds;
            uint256 activeId = lbPair.getActiveId();
            if (depositIds[0] <= activeId && depositIds[depositIds.length - 1] >= activeId) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @return totalValue Total Value in USD for the user's position.
     */
    function getUserPosition(address user) public view returns (uint256 totalValue) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 amountX;
        uint256 amountY;
        for(uint256 i = 0 ; i < userInfo[user].amount ; i ++) {
            (,,,,,,,uint256 amount0, uint256 amount1) = positionManager.positions(userInfo[user].tokenIds[i]);
            amountX += amount0;
            amountY += amount1;
        }

        amountY += _getTokenYFromTokenX(amountX);
        totalValue = getPrice(tokenManager.tokenAddressToSymbol(address(tokenY))) * amountY / tokenY.decimals();
    }

    /**
    * @dev Returns the ratio of fully vested locked balance to non-vested balance for an account.
    * @param account The address of the account.
    * @return The ratio of fully vested locked balance to total balance
    */
    function getFullyVestedLockedBalanceToNonVestedRatio(address account) public view returns (uint256) {
        uint256 totalBalance = balanceOf(account);
        uint256 fullyVestedBalance;
        for (uint256 i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime <= block.timestamp) {
                fullyVestedBalance += locks[account][i].amount * locks[account][i].lockPeriod / MAX_LOCK_TIME;
            }
        }
        return totalBalance == 0 ? 0 : fullyVestedBalance * 1e18 / totalBalance;
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

    /** Internal Functions */

    /**
    * @dev Adds a new bin for the PRIME-TOKEN pair.
    * @param centerId The unique identifier for the new bin.
    * @param ids Deposit IDs for the pair.
    */
    function _addBins(uint256 centerId, uint256[] memory ids) internal {
        require(!pairStatus[centerId], "Active ID added already");
        PairInfo memory newPairInfo = PairInfo({
            depositIds: ids,
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
    function _getLiquidityConfigs(uint256 centerId) internal view returns (bytes32[] memory liquidityConfigs, uint256[] memory depositIds) {
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
    * @dev Withdraws tokens from the lbPair and applies the AUM annual fee. This function will also reset the range.
    * @param user The postion owner
    * @return totalBalanceX The amount of token X withdrawn.
    * @return totalBalanceY The amount of token Y withdrawn.
    */
    function _withdrawAndUpdateShare(address user) internal returns(uint256 totalBalanceX, uint256 totalBalanceY) {
        uint256 totalShare;
        uint256 userAmount = userInfo[user].amount;

        for(uint256 i = 0 ; i < userAmount ; i ++) {
            uint256 tokenId = userInfo[user].tokenIds[i];
            (,,,,uint256 share, uint256 centerId, uint256[] memory liquidityMinted,,) = positionManager.positions(tokenId);
            PairInfo storage pair = pairList[centerId];
            (uint256 balanceX, uint256 balanceY) = _withdrawFromLB(pair.depositIds, liquidityMinted);
            
            positionManager.burn(tokenId);
            pair.totalShare -= share;

            totalBalanceX += balanceX;
            totalBalanceY += balanceY;
            totalShare += share;
        }
        
        delete userInfo[user];

        _burn(_msgSender(), totalShare);
    }

    /**
    * @dev Withdraws tokens from the Liquidity Book Pair.
    * @param depositIds Deposit ID list.
    * @param liquidityMinted The amount of ids to withdraw.
    * @return balanceX The amount of token X received.
    * @return balanceY The amount of token Y received.
    */
    function _withdrawFromLB(uint256[] memory depositIds, uint256[] memory liquidityMinted) internal returns (uint256 balanceX, uint256 balanceY) {
        uint256 length;
        // Get the lbPair address and the delta between the upper and lower range.
        uint256 delta = depositIds.length;

        uint256[] memory ids = new uint256[](delta);
        uint256[] memory amounts = new uint256[](delta);

        // Get the ids and amounts of the tokens to withdraw.
        for (uint256 i; i < delta;) {
            uint256 id = depositIds[i];

            if (liquidityMinted[i] != 0) {
                ids[length] = id;
                amounts[length] = liquidityMinted[i];

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
     * @param amountX The amount of token X to deposit.
     * @param amountY The amount of token Y to deposit.
     */
    function _depositToLB(address user, uint256 centerId, uint256 amountX, uint256 amountY) internal {
        (bytes32[] memory liquidityConfigs, uint256[] memory depositIds) = _getLiquidityConfigs(centerId);

        if(!pairStatus[centerId]) {
            _addBins(centerId, depositIds);
        }

        // Mint the liquidity tokens.
        (bytes32 amountsReceived, bytes32 amountsLeft, uint256[] memory liquidityMinted) = lbPair.mint(address(this), liquidityConfigs, user);
        uint256 share;
        (share, amountX, amountY) = _updatePairInfo(amountsReceived, centerId);

        uint256 tokenId = positionManager.mint(IPositionManager.MintParams({
            recipient: user,
            totalShare: share,
            centerId: centerId,
            liquidityMinted: liquidityMinted,
            amount0: amountX,
            amount1: amountY
        }));

        _updateUserInfo(user, share, tokenId, Status.ADD);

        (amountX, amountY) = (amountsLeft.decodeX(), amountsLeft.decodeY());

    }

    /**
    * @dev Updates user information based on the action status (ADD or REMOVE).
    * @param user The address of the user.
    * @param share The share amount to update.
    * @param tokenId The ID of the token representing the position.
    * @param status The status of the action (ADD or REMOVE).
    */
    function _updateUserInfo(address user, uint256 share, uint256 tokenId, Status status) internal {
        if(status == Status.ADD) {
            _mint(user, share);

            userInfo[user].tokenIds.push(tokenId);
            userInfo[user].amount++;
        } else {
            // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
            _burn(user, share);

            uint256 length = userInfo[user].amount;
            for(uint256 i = 0 ; i < length - 1; i ++) {
                if(userInfo[user].tokenIds[i] == tokenId) {
                    userInfo[user].tokenIds[i] = userInfo[user].tokenIds[length - 1];
                }
            }
            userInfo[user].tokenIds.pop();
            userInfo[user].amount--;
        }
    }

    /**
    * @dev Updates pair information after receiving amounts from a TraderJoe.
    * @param amountsReceived The amounts received encoded in bytes32.
    * @param centerId The bin ID of the pair.
    * @return share The share amount updated.
    * @return amountXReceived The amount of token X received.
    * @return amountYReceived The amount of token Y received.
    */
    function _updatePairInfo(bytes32 amountsReceived, uint256 centerId) internal returns (uint256 share, uint256 amountXReceived, uint256 amountYReceived) {
        PairInfo storage pair = pairList[centerId];
        (uint256 balanceX, uint256 balanceY) = _getBalances(centerId);
        
        amountXReceived = amountsReceived.decodeX();
        amountYReceived = amountsReceived.decodeY();

        uint256 weight = _getTotalWeight(amountXReceived, amountYReceived);
        uint256 totalWeight = _getTotalWeight(balanceX, balanceY);
        
        if (pair.totalShare > 0) {
            share = pair.totalShare * weight / (totalWeight - weight);
        } else {
            share = weight;
        }
        pair.totalShare += share;
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
    */
    function deposit(uint256 activeIdDesired, uint256 idSlippage, uint256 amountX, uint256 amountY) public {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        if(userInfo[_msgSender()].amount > 0) {
            (uint256 amountXBefore, uint256 amountYBefore) = _withdrawAndUpdateShare(_msgSender());
            (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
        }
        (amountX, amountY) = _getUpdatedAmounts(amountX, amountY);

        uint256 activeId = lbPair.getActiveId();
        require(activeIdDesired + idSlippage >= activeId && activeId + idSlippage >= activeIdDesired, "Slippage High");
        
        _transferTokens(address(this), address(lbPair), amountX, amountY);

        _depositToLB(_msgSender(), activeId, amountX, amountY);
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param tokenId Token Id to withdraw
    */
    function withdraw(uint256 tokenId) external {
        address nftOwner = IERC721(address(positionManager)).ownerOf(tokenId);
        require(nftOwner == _msgSender(), "Not the NFT owner");

        (,,,,uint256 shareWithdraw, uint256 centerId, uint256[] memory liquidityMinted,,) = positionManager.positions(tokenId);

        uint256 lockedBalance = getLockedBalance(nftOwner);
        require(balanceOf(nftOwner) >= shareWithdraw + lockedBalance, "Balance is locked");

        PairInfo storage pair = pairList[centerId];

        (uint256 amountX, uint256 amountY) = _withdrawFromLB(pair.depositIds, liquidityMinted);

        _updateUserInfo(nftOwner, shareWithdraw, tokenId, Status.REMOVE);

        // Burn Position NFT and update total share for the pair
        positionManager.burn(tokenId);
        pair.totalShare -= shareWithdraw;
        // Send the tokens to the user.
        _transferTokens(address(this), nftOwner, amountX, amountY);
    }

    /**
    * @dev Transfers ownership of a position NFT to another address.
    * @param to The address to transfer the position NFT to.
    * @param tokenId The ID of the token representing the position to transfer.
    */
    function transferPosition(address to, uint256 tokenId) external {
        address nftOwner = IERC721(address(positionManager)).ownerOf(tokenId);
        require(nftOwner == _msgSender(), "Not the NFT owner");

        (,,,,uint256 shareWithdraw,,,,) = positionManager.positions(tokenId);

        uint256 lockedBalance = getLockedBalance(nftOwner);
        require(balanceOf(nftOwner) >= shareWithdraw + lockedBalance, "Balance is locked");

        positionManager.forceTransfer(nftOwner, to, tokenId);
        
        uint256 length = userInfo[nftOwner].amount;
        for(uint i = 0 ; i < length - 1; i ++) {
            if(userInfo[nftOwner].tokenIds[i] == tokenId) {
                userInfo[nftOwner].tokenIds[i] = userInfo[nftOwner].tokenIds[length - 1];
            }
        }
        userInfo[nftOwner].tokenIds.pop();
        userInfo[nftOwner].amount -= 1;
        _burn(nftOwner, shareWithdraw);

        userInfo[to].tokenIds.push(tokenId);
        userInfo[to].amount += 1;
        _mint(to, shareWithdraw);
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
            uint256 totalShare = 0;
            uint256 userAmount = userInfo[from].amount;
            for(uint256 i = 0 ; i < userAmount ; i ++) {
                (,,,,uint256 share,,,,) = positionManager.positions(userInfo[from].tokenIds[i]);
                totalShare += share;
            }
            require(totalShare == amount, "You can only transfer full position");
            for(uint256 i = 0 ; i < userAmount ; i ++) {
                positionManager.forceTransfer(from, to, userInfo[from].tokenIds[i]);
                uint256 tokenId = userInfo[from].tokenIds[i];
                userInfo[to].tokenIds.push(tokenId);
            }
            userInfo[to].amount += userInfo[from].amount;
            delete userInfo[from];
        }
    }
}
