// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/facets/avalanche/IYieldYakRouter.sol";
import "./Pool.sol";

contract DepositSwap {
    using SafeERC20 for IERC20;

    address public constant WAVAX_POOL_TUP = 0xD26E504fc642B96751fD55D3E68AF295806542f5;
    address public constant USDC_POOL_TUP = 0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b;
    address public constant USDT_POOL_TUP = 0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1;
    address public constant ETH_POOL_TUP = 0xD7fEB276ba254cD9b34804A986CE9a8C3E359148;
    address public constant BTC_POOL_TUP = 0x475589b0Ed87591A893Df42EC6076d2499bB63d0;

    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant WETH = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address public constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address public constant USDT = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;
    address public constant BTC = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;

    address private constant YY_ROUTER = 0xC4729E56b831d74bBc18797e0e17A295fA77488c;

    function _isTokenSupported(address token) private pure returns (bool) {
        if(
            token == WAVAX ||
            token == WETH ||
            token == USDC ||
            token == USDT ||
            token == BTC
        ){
            return true;
        }
        return false;
    }

    function _tokenToPoolTUPMapping(address token) private pure returns (Pool){
        if(token == WAVAX){
            return Pool(WAVAX_POOL_TUP);
        } else if (token == WETH){
            return Pool(ETH_POOL_TUP);
        } else if (token == USDC){
            return Pool(USDC_POOL_TUP);
        } else if (token == USDT){
            return Pool(USDT_POOL_TUP);
        } else if (token == BTC){
            return Pool(BTC_POOL_TUP);
        }
        revert("Pool not supported");
    }

    function _withdrawFromPool(Pool pool, IERC20 token, uint256 amount, address user) private {
        uint256 userInitialFromTokenDepositBalance = pool.balanceOf(user);
        uint256 poolInitialBalance = pool.balanceOf(address(this));

        require(userInitialFromTokenDepositBalance >= amount, "Insufficient fromToken deposit balance");

        pool.transferFrom(user, address(this), amount);
        require(pool.balanceOf(address(this)) - poolInitialBalance == amount, "amountFromToken and post-transfer contract balance mismatch");
        require(pool.balanceOf(user) == userInitialFromTokenDepositBalance - amount, "user post-transfer balance is incorrect");

        uint256 poolInitialTokenBalance = token.balanceOf(address(this));

        pool.withdraw(amount);

        require(pool.balanceOf(address(this)) == poolInitialBalance, "Post-withdrawal contract deposit balance must be 0");
        require(token.balanceOf(address(this)) == poolInitialTokenBalance + amount, "Post-withdrawal contract fromToken balance is incorrect");
    }

    function _depositToPool(Pool pool, IERC20 token, uint256 amount, address user) private {
        uint256 contractInitialToTokenBalance = token.balanceOf(address(this));
        uint256 userInitialToTokenDepositBalance = pool.balanceOf(user);
        uint256 poolInitialBalance = pool.balanceOf(address(this));

        require(contractInitialToTokenBalance >= amount, "Insufficient contract toToken balance");

        token.safeApprove(address(pool), 0);
        token.safeApprove(address(pool), amount);
        pool.deposit(amount);

        require(token.balanceOf(address(this)) == contractInitialToTokenBalance - amount, "Post-deposit contract toToken balance must be 0");
        require(pool.balanceOf(address(this)) == poolInitialBalance + amount, "Post-deposit contract deposit balance is incorrect");

        pool.transfer(user, amount);

        require(token.balanceOf(address(this)) == contractInitialToTokenBalance - amount, "Post-transfer contract deposit balance must be 0");
        require(pool.balanceOf(user) == userInitialToTokenDepositBalance + amount, "Post-transfer user deposit balance is incorrect");
    }

    function _yakSwap(address[] calldata path, address[] calldata adapters, uint256 amountIn, uint256 amountOut) private {
        IERC20(path[0]).safeApprove(YY_ROUTER, 0);
        IERC20(path[0]).safeApprove(YY_ROUTER, amountIn);

        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER);


        IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
            amountIn: amountIn,
            amountOut: amountOut,
            path: path,
            adapters: adapters
        });

        router.swapNoSplit(trade, address(this), 0);
    }


    // Needs approval on the fromToken Pool
    function depositSwap(uint256 amountFromToken, uint256 minAmountToToken, address[] calldata path, address[] calldata adapters) public {
        address fromToken = path[0];
        address toToken = path[path.length - 1];

        require(_isTokenSupported(fromToken), "fromToken not supported");
        require(_isTokenSupported(toToken), "toToken not supported");

        Pool fromPool = _tokenToPoolTUPMapping(fromToken);
        Pool toPool = _tokenToPoolTUPMapping(toToken);

        address user = msg.sender;
        amountFromToken = Math.min(fromPool.balanceOf(user), amountFromToken);

        _withdrawFromPool(fromPool, IERC20(fromToken), amountFromToken, user);

        _yakSwap(path, adapters, amountFromToken, minAmountToToken);

        _depositToPool(toPool, IERC20(toToken), IERC20(toToken).balanceOf(address(this)), user);
    }
}
