// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/arbitrum/IPendleRouter.sol";
import "../../interfaces/arbitrum/IPendleDepositHelper.sol";
import "../../OnlyOwnerOrInsolvent.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract PenpieFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // CONSTANTS

    address private constant PENDLE_ROUTER =
        0x00000000005BBB0EF59571E58418F9a4357b68A0;
    address public constant DEPOSIT_HELPER =
        0xc06a5d3014b9124Bf215287980305Af2f793eB30;
    address public constant PENDLE_STAKING =
        0x6DB96BBEB081d2a85E0954C252f2c1dC108b3f81;
    address public constant PNP = 0x2Ac2B254Bc18cD4999f64773a966E4f4869c34Ee;

    // PUBLIC FUNCTIONS

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function depositToPendleAndStakeInPenpie(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minLpOut,
        IPendleRouter.ApproxParams memory guessPtReceivedFromSy,
        IPendleRouter.TokenInput memory input,
        IPendleRouter.LimitOrderData memory limit
    ) external onlyOwner nonReentrant remainsSolvent {
        address lpToken = _getPendleLpToken(market);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        IERC20 token = IERC20(tokenManager.getAssetAddress(asset, false));

        amount = Math.min(token.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot stake 0 tokens");

        address(token).safeApprove(PENDLE_ROUTER, 0);
        address(token).safeApprove(PENDLE_ROUTER, amount);

        (uint256 netLpOut, , ) = IPendleRouter(PENDLE_ROUTER)
            .addLiquiditySingleToken(
                address(this),
                market,
                minLpOut,
                guessPtReceivedFromSy,
                input,
                limit
            );
        require(netLpOut >= minLpOut, "Too little received");

        market.safeApprove(PENDLE_STAKING, 0);
        market.safeApprove(PENDLE_STAKING, netLpOut);

        IPendleDepositHelper(DEPOSIT_HELPER).depositMarket(market, netLpOut);

        _increaseExposure(tokenManager, lpToken, netLpOut);
        _decreaseExposure(tokenManager, address(token), amount);

        emit Staked(msg.sender, asset, lpToken, amount, netLpOut, block.timestamp);
    }

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function unstakeFromPenpieAndWithdrawFromPendle(
        bytes32 asset,
        uint256 amount,
        address market,
        uint256 minOut,
        IPendleRouter.TokenOutput memory output,
        IPendleRouter.LimitOrderData memory limit
    ) external onlyOwnerOrInsolvent nonReentrant returns (uint256) {
        address lpToken = _getPendleLpToken(market);
        uint256 netTokenOut;

        {
            amount = Math.min(IERC20(lpToken).balanceOf(address(this)), amount);
            require(amount > 0, "Cannot unstake 0 tokens");

            uint256 pnpReceived;
            {
                uint256 beforePnpBalance = IERC20(PNP).balanceOf(address(this));

                IPendleDepositHelper(DEPOSIT_HELPER).withdrawMarketWithClaim(
                    market,
                    amount,
                    true
                );

                pnpReceived = IERC20(PNP).balanceOf(address(this)) - beforePnpBalance;
            }

            market.safeApprove(PENDLE_ROUTER, 0);
            market.safeApprove(PENDLE_ROUTER, amount);

            (netTokenOut, , ) = IPendleRouter(PENDLE_ROUTER)
                .removeLiquiditySingleToken(
                    address(this),
                    market,
                    amount,
                    output,
                    limit
                );
            require(netTokenOut >= minOut, "Too little received");

            ITokenManager tokenManager = DeploymentConstants.getTokenManager();
            address token = tokenManager.getAssetAddress(asset, false);

            _increaseExposure(tokenManager, token, netTokenOut);
            _decreaseExposure(tokenManager, lpToken, amount);
            if (pnpReceived > 0) {
                _increaseExposure(tokenManager, PNP, pnpReceived);
            }
        }

        emit Unstaked(
            msg.sender,
            asset,
            lpToken,
            netTokenOut,
            amount,
            block.timestamp
        );

        return netTokenOut;
    }

    // INTERNAL FUNCTIONS
    function _getPendleLpToken(address market) internal pure returns (address) {
        // ezETH
        if (market == 0x60712e3C9136CF411C561b4E948d4d26637561e7) {
            return 0xF5250766B344568F8b4d783b7cBBC6415E93dD4d;
        }
        // wstETH
        if (market == 0x08a152834de126d2ef83D612ff36e4523FD0017F) {
            return 0x4d2Faa48Ef93Cc3c8A7Ec27F3Cb91cEB1a36F89B;
        }
        // eETH
        if (market == 0xE11f9786B06438456b044B3E21712228ADcAA0D1) {
            return 0x11625278c86f87F1d6bE5D911411AD22F00A77ef;
        }
        // rsETH
        if (market == 0x6F02C88650837C8dfe89F66723c4743E9cF833cd) {
            return 0xeC9224319c5d7A36A3DF68485a1F37F1BdC10635;
        }
        // wstETHSilo
        if (market == 0xACcd9A7cb5518326BeD715f90bD32CDf2fEc2D14) {
            return 0xCcCC7c80c9Be9fDf22e322A5fdbfD2ef6ac5D574;
        }
        // PT-eETHSilo
        if (market == 0x99e9028e274FEAFA2E1D8787E1eE6DE39C6F7724) {
            return 0x0B28a5c88cd5F0cdE1956A1D878A9E371Ad9775f;
        }

        revert("Invalid market address");
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
     * @dev emitted when user stakes an asset
     * @param user the address executing staking
     * @param asset the asset that was staked
     * @param vault address of receipt token
     * @param depositTokenAmount how much of deposit token was staked
     * @param receiptTokenAmount how much of receipt token was received
     * @param timestamp of staking
     **/
    event Staked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user unstakes an asset
     * @param user the address executing unstaking
     * @param asset the asset that was unstaked
     * @param vault address of receipt token
     * @param depositTokenAmount how much deposit token was received
     * @param receiptTokenAmount how much receipt token was unstaked
     * @param timestamp of unstaking
     **/
    event Unstaked(
        address indexed user,
        bytes32 indexed asset,
        address indexed vault,
        uint256 depositTokenAmount,
        uint256 receiptTokenAmount,
        uint256 timestamp
    );
}
