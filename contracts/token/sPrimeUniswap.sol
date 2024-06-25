// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/ISPrimeUniswap.sol";
import "../interfaces/uniswap-v3/IUniswapV3Factory.sol";
import "../interfaces/uniswap-v3/ISwapRouter.sol";
import "../lib/uniswap-v3/OracleLibrary.sol";
import "../lib/uniswap-v3/PositionValue.sol";
import "../lib/uniswap-v3/UniswapV3IntegrationHelper.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

// SPrime contract declaration
contract sPrimeUniswap is ISPrimeUniswap, ReentrancyGuardUpgradeable, PendingOwnableUpgradeable, ERC20Upgradeable, ERC721HolderUpgradeable, ProxyConnector {
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20 for safe token transfers
    using PositionValue for INonfungiblePositionManager;
    // Constants declaration
    uint256 private constant _REBALANCE_MARGIN = 5; // Rebalance Limit - If token diff is smaller than this percent, it will skip the token swap part
    uint256 private constant _MAX_SLIPPAGE = 10;   // Max slippage percent at the time of token swap for equal values
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    // Mapping for storing pair information and user shares
    mapping(address => LockDetails[]) public locks;
    mapping(address => uint256) public userTokenId;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    IUniswapV3Pool public pool;
    int24 public tickSpacing;

    INonfungiblePositionManager public positionManager;
    ISwapRouter public swapRouter;

    address public vPrimeController;
    uint24 public feeTier;
    uint8 public tokenDecimals;
    bool public tokenSequence;

    int24[2] private deltaIds;

    /**
    * @dev Initializer of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param feeTier_ Fee Tier of Uniswap V3 Pool
    * @param deltaIds_ Delta id for tick lower and tick upper
    * @param positionManager_ Uniswap v3 NonfungiblePositionManager contract
    * @param swapRouter_ Uniswap V3 Swap Router contract
    * @param uniV3Factory_ Uniswap V3 Factory contract
    */
    function initialize(IERC20Metadata tokenX_, IERC20Metadata tokenY_, string memory name_, uint24 feeTier_, int24[2] memory deltaIds_, INonfungiblePositionManager positionManager_, ISwapRouter swapRouter_, IUniswapV3Factory uniV3Factory_) external initializer {
        __PendingOwnable_init();
        __ReentrancyGuard_init_unchained();
        __ERC20_init_unchained(name_, "sPrime");
        __ERC721Holder_init_unchained();

        tokenDecimals = tokenY_.decimals();

        tokenSequence = tokenX_ > tokenY_;
        (tokenX_, tokenY_) = tokenSequence ? (tokenY_, tokenX_) : (tokenX_, tokenY_);
        tokenX = tokenX_;
        tokenY = tokenY_;
        feeTier = feeTier_;
        
        positionManager = positionManager_;
        swapRouter = swapRouter_;

        address poolAddress = uniV3Factory_.getPool(address(tokenX_), address(tokenY_), feeTier_);
        if (poolAddress == address(0)) {
            revert PoolNotExisting();
        }
        pool = IUniswapV3Pool(poolAddress);
        tickSpacing = pool.tickSpacing();
        deltaIds = deltaIds_;
    }

    function setVPrimeControllerAddress(address _vPrimeController) public onlyOwner {
        vPrimeController = _vPrimeController;
    }

    function getTokenX() public view returns (IERC20) {
        return IERC20(tokenX);
    }

    function getTokenY() public view returns (IERC20) {
        return IERC20(tokenY);
    }

    /**
     * @dev Check if the tick is in the user position range
     * @param user User Address.
     * @return status tick status
     */
    function tickInRange(address user) public view returns(bool) {
        uint256 tokenId = userTokenId[user];
        if (tokenId <= 0) {
            revert NoPosition();
        }
        (, int24 tick,,,,,) = pool.slot0();

        (,,,,,int24 tickLower, int24 tickUpper,,,,,) = positionManager.positions(tokenId);
        return tickLower <= tick && tick <= tickUpper;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @param poolPrice Pool Price or oracle price for calculating proper token amount
     * @return Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(address user, uint256 poolPrice) public view returns (uint256) {
        uint256 tokenId = userTokenId[user];
        uint256 PRECISION = 20;

        if (tokenId <= 0) {
            revert NoPosition();
        }

        (IERC20Metadata token0, IERC20Metadata token1) = (tokenX, tokenY);
        uint256 price = poolPrice;
        if(tokenSequence) {
            (token0, token1) = (tokenY, tokenX);
        } else {
            price = 1e16 / price;
        }

        price = price * 10**(PRECISION + token1.decimals() - token0.decimals() - 8);
        uint160 sqrtRatioX96 = uint160(UniswapV3IntegrationHelper.sqrt(price) * 2**96 / 10**(PRECISION/2));

        (uint256 amountX, uint256 amountY) = positionManager.total(tokenId, sqrtRatioX96);
        
        (amountX, amountY) = tokenSequence ? (amountY, amountX) : (amountX, amountY);

        if(tokenY.decimals() >= tokenX.decimals() + 8) {
            amountY = amountY + amountX * poolPrice * 10 ** (tokenY.decimals() - tokenX.decimals() - 8);
        } else {
            amountY = amountY + FullMath.mulDiv(amountX, poolPrice, 10 ** (tokenX.decimals() + 8 - tokenY.decimals()));
        }
        return amountY;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @return Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(address user) external view returns (uint256) {
        uint256 poolPrice = getPoolPrice();
        return getUserValueInTokenY(user, poolPrice);
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
                fullyVestedBalance += FullMath.mulDiv(locks[account][i].amount, locks[account][i].lockPeriod, MAX_LOCK_TIME);
            }
        }
    }

    /**
    * @dev Returns the total locked balance of an account.
    * @param account The address of the account.
    * @return The total locked balance of the account.
    */
    function getLockedBalance(address account) public view returns (uint256) {
        uint256 lockedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
            if (locks[account][i].unlockTime > block.timestamp) {
                lockedBalance += locks[account][i].amount;
            }
        }
        return lockedBalance;
    }

    /**
     * @dev Returns the total weight of tokens in a liquidity pair.
     * @param amountX Token X Amount.
     * @param amountY Token Y Amount.
     * @return weight The total weight of tokens in the liquidity pair.
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
        (,int24 tick,,,,,) = pool.slot0();
        amountY = OracleLibrary.getQuoteAtTick(tick, uint128(amountX), address(tokenX), address(tokenY));
    }

    function getPoolPrice() public view returns(uint256) {
        (,int24 tick,,,,,) = pool.slot0();
        (address token0, address token1) = tokenSequence ? (address(tokenY), address(tokenX)) : (address(tokenX), address(tokenY));
        uint256 price = OracleLibrary.getQuoteAtTick(tick, uint128(10 ** IERC20Metadata(address(token0)).decimals()), address(token0), address(token1));
        return FullMath.mulDiv(price, 1e8, 10 ** IERC20Metadata(address(token1)).decimals());
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
                (,int24 tick,,,,,) = pool.slot0();
                amountIn = OracleLibrary.getQuoteAtTick(tick, uint128(diff / 2), address(tokenY), address(tokenX));
            }
            uint256 amountOut = diff / 2; 
            
            address tokenIn;
            address tokenOut;

            (amountIn, amountOut) = swapTokenX ? (amountIn, amountOut) : (amountOut, amountIn);

            if (swapTokenX) {
                tokenIn = address(tokenX);
                tokenOut = address(tokenY);
                tokenX.safeApprove(address(swapRouter), 0);
                tokenX.safeApprove(address(swapRouter), amountIn);
            } else {
                tokenIn = address(tokenY);
                tokenOut = address(tokenX);
                tokenY.safeApprove(address(swapRouter), 0);
                tokenY.safeApprove(address(swapRouter), amountIn);
            }
            (amountIn, amountOut) = _processTokenSwap(tokenIn, tokenOut, amountIn, amountOut * (100 - swapSlippage) / 100);

            (amountX, amountY) = swapTokenX ? (amountX - amountIn, amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
        }
        return (amountX, amountY);
    }

    function _processTokenSwap(address tokenIn, address tokenOut, uint256 amount, uint256 amountOutMinimum) internal returns (uint256 amountIn, uint256 amountOut){
        uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: feeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
        amountIn = beforeBalance - IERC20(tokenIn).balanceOf(address(this));
    }


    function _depositToUniswap(address user, int24 tickLower, int24 tickUpper, uint256 amountX, uint256 amountY) internal {
        uint256 tokenId = userTokenId[user];
        uint256 amountXAdded;
        uint256 amountYAdded;
        tokenX.forceApprove(address(positionManager), amountX);
        tokenY.forceApprove(address(positionManager), amountY);
        if(tokenId == 0) {
            (tokenId,,amountXAdded, amountYAdded) = positionManager.mint(INonfungiblePositionManager.MintParams({
                token0: address(tokenX),
                token1: address(tokenY),
                fee: feeTier,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amountX,
                amount1Desired: amountY,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            }));
            userTokenId[user] = tokenId;
        } else  {
            (, amountXAdded, amountYAdded) = positionManager.increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amountX,
                amount1Desired: amountY,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            }));
        }
        uint256 share = _getTotalInTokenY(amountXAdded, amountYAdded);
        _transferTokens(address(this), user, amountX - amountXAdded, amountY - amountYAdded);

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

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param tickDesired The tick that user wants to add liquidity from
    * @param tickSlippage The tick slippage that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param isRebalance Rebalance the existing position with deposit.
    * @param swapSlippage Slippage for the rebalance.
    */
    function deposit(int24 tickDesired, int24 tickSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) public nonReentrant {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        _deposit(tickDesired, tickSlippage, amountX, amountY, isRebalance, swapSlippage);
    }

    function _deposit(int24 tickDesired, int24 tickSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) internal {
        if (swapSlippage > _MAX_SLIPPAGE) {
            revert SlippageTooHigh();
        }

        int24 currenTick;
        int24 tickLower;
        int24 tickUpper;

        uint256 tokenId = userTokenId[_msgSender()];
        if(tokenId > 0) {
            uint128 liquidity;
            (,,,,, tickLower, tickUpper, liquidity,,,,) = positionManager.positions(tokenId);

            if(isRebalance) { // Withdraw Position For Rebalance
                positionManager.decreaseLiquidity(
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId, 
                        liquidity: liquidity,
                        amount0Min:0, 
                        amount1Min:0, 
                        deadline: block.timestamp
                    })
                );

                (uint256 amountXBefore, uint256 amountYBefore) = positionManagerCollect(tokenId, address(this));

                _burn(_msgSender(), balanceOf(_msgSender()));
                positionManager.burn(tokenId);

                delete userTokenId[_msgSender()];

                (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
            }
        }
        (amountX, amountY) = _swapForEqualValues(amountX, amountY, swapSlippage);

        if(userTokenId[_msgSender()] == 0) {
            (, currenTick,,,,,) = pool.slot0();
            if (!(tickDesired + tickSlippage >= currenTick && currenTick + tickSlippage >= tickDesired)) {
                revert SlippageTooHigh();
            }
            tickLower = currenTick + tickSpacing * deltaIds[0] >= TickMath.MIN_TICK ? currenTick + tickSpacing * deltaIds[0] : TickMath.MIN_TICK;
            tickUpper = currenTick + tickSpacing * deltaIds[1] <= TickMath.MAX_TICK ? currenTick + tickSpacing * deltaIds[1] : TickMath.MAX_TICK;
        }
        _depositToUniswap(_msgSender(), tickLower, tickUpper, amountX, amountY);

        updateVPrimeSnapshotFor(_msgSender());
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param share Amount to withdraw
    */
    function withdraw(uint256 share) external nonReentrant {
        uint256 tokenId = userTokenId[_msgSender()];
        if (tokenId <= 0) {
            revert NoPositionToWithdraw();
        }

        (,,,,,,,uint128 liquidity,,,,) = positionManager.positions(tokenId);

        uint256 lockedBalance = getLockedBalance(_msgSender());
        if (balanceOf(_msgSender()) < share + lockedBalance) {
            revert BalanceLocked();
        }

        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, 
                liquidity: uint128(liquidity * share / balanceOf(_msgSender())),
                amount0Min:0, 
                amount1Min:0, 
                deadline: block.timestamp
            })
        );

        // Directly send tokens to the user
        positionManagerCollect(tokenId, _msgSender());

        // Burn Position NFT
        if(balanceOf(_msgSender()) == share) {
            positionManager.burn(tokenId);
            delete userTokenId[_msgSender()];
        }

        _burn(_msgSender(), share);

        updateVPrimeSnapshotFor(_msgSender());
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param user The active id that user wants to add liquidity from
    * @param percentForLocks sPrime amount % to lock
    * @param lockPeriods Lock period to Lock for each amount
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    */
    function mintForUserAndLock(address user, uint256[] calldata percentForLocks, uint256[] calldata lockPeriods, uint256 amountX, uint256 amountY) public nonReentrant {
        
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        if (balanceOf(user) != 0) {
            revert ReceiverAlreadyHasPosition();
        }
        if (percentForLocks.length != lockPeriods.length) {
            revert LengthMismatch();
        }

        (amountX, amountY) = _swapForEqualValues(amountX, amountY, _MAX_SLIPPAGE);

        (, int24 currenTick,,,,,) = pool.slot0();
        int24 tickLower = currenTick -  tickSpacing * deltaIds[0];
        int24 tickUpper = currenTick + tickSpacing * deltaIds[1];
        _depositToUniswap(_msgSender(), tickLower, tickUpper, amountX, amountY);
        
        uint256 totalLock;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            totalLock += percentForLocks[i];
        }
        if (totalLock != 100) {
            revert TotalLockMismatch();
        }

        uint256 balance = balanceOf(user);
        totalLock = 0;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            if (lockPeriods[i] > MAX_LOCK_TIME) {
                revert LockPeriodExceeded();
            }
            // Should minus from total balance to avoid the round issue
            uint256 amount = i == lockPeriods.length - 1 ? balance - totalLock : balance * percentForLocks[i] / 100;
            locks[user].push(LockDetails({
                lockPeriod: lockPeriods[i],
                amount: amount,
                unlockTime: block.timestamp + lockPeriods[i]
            }));
            totalLock += amount;
        }

        updateVPrimeSnapshotFor(user);
    }

    function positionManagerCollect(uint256 tokenId, address recipient) internal returns (uint256 amount0, uint256 amount1){
        return positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: recipient,
                amount0Max:type(uint128).max,
                amount1Max:type(uint128).max
            })
        );
    }

    /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param tokenId Token ID from UniswapPositionManager
    * @param liquidity Liquidity amount for position
    * @param tickDesired The tick that user wants to add liquidity from
    * @param tickSlippage The tick slippage that are allowed to slip
    * @param swapSlippage Slippage for the rebalance.
    */
    function migrateLiquidity(uint256 tokenId, uint128 liquidity, int24 tickDesired, int24 tickSlippage, uint256 swapSlippage) public nonReentrant {
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, 
                liquidity: liquidity,
                amount0Min:0, 
                amount1Min:0, 
                deadline: block.timestamp
            })
        );

        (uint256 amountX, uint256 amountY) = positionManagerCollect(tokenId, address(this));

        positionManager.burn(tokenId);
        _deposit(tickDesired, tickSlippage, amountX, amountY, true, swapSlippage);
    }

    /**
    * @dev Locks a specified amount of balance for a specified lock period.
    * @param amount The amount of balance to be locked.
    * @param lockPeriod The duration for which the balance will be locked.
    */
    function lockBalance(uint256 amount, uint256 lockPeriod) public nonReentrant {
        uint256 lockedBalance = getLockedBalance(_msgSender());
        if (balanceOf(_msgSender()) < amount + lockedBalance) {
            revert InsufficientBalanceToLock();
        }
        if (lockPeriod > MAX_LOCK_TIME) {
            revert LockPeriodExceeded();
        }
        locks[_msgSender()].push(LockDetails({
            lockPeriod: lockPeriod,
            amount: amount,
            unlockTime: block.timestamp + lockPeriod
        }));

        updateVPrimeSnapshotFor(_msgSender());
    }


    /** Overrided Functions */

    /**
    * @dev The hook that happens after token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if(from != address(0) && to != address(0)) {
            uint256 balance = getLockedBalance(from);
            uint256 fromBalance = balanceOf(from);
            if (fromBalance < amount + balance) {
                revert InsufficientBalance();
            }
            if (userTokenId[to] != 0) {
                revert ReceiverAlreadyHasPosition();
            }
            
            uint256 tokenId = userTokenId[from];

            if(fromBalance == amount) {
                userTokenId[to] = userTokenId[from];
                delete userTokenId[from];
            } else {
                (,,,,,int24 tickLower,int24 tickUpper,uint128 liquidity,,,,) = positionManager.positions(tokenId);

                positionManager.decreaseLiquidity(
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId, 
                        liquidity: uint128(liquidity * amount / fromBalance),
                        amount0Min:0, 
                        amount1Min:0, 
                        deadline: block.timestamp
                    })
                );

                (uint256 amountX, uint256 amountY) = positionManagerCollect(tokenId, address(this));

                (uint256 newTokenId,,uint256 amountXAdded, uint256 amountYAdded) = positionManager.mint(INonfungiblePositionManager.MintParams({
                    token0: address(tokenX),
                    token1: address(tokenY),
                    fee: feeTier,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amountX,
                    amount1Desired: amountY,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                }));
                // Reusing balance to avoid stack too deep
                balance = _getTotalInTokenY(amountXAdded, amountYAdded);
                if(amount > balance) {
                    _burn(to, amount - balance);
                } else {
                    _mint(to, balance - amount);
                }
                _transferTokens(address(this), to, amountX - amountXAdded, amountY - amountYAdded);

                userTokenId[to] = newTokenId;
            }
            updateVPrimeSnapshotFor(from);
            updateVPrimeSnapshotFor(to);
        }
    }

    function updateVPrimeSnapshotFor(address account) internal {
        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature
            ("updateVPrimeSnapshot(address)", account),
            false
        );
    }

    function decimals() public view virtual override returns (uint8) {
        return tokenDecimals;
    }

    // CUSTOM ERROR MESSAGES
    error PoolNotExisting();
    error InsufficientBalance();
    error ReceiverAlreadyHasPosition();
    error NoPosition();
    error SlippageTooHigh();
    error NoPositionToWithdraw();
    error StillInLockPeriod();
    error BalanceLocked();
    error UserAlreadyHasPosition();
    error LengthMismatch();
    error TotalLockMismatch();
    error InsufficientBalanceToLock();
    error LockPeriodExceeded();
}
