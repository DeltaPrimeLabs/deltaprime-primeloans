pragma solidity ^0.8.17;
import "../../gmx-v2/EventUtils.sol";
import "../../gmx-v2/Deposit.sol";
import "../../gmx-v2/Withdrawal.sol";

interface IGmxV2AvalancheFacet {
    function depositAvaxUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable;

    function withdrawAvaxUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable;
}
