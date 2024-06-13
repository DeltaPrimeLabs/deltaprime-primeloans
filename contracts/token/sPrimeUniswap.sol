// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/ISPrimeUniswap.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/uniswap-v3/IUniswapV3Factory.sol";
import "../interfaces/uniswap-v3/ISwapRouter.sol";
import "../lib/uniswap-v3/OracleLibrary.sol";
import "../lib/uniswap-v3/PositionValue.sol";
import "../lib/local/DeploymentConstants.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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
    uint256 private constant _REBALANCE_MARGIN = 5;
    uint256 private constant _MAX_SLIPPAGE = 10;
    int24 private constant _TICK_RANGE = 10;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    // Mapping for storing pair information and user shares
    mapping(address => LockDetails[]) public locks;
    mapping(address => uint256) public userTokenId;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    IUniswapV3Pool public pool;

    address public vPrimeController;
    uint24 public feeTier;
    uint256 public totalXSupply;
    uint256 public totalYSupply;

    int24[2] private deltaIds;

    /**
    * @dev Constructor of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param feeTier_ Fee Tier of Uniswap V3 Pool
    * @param deltaIds_ Delta id for tick lower and tick upper
    * @param vPrimeController_ VPrime Controller
    */
    function initialize(address tokenX_, address tokenY_, string memory name_, uint24 feeTier_, int24[2] memory deltaIds_, address vPrimeController_) external initializer {
        __PendingOwnable_init();
        __ReentrancyGuard_init();
        __ERC20_init(name_, "sPrime");
        __ERC721Holder_init();

        (tokenX_, tokenY_) = tokenX_ < tokenY_ ? (tokenX_, tokenY_) : (tokenY_, tokenX_);

        tokenX = IERC20Metadata(tokenX_);
        tokenY = IERC20Metadata(tokenY_);
        feeTier = feeTier_;

        address poolAddress = IUniswapV3Factory(getUniV3FactoryAddress()).getPool(tokenX_, tokenY_, feeTier_);
        
        pool = IUniswapV3Pool(poolAddress);
        vPrimeController = vPrimeController_;
        deltaIds = deltaIds_;
    }

    /**
     * @dev Returns the address of the Uniswap V3 Factory.
     * @return The address of the Uniswap V3 Factory.
     */
    function getUniV3FactoryAddress() public view virtual returns (address){
        return 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    }

    /**
     * @dev Returns the address of the Uniswap V3 NonfungiblePositionManager.
     * @return The address of the Uniswap V3 NonfungiblePositionManager.
     */
    function getNonfungiblePositionManagerAddress() public view virtual returns (address){
        return 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    }

    /**
     * @dev Returns the address of the Uniswap V3 SwapRouter.
     * @return The address of the Uniswap V3 SwapRouter.
     */
    function getSwapRouter() public view virtual returns (address){
        return 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    }

    /**
     * @dev Check if the tick is in the user position range
     * @param user User Address.
     * @return status tick status
     */
    function tickInRange(address user) public view returns(bool) {
        uint256 tokenId = userTokenId[user];
        require(tokenId > 0, "No position");

        address positionManager = getNonfungiblePositionManagerAddress();
        (, int24 tick,,,,,) = pool.slot0();
        (,,,,,int24 tickLower, int24 tickUpper,,,,,) = INonfungiblePositionManager(positionManager).positions(tokenId);
        if (tickLower <= tick && tick <= tickUpper) {
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
        uint256 tokenId = userTokenId[user];
        require(tokenId > 0, "No position");
        
        (uint160 sqrtRatioX96,,,,,,) = pool.slot0();

        address positionManager = getNonfungiblePositionManagerAddress();
        (uint256 amountX, uint256 amountY) = INonfungiblePositionManager(positionManager).total(tokenId, sqrtRatioX96);
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
            
            address swapRouter = getSwapRouter();
            address tokenIn;
            address tokenOut;

            (amountIn, amountOut) = swapTokenX ? (amountIn, amountOut) : (amountOut, amountIn);

            if (swapTokenX) {
                tokenIn = address(tokenX);
                tokenOut = address(tokenY);
                tokenX.forceApprove(swapRouter, amountIn);
            } else {
                tokenIn = address(tokenY);
                tokenOut = address(tokenX);
                tokenY.forceApprove(swapRouter, amountIn);
            }

            amountOut = ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: feeTier,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: amountOut * (100 - swapSlippage) / 100,
                    sqrtPriceLimitX96: 0
                })
            );

            (amountX, amountY) = swapTokenX ? (amountX - amountIn, amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
        }
        return (amountX, amountY);
    }


    function _depositToUniswap(address user, int24 tickLower, int24 tickUpper, uint256 amountX, uint256 amountY) internal {
        uint256 tokenId = userTokenId[user];
        uint256 amountXAdded;
        uint256 amountYAdded;
        address positionManager = getNonfungiblePositionManagerAddress();
        tokenX.forceApprove(positionManager, amountX);
        tokenY.forceApprove(positionManager, amountY);

        if(tokenId == 0) {
            (tokenId,,amountXAdded, amountYAdded) = INonfungiblePositionManager(positionManager).mint(INonfungiblePositionManager.MintParams({
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
            (, amountXAdded, amountYAdded) = INonfungiblePositionManager(positionManager).increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
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
    function deposit(int24 tickDesired, int24 tickSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) public {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        _deposit(tickDesired, tickSlippage, amountX, amountY, isRebalance, swapSlippage);
    }

    function _deposit(int24 tickDesired, int24 tickSlippage, uint256 amountX, uint256 amountY, bool isRebalance, uint256 swapSlippage) internal {
        require(swapSlippage <= _MAX_SLIPPAGE, "Slippage too high");

        int24 currenTick;
        int24 tickLower;
        int24 tickUpper;

        uint256 tokenId = userTokenId[_msgSender()];
        if(tokenId > 0) {
            address positionManager = getNonfungiblePositionManagerAddress();
            uint128 liquidity;
            (,,,,, tickLower, tickUpper, liquidity,,,,) = INonfungiblePositionManager(positionManager).positions(tokenId);

            if(isRebalance) { // Withdraw Position For Rebalance
                INonfungiblePositionManager(positionManager).decreaseLiquidity(
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId, 
                        liquidity: liquidity,
                        amount0Min:0, 
                        amount1Min:0, 
                        deadline: block.timestamp
                    })
                );

                (uint256 amountXBefore, uint256 amountYBefore) = INonfungiblePositionManager(positionManager).collect(
                    INonfungiblePositionManager.CollectParams({
                        tokenId: tokenId,
                        recipient: address(this),
                        amount0Max:type(uint128).max, 
                        amount1Max:type(uint128).max
                    })
                );

                _burn(_msgSender(), balanceOf(_msgSender()));
                INonfungiblePositionManager(positionManager).burn(tokenId);

                delete userTokenId[_msgSender()];

                (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
            }
        }
        (amountX, amountY) = _swapForEqualValues(amountX, amountY, swapSlippage);

        if(userTokenId[_msgSender()] == 0) {
            (, currenTick,,,,,) = pool.slot0();
            require(tickDesired + tickSlippage >= currenTick && currenTick + tickSlippage >= tickDesired, "Slippage High");
            tickLower = currenTick -  _TICK_RANGE * deltaIds[0];
            tickUpper = currenTick + _TICK_RANGE * deltaIds[1];
        }
        _depositToUniswap(_msgSender(), tickLower, tickUpper, amountX, amountY);

        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", _msgSender()),
            false
        );
    }

    /**
    * @dev Users can use withdraw function for withdrawing their share.
    * @param share Amount to withdraw
    */
    function withdraw(uint256 share) external {
        uint256 tokenId = userTokenId[_msgSender()];
        require(tokenId > 0, "No Position to withdraw");
        address positionManager = getNonfungiblePositionManagerAddress();

        (,,,,,,,uint128 liquidity,,,,) = INonfungiblePositionManager(positionManager).positions(tokenId);

        uint256 lockedBalance = getLockedBalance(_msgSender());
        require(balanceOf(_msgSender()) >= share + lockedBalance, "Balance is locked");

        INonfungiblePositionManager(positionManager).decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, 
                liquidity: uint128(liquidity * share / balanceOf(_msgSender())),
                amount0Min:0, 
                amount1Min:0, 
                deadline: block.timestamp
            })
        );

        // Directly send tokens to the user
        INonfungiblePositionManager(positionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: _msgSender(),
                amount0Max:type(uint128).max, 
                amount1Max:type(uint128).max
            })
        );

        // Burn Position NFT
        if(balanceOf(_msgSender()) == share) {
            INonfungiblePositionManager(positionManager).burn(tokenId);
            delete userTokenId[_msgSender()];
        }

        _burn(_msgSender(), share);

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
        
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        require(balanceOf(user) == 0, "User already has position");
        require(percentForLocks.length == lockPeriods.length, "Length dismatch");

        (amountX, amountY) = _swapForEqualValues(amountX, amountY, _MAX_SLIPPAGE);

        (, int24 currenTick,,,,,) = pool.slot0();
        int24 tickLower = currenTick -  _TICK_RANGE * deltaIds[0];
        int24 tickUpper = currenTick + _TICK_RANGE * deltaIds[1];
        _depositToUniswap(_msgSender(), tickLower, tickUpper, amountX, amountY);
        
        uint256 totalLock;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            totalLock += percentForLocks[i];
        }
        require(totalLock == 100, "Should lock all");

        uint256 balance = balanceOf(user);
        totalLock = 0;
        for(uint8 i = 0 ; i < lockPeriods.length ; i ++) {
            require(lockPeriods[i] <= MAX_LOCK_TIME, "Cannot lock for more than 3 years");
            // Should minus from total balance to avoid the round issue
            uint256 amount = i == lockPeriods.length - 1 ? balance - totalLock : balance * percentForLocks[i] / 100;
            locks[user].push(LockDetails({
                lockPeriod: lockPeriods[i],
                amount: amount,
                unlockTime: block.timestamp + lockPeriods[i]
            }));
            totalLock += amount;
        }

        proxyCalldata(
            vPrimeController,
            abi.encodeWithSignature("updateVPrimeSnapshot(address)", user),
            false
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
    function migrateLiquidity(uint256 tokenId, uint128 liquidity, int24 tickDesired, int24 tickSlippage, uint256 swapSlippage) public {
        address positionManager = getNonfungiblePositionManagerAddress();
        INonfungiblePositionManager(positionManager).decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, 
                liquidity: liquidity,
                amount0Min:0, 
                amount1Min:0, 
                deadline: block.timestamp
            })
        );

        (uint256 amountX, uint256 amountY) = INonfungiblePositionManager(positionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max:type(uint128).max, 
                amount1Max:type(uint128).max
            })
        );

        INonfungiblePositionManager(positionManager).burn(tokenId);
        _deposit(tickDesired, tickSlippage, amountX, amountY, true, swapSlippage);
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
    * @dev The hook that happens after token transfer.
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to transfer.
    */
    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if(from != address(0) && to != address(0)) {
            uint256 balance = getLockedBalance(from);
            require(balanceOf(from) >= amount + balance, "Insufficient Balance");
            require(userTokenId[to] == 0, "Receiver already has a postion");
            
            uint256 tokenId = userTokenId[from];

            if(balanceOf(from) == amount) {
                userTokenId[to] = userTokenId[from];
                delete userTokenId[from];
            } else {
                address positionManager = getNonfungiblePositionManagerAddress();
                (,,,,,int24 tickLower,int24 tickUpper,uint128 liquidity,,,,) = INonfungiblePositionManager(positionManager).positions(tokenId);

                INonfungiblePositionManager(positionManager).decreaseLiquidity(
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId, 
                        liquidity: uint128(liquidity * amount / balanceOf(from)),
                        amount0Min:0, 
                        amount1Min:0, 
                        deadline: block.timestamp
                    })
                );

                (uint256 amountX, uint256 amountY) = INonfungiblePositionManager(positionManager).collect(
                    INonfungiblePositionManager.CollectParams({
                        tokenId: tokenId,
                        recipient: address(this),
                        amount0Max:type(uint128).max, 
                        amount1Max:type(uint128).max
                    })
                );

                (uint256 newTokenId,,uint256 amountXAdded, uint256 amountYAdded) = INonfungiblePositionManager(positionManager).mint(INonfungiblePositionManager.MintParams({
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
        }
    }
}
