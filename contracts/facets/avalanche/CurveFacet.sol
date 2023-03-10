// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/ICurvePool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract CurveFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    // Used to deposit/withdraw tokens
    address private constant CURVE_POOL_ADDRESS = 0x58e57cA18B7A47112b877E31929798Cd3D703b0f;
    // crvUSDBTCETH
    address private constant CURVE_TOKEN_ADDRESS = 0x1daB6560494B04473A0BE3E7D83CF3Fdf3a51828;
    // crvUSDBTCETH
    bytes32 private constant CURVE_TOKEN_SYMBOL = "crvUSDBTCETH";

    // Tokens
    address private constant DAIe_TOKEN = 0xd586E7F844cEa2F87f50152665BCbc2C279D8d70;
    address private constant USDCe_TOKEN = 0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664;
    address private constant USDTe_TOKEN = 0xc7198437980c041c805A1EDcbA50c1Ce5db95118;
    address private constant WBTCe_TOKEN = 0x50b7545627a5162F82A992c33b87aDc75187B218;
    address private constant ETH_TOKEN = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;

    /**
     * Stakes DAI.e in Curve atricrypto pool
     * @param amount amount of DAI.e to be staked
     **/
    function stakeDAICurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 0,
            tokenAddress: DAIe_TOKEN,
            tokenSymbol: "DAIe",
            amount: amount
        }));
    }

    /**
     * Unstakes DAI.e from Curve atricrypto pool
     * @param amount amount of DAI.e to be unstaked
     **/
    function unstakeDAICurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 0,
            tokenAddress: DAIe_TOKEN,
            tokenSymbol: "DAIe",
            amount: amount
        }));
    }

    /**
     * Stakes USDC.e in Curve atricrypto pool
     * @param amount amount of USDC.e to be staked
     **/
    function stakeUSDCCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 1,
            tokenAddress: USDCe_TOKEN,
            tokenSymbol: "USDCe",
            amount: amount
        }));
    }

    /**
     * Unstakes USDC.e from Curve atricrypto pool
     * @param amount amount of USDC.e to be unstaked
     **/
    function unstakeUSDCCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 1,
            tokenAddress: USDCe_TOKEN,
            tokenSymbol: "USDCe",
            amount: amount
        }));
    }

    /**
     * Stakes USDT.e in Curve atricrypto pool
     * @param amount amount of USDT.e to be staked
     **/
    function stakeUSDTCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 2,
            tokenAddress: USDTe_TOKEN,
            tokenSymbol: "USDTe",
            amount: amount
        }));
    }

    /**
     * Unstakes USDT.e from Curve atricrypto pool
     * @param amount amount of USDT.e to be unstaked
     **/
    function unstakeUSDTCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 2,
            tokenAddress: USDTe_TOKEN,
            tokenSymbol: "USDTe",
            amount: amount
        }));
    }

    /**
     * Stakes WBTC.e in Curve atricrypto pool
     * @param amount amount of WBTC.e to be staked
     **/
    function stakeWBTCCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 3,
            tokenAddress: WBTCe_TOKEN,
            tokenSymbol: "WBTCe",
            amount: amount
        }));
    }

    /**
     * Unstakes WBTC.e from Curve atricrypto pool
     * @param amount amount of WBTC.e to be unstaked
     **/
    function unstakeWBTCCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 3,
            tokenAddress: WBTCe_TOKEN,
            tokenSymbol: "WBTCe",
            amount: amount
        }));
    }

    /**
     * Stakes WETH.e in Curve atricrypto pool
     * @param amount amount of WETH.e to be staked
     **/
    function stakeETHCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 4,
            tokenAddress: ETH_TOKEN,
            tokenSymbol: "ETH",
            amount: amount
        }));
    }

    /**
     * Unstakes WETH.e from Curve atricrypto pool
     * @param amount amount of WETH.e to be unstaked
     **/
    function unstakeETHCurve(uint256 amount) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenCurve(ICurvePool.CurveStakingDetails({
            tokenIndex: 4,
            tokenAddress: ETH_TOKEN,
            tokenSymbol: "ETH",
            amount: amount
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {stakingDetails.tokenAddress} token in the Curve atricrypto pool
     * @param stakingDetails ICurvePool.CurveStakingDetails staking details
     **/
    function _stakeTokenCurve(ICurvePool.CurveStakingDetails memory stakingDetails) private recalculateAssetsExposure {
        IERC20Metadata curveToken = IERC20Metadata(CURVE_TOKEN_ADDRESS);
        uint256 initialCurveBalance = curveToken.balanceOf(address(this));

        stakingDetails.amount = Math.min(IERC20Metadata(stakingDetails.tokenAddress).balanceOf(address(this)), stakingDetails.amount);
        require(stakingDetails.amount > 0, "Cannot stake 0 tokens");

        IERC20Metadata(stakingDetails.tokenAddress).approve(CURVE_POOL_ADDRESS, stakingDetails.amount);
        uint256[5] memory amounts;
        amounts[stakingDetails.tokenIndex] = stakingDetails.amount;
        ICurvePool(CURVE_POOL_ADDRESS).add_liquidity(amounts, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(CURVE_TOKEN_SYMBOL, CURVE_TOKEN_ADDRESS);
        if(IERC20(stakingDetails.tokenAddress).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.tokenSymbol);
        }

        emit Staked(
            msg.sender,
            stakingDetails.tokenSymbol,
            CURVE_TOKEN_ADDRESS,
            stakingDetails.amount,
            curveToken.balanceOf(address(this)) - initialCurveBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes {stakingDetails.tokenAddress} token in the Curve atricrypto pool
     * @param stakingDetails ICurvePool.CurveStakingDetails staking details
     **/
    function _unstakeTokenCurve(ICurvePool.CurveStakingDetails memory stakingDetails) private recalculateAssetsExposure {
        ICurvePool pool = ICurvePool(CURVE_POOL_ADDRESS);
        IERC20Metadata curveToken = IERC20Metadata(CURVE_TOKEN_ADDRESS);
        IERC20Metadata depositToken = IERC20Metadata(stakingDetails.tokenAddress);
        uint256 initialDepositTokenBalance = depositToken.balanceOf(address(this));
        uint256 curveTokenBalance = curveToken.balanceOf(address(this));
        uint256 maxWithdrawAmount = pool.calc_withdraw_one_coin(curveTokenBalance, stakingDetails.tokenIndex);
        stakingDetails.amount = Math.min(maxWithdrawAmount, stakingDetails.amount);

        uint256 burnAmount = curveTokenBalance * stakingDetails.amount / maxWithdrawAmount;
        curveToken.approve(CURVE_POOL_ADDRESS, burnAmount);
        pool.remove_liquidity_one_coin(burnAmount, stakingDetails.tokenIndex, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(stakingDetails.tokenSymbol, stakingDetails.tokenAddress);
        uint256 newCurveTokenBalance = curveToken.balanceOf(address(this));
        if(newCurveTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(CURVE_TOKEN_SYMBOL);
        }

        emit Unstaked(
            msg.sender,
            stakingDetails.tokenSymbol,
            CURVE_TOKEN_ADDRESS,
            depositToken.balanceOf(address(this)) - initialDepositTokenBalance,
            curveTokenBalance - newCurveTokenBalance,
            block.timestamp
        );
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of the vault token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset the asset that was unstaked
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}
