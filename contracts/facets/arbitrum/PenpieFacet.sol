// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 65215bd8e6b18ad26f6667044ffbd8b2dd19ab9d;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/arbitrum/IPendleRouter.sol";
import "../../interfaces/arbitrum/IPendleDepositHelper.sol";
import "../../interfaces/arbitrum/IMasterPenpie.sol";
import "../../OnlyOwnerOrInsolvent.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract PenpieFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // CONSTANTS

    address private constant PENDLE_ROUTER =
        0x888888888889758F76e7103c6CbF23ABbF58F946;
    address public constant DEPOSIT_HELPER =
        0xc06a5d3014b9124Bf215287980305Af2f793eB30;
    address public constant PENDLE_STAKING =
        0x6DB96BBEB081d2a85E0954C252f2c1dC108b3f81;
    address public constant MASTER_PENPIE =
        0x0776C06907CE6Ff3d9Dbf84bA9B3422d7225942D;
    address public constant PNP = 0x2Ac2B254Bc18cD4999f64773a966E4f4869c34Ee;
    address public constant PENDLE = 0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8;
    address public constant SILO = 0x0341C0C0ec423328621788d4854119B97f44E391;

    address public constant PENDLE_EZ_ETH_MARKET =
        0x5E03C94Fc5Fb2E21882000A96Df0b63d2c4312e2;
    address public constant PENDLE_WST_ETH_MARKET =
        0xFd8AeE8FCC10aac1897F8D5271d112810C79e022;
    address public constant PENDLE_E_ETH_MARKET =
        0x952083cde7aaa11AB8449057F7de23A970AA8472;
    address public constant PENDLE_RS_ETH_MARKET =
        0x6Ae79089b2CF4be441480801bb741A531d94312b;
    address public constant PENDLE_WST_ETH_SILO_MARKET =
        0xACcd9A7cb5518326BeD715f90bD32CDf2fEc2D14;

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

            {
                address owner = DiamondStorageLib.contractOwner();
                IPendleDepositHelper(DEPOSIT_HELPER).withdrawMarketWithClaim(
                    market,
                    amount,
                    true
                );

                uint256 pnpBalance = IERC20(PNP).balanceOf(address(this));
                uint256 pendleBalance = IERC20(PENDLE).balanceOf(address(this));
                uint256 siloBalance = IERC20(SILO).balanceOf(address(this));

                if (pnpBalance > 0) {
                    PNP.safeTransfer(owner, pnpBalance);
                }
                if (pendleBalance > 0) {
                    PENDLE.safeTransfer(owner, pendleBalance);
                }
                if (siloBalance > 0) {
                    SILO.safeTransfer(owner, siloBalance);
                }
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

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function depositPendleLPAndStakeInPenpie(
        address market,
        uint256 amount
    ) external onlyOwner nonReentrant remainsSolvent {
        address lpToken = _getPendleLpToken(market);

        market.safeTransferFrom(msg.sender, address(this), amount);

        market.safeApprove(PENDLE_STAKING, 0);
        market.safeApprove(PENDLE_STAKING, amount);

        IPendleDepositHelper(DEPOSIT_HELPER).depositMarket(market, amount);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        _increaseExposure(tokenManager, lpToken, amount);

        emit PendleLpStaked(msg.sender, lpToken, amount, block.timestamp);
    }

    /**
     * @dev This function uses the redstone-evm-connector
     **/
    function unstakeFromPenpieAndWithdrawPendleLP(
        address market,
        uint256 amount
    ) external onlyOwner canRepayDebtFully nonReentrant remainsSolvent returns (uint256) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address lpToken = _getPendleLpToken(market);

        amount = Math.min(IERC20(lpToken).balanceOf(address(this)), amount);
        require(amount > 0, "Cannot unstake 0 tokens");

        uint256 beforePendleBalance = IERC20(PENDLE).balanceOf(address(this));

        IPendleDepositHelper(DEPOSIT_HELPER).withdrawMarketWithClaim(
            market,
            amount,
            true
        );

        uint256 pendleClaimed = IERC20(PENDLE).balanceOf(address(this)) - beforePendleBalance;
        if (pendleClaimed > 0) {
            PENDLE.safeTransfer(msg.sender, pendleClaimed);
        }

        market.safeTransfer(msg.sender, amount);

        uint256 pnpReceived = IERC20(PNP).balanceOf(address(this));
        if (pnpReceived > 0) {
            PNP.safeTransfer(msg.sender, pnpReceived);
        }

        _decreaseExposure(tokenManager, lpToken, amount);

        emit PendleLpUnstaked(msg.sender, lpToken, amount, block.timestamp);

        return amount;
    }

    function pendingRewards(
        address market
    ) public view returns (uint256, address[] memory, uint256[] memory) {
        (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            ,
            uint256[] memory pendingBonusRewards
        ) = IMasterPenpie(MASTER_PENPIE).allPendingTokens(market, address(this));
        return (pendingPenpie, bonusTokenAddresses, pendingBonusRewards);
    }

    function claimRewards(address market) external onlyOwner {
        (
            uint256 pendingPenpie,
            address[] memory bonusTokenAddresses,
            uint256[] memory pendingBonusRewards
        ) = pendingRewards(market);
        address[] memory stakingTokens = new address[](1);
        stakingTokens[0] = market;
        IMasterPenpie(MASTER_PENPIE).multiclaim(stakingTokens);

        if (pendingPenpie > 0) {
            PNP.safeTransfer(msg.sender, pendingPenpie);
        }
        uint256 length = pendingBonusRewards.length;
        for (uint256 i; i != length; ++i) {
            if (pendingBonusRewards[i] > 0) {
                bonusTokenAddresses[i].safeTransfer(msg.sender, pendingBonusRewards[i]);
            }
        }
    }

    // INTERNAL FUNCTIONS
    function _getPendleLpToken(address market) internal pure returns (address) {
        // ezETH
        if (market == PENDLE_EZ_ETH_MARKET) {
            return 0xecCDC2C2191d5148905229c5226375124934b63b;
        }
        // wstETH
        if (market == PENDLE_WST_ETH_MARKET) {
            return 0xdb0e1D1872202A81Eb0cb655137f4a937873E02f;
        }
        // eETH
        if (market == PENDLE_E_ETH_MARKET) {
            return 0x264f4138161aaE16b76dEc7D4eEb756f25Fa67Cd;
        }
        // rsETH
        if (market == PENDLE_RS_ETH_MARKET) {
            return 0xe3B327c43b5002eb7280Eef52823698b6cDA06cF;
        }
        // wstETHSilo
        if (market == PENDLE_WST_ETH_SILO_MARKET) {
            return 0xCcCC7c80c9Be9fDf22e322A5fdbfD2ef6ac5D574;
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

    /**
     * @dev emitted when user stakes an asset
     * @param user the address executing staking
     * @param vault address of receipt token
     * @param amount how much of deposit token was staked
     * @param timestamp of staking
     **/
    event PendleLpStaked(
        address indexed user,
        address indexed vault,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev emitted when user unstakes an asset
     * @param user the address executing unstaking
     * @param vault address of receipt token
     * @param amount how much deposit token was received
     * @param timestamp of unstaking
     **/
    event PendleLpUnstaked(
        address indexed user,
        address indexed vault,
        uint256 amount,
        uint256 timestamp
    );
}
