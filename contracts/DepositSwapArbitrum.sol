// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ee0af55f3f6aca2421d7436d9db1fb46ee9486cb;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/facets/IYieldYakRouter.sol";
import "./Pool.sol";

contract DepositSwapArbitrum {
    using SafeERC20 for IERC20;

    address public constant WETH_POOL_TUP = 0x0BeBEB5679115f143772CfD97359BBcc393d46b3;
    address public constant USDC_POOL_TUP = 0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0;
    address public constant ARB_POOL_TUP = 0x2B8C610F3fC6F883817637d15514293565C3d08A;
    address public constant BTC_POOL_TUP = 0x5CdE36c23f0909960BA4D6E8713257C6191f8C35;
    address public constant DAI_POOL_TUP = 0xd5E8f691756c3d7b86FD8A89A06497D38D362540;

    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address public constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address public constant BTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    function _isTokenSupported(address token) private pure returns (bool) {
        if(
            token == WETH ||
            token == USDC ||
            token == BTC ||
            token == DAI ||
            token == ARB
        ){
            return true;
        }
        return false;
    }

    function _tokenToPoolTUPMapping(address token) private pure returns (Pool){
        if(token == WETH){
            return Pool(WETH_POOL_TUP);
        } else if (token == USDC){
            return Pool(USDC_POOL_TUP);
        } else if (token == ARB){
            return Pool(ARB_POOL_TUP);
        } else if (token == BTC){
            return Pool(BTC_POOL_TUP);
        } else if (token == DAI){
            return Pool(DAI_POOL_TUP);
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
        IERC20(path[0]).safeApprove(YY_ROUTER(), 0);
        IERC20(path[0]).safeApprove(YY_ROUTER(), amountIn);

        IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());


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

    function depositSwapParaSwap(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 minOut
    ) public {
        require(_isTokenSupported(fromToken), "fromToken not supported");
        require(_isTokenSupported(toToken), "toToken not supported");

        require(minOut > 0, "minOut needs to be > 0");
        require(fromAmount > 0, "Amount of tokens to sell needs to be > 0");

        Pool fromPool = _tokenToPoolTUPMapping(fromToken);
        Pool toPool = _tokenToPoolTUPMapping(toToken);

        address user = msg.sender;
        fromAmount = Math.min(fromPool.balanceOf(user), fromAmount);

        _withdrawFromPool(fromPool, IERC20(fromToken), fromAmount, user);

        IERC20(fromToken).safeApprove(PARA_TRANSFER_PROXY, 0);
        IERC20(fromToken).safeApprove(
            PARA_TRANSFER_PROXY,
            fromAmount
        );

        (bool success, ) = PARA_ROUTER.call((abi.encodePacked(selector, data)));
        require(success, "Swap failed");

        uint256 amountOut = IERC20(toToken).balanceOf(address(this));
        require(amountOut >= minOut, "Too little received");

        _depositToPool(toPool, IERC20(toToken), amountOut, user);
    }

    function YY_ROUTER() internal virtual pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
