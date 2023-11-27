pragma solidity ^0.8.17;
import "../../gmx-v2/EventUtils.sol";
import "../../gmx-v2/Deposit.sol";
import "../../gmx-v2/Withdrawal.sol";

interface IGmxV2ArbitrumFacet {
    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;

    function depositArbUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawArbUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;

    function depositBtcUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawBtcUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;

    function depositUniUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawUniUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;

    function depositLinkUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawLinkUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external;

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external;

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external;

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external;
}
