pragma solidity ^0.8.17;

import "../../arbitrum/IPendleRouter.sol";

interface IPenpieFacet {
    function depositToPendleAndStakeInPenpie(
        address market,
        uint256 amount,
        uint256 minLpOut,
        IPendleRouter.ApproxParams memory guessPtReceivedFromSy,
        IPendleRouter.TokenInput memory input,
        IPendleRouter.LimitOrderData memory limit
    ) external;

    function unstakeFromPenpieAndWithdrawFromPendle(
        address market,
        uint256 amount,
        uint256 minOut,
        IPendleRouter.TokenOutput memory output,
        IPendleRouter.LimitOrderData memory limit
    ) external returns (uint256);

    function depositPendleLPAndStakeInPenpie(
        address market,
        uint256 amount
    ) external;

    function unstakeFromPenpieAndWithdrawPendleLP(
        address market,
        uint256 amount
    ) external;

    function pendingRewards(
        address market
    ) external view returns (uint256, address[] memory, uint256[] memory);

    function claimRewards(address market) external;

    function underlyingBalanceForEzEthMarket() external view returns (uint256);

    function underlyingBalanceForWstEthMarket() external view returns (uint256);

    function underlyingBalanceForEEthMarket() external view returns (uint256);

    function underlyingBalanceForRsEthMarket() external view returns (uint256);

    function underlyingBalanceForWstEthSiloMarket()
        external
        view
        returns (uint256);
}
