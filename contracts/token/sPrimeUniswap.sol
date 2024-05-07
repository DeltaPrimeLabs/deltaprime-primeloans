// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/ISPrimeUniswap.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/uniswap-v3/IUniswapV3Pool.sol";
import "../interfaces/uniswap-v3/IUniswapV3Factory.sol";
import "../interfaces/uniswap-v3/ISwapRouter.sol";
import "../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";
import "../lib/uniswap-v3/OracleLibrary.sol";
import "../lib/SolvencyMethods.sol";
import "../lib/local/DeploymentConstants.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

// SPrime contract declaration
contract sPrimeUniswap is ISPrimeUniswap, ReentrancyGuardUpgradeable, OwnableUpgradeable, ERC20Upgradeable, ERC721HolderUpgradeable, SolvencyMethods {
    using SafeERC20 for IERC20Metadata; // Using SafeERC20 for IERC20 for safe token transfers

    // Constants declaration
    uint256 private constant _TICK_RANGE = 10;
    uint256 private constant _MAX_SIPPIAGE = 5;

    // Mapping for storing pair information and user shares
    mapping(address => UserInfo) public userInfo;
    mapping(address => LockDetails[]) public locks;
    mapping(uint256 => address) public nftOwnership;

    // Immutable variables for storing token and pair information
    IERC20Metadata public tokenX;
    IERC20Metadata public tokenY;
    IUniswapV3Pool public pool;
    uint24 public feeTier;
    uint256 public constant MAX_LOCK_TIME = 3 * 365 days;

    /**
    * @dev Constructor of the contract.
    * @param tokenX_ The address of the token X.
    * @param tokenY_ The address of the token Y.
    * @param name_ The name of the SPrime token. ex: PRIME-USDC LP
    * @param feeTier_ Fee Tier of Uniswap V3 Pool
    */
    function initialize(address tokenX_, address tokenY_, string memory name_, uint24 feeTier_) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC20_init(name_, "sPrime");
        __ERC721Holder_init();

        (tokenX_, tokenY_) = tokenX_ < tokenY_ ? (tokenX_, tokenY_) : (tokenY_, tokenX_);

        tokenX = IERC20Metadata(tokenX_);
        tokenY = IERC20Metadata(tokenY_);
        feeTier = feeTier_;

        address poolAddress = IUniswapV3Factory(getUniV3FactoryAddress()).getPool(tokenX_, tokenY_, feeTier_);
        
        pool = IUniswapV3Pool(poolAddress);
    }

    /**
     * @dev Returns the address of the Uniswap V3 Factory.
     * @return The address of the Uniswap V3 Factory.
     */
    function getUniV3FactoryAddress() public view virtual returns (address){
        return 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    }

    function getNonfungiblePositionManagerAddress() public view virtual returns (address){
        return 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    }

    function getSwapRouter() public view virtual returns (address){
        return 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    }

    /**
    * @dev Returns the ratio of fully vested locked balance to non-vested balance for an account.
    * @param account The address of the account.
    * @return The ratio of fully vested locked balance to total balance
    */
    function getFullyVestedLockedBalanceToNonVestedRatio(address account) public view returns (uint256) {
        uint256 totalBalance = balanceOf(account);
        uint256 fullyVestedBalance = 0;
        for (uint i = 0; i < locks[account].length; i++) {
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
        (,int24 tick,,,,,) = pool.slot0();
        amountY = OracleLibrary.getQuoteAtTick(tick, uint128(amountX), address(tokenX), address(tokenY));
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

    function deposit(uint256 amountX, uint256 amountY, int24 tickLower, int24 tickUpper) public {
        _transferTokens(_msgSender(), address(this), amountX, amountY);

        address positionManager = getNonfungiblePositionManagerAddress();
        tokenX.safeApprove(positionManager, amountX);
        tokenY.safeApprove(positionManager, amountY);
        
        if(userInfo[_msgSender()].amount > 0) {
            (uint256 amountXBefore, uint256 amountYBefore) = _withdrawAndUpdateShare(_msgSender());
            (amountX, amountY) = (amountX + amountXBefore, amountY + amountYBefore);
        }

        (amountX, amountY) = _getUpdatedAmounts(amountX, amountY);

        (uint256 tokenId, uint128 lpAmount,,) = INonfungiblePositionManager(positionManager).mint(
            INonfungiblePositionManager.MintParams({
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
            })
        );

        _updateUserInfo(_msgSender(), lpAmount, tokenId, Status.ADD);
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

    function _updateUserInfo(address user, uint128 lpAmount, uint256 tokenId, Status status) internal {
        if(status == Status.ADD) {
            _mint(user, lpAmount);
            LiquidityInfo memory newInfo = LiquidityInfo(tokenId, lpAmount, lpAmount);
            userInfo[user].liquidityInfo.push(newInfo);
            userInfo[user].amount++;
            nftOwnership[tokenId] = user;
        } else {
            // Withdraw all the tokens from the LB pool and return the amounts and the queued withdrawals.
            _burn(user, lpAmount);

            uint256 length = userInfo[user].amount;
            for(uint256 i = 0 ; i < length - 1; i ++) {
                if(userInfo[user].liquidityInfo[i].tokenId == tokenId) {
                    userInfo[user].liquidityInfo[i] = userInfo[user].liquidityInfo[length - 1];
                }
            }
            userInfo[user].liquidityInfo.pop();
            userInfo[user].amount--;
            delete nftOwnership[tokenId];
        }
    }

    /**
    * @dev Returns the updated amounts of tokens.
    * @return amountX The updated amount of token X.
    * @return amountY The updated amount of token Y.
    */
    function _getUpdatedAmounts(uint256 amountX, uint256 amountY) internal returns(uint256, uint256) {
        uint256 amountXToY = _getTokenYFromTokenX(amountX);
        if(amountXToY != 0) {
            bool swapTokenX = amountY < amountXToY;
            uint256 diff = swapTokenX ? amountXToY - amountY : amountY - amountXToY;

            if(amountY * _MAX_SIPPIAGE / 100 < diff) {
                uint256 amountIn = swapTokenX ? amountX * diff / amountXToY / 2 : diff / 2;
                address swapRouter = getSwapRouter();
                address tokenIn;
                address tokenOut;

                if (swapTokenX) {
                    tokenIn = address(tokenX);
                    tokenOut = address(tokenY);
                    tokenX.safeApprove(swapRouter, amountIn);
                } else {
                    tokenIn = address(tokenY);
                    tokenOut = address(tokenX);
                    tokenX.safeApprove(swapRouter, amountIn);
                }

                uint256 amountOut = ISwapRouter(swapRouter).exactInputSingle(
                  ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: feeTier,
                    recipient: address(this),
                    deadline: block.timestamp + 100,
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                  })
                );

                (amountX, amountY) = swapTokenX ? (amountX - amountIn, amountY + amountOut) : (amountX + amountOut, amountY - amountIn);
            }
        }
        return (amountX, amountY);
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
        address positionManager = getNonfungiblePositionManagerAddress();
        for(uint256 i = 0 ; i < userAmount ; i ++) {
            LiquidityInfo memory info = userInfo[user].liquidityInfo[i];
            (uint256 balanceX, uint256 balanceY) = INonfungiblePositionManager(positionManager).decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: info.tokenId, 
                    liquidity: info.lpAmount,
                    amount0Min:0, 
                    amount1Min:0, 
                    deadline:block.timestamp
                })
            );

            totalBalanceX += balanceX;
            totalBalanceY += balanceY;
            totalShare += info.share;
            delete nftOwnership[info.tokenId];
        }
        
        delete userInfo[user];

        _burn(_msgSender(), totalShare);
    }

    function withdraw() external {
        require(userInfo[_msgSender()].amount > 0, "No position to withdraw");

        (uint256 amountX, uint256 amountY) = _withdrawAndUpdateShare(_msgSender());

        // Send the tokens to the user.
        _transferTokens(address(this), _msgSender(), amountX, amountY);
    }
}
