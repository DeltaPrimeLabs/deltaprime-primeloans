pragma solidity ^0.8.17;

interface ISolvencyFacet {
    function getDebt() external view returns (uint256);

    function getFullLoanStatus() external returns (uint256[4] memory);

    function getLTV() external view returns (uint256);

    function getMaxBlockTimestampDelay() external view returns (uint256);

    function getMaxDataTimestampDelay() external view returns (uint256);

    function getTotalValue() external view returns (uint256);

    function isSignerAuthorized(address _receivedSigner) external view returns (bool);

    function isSolvent() external view returns (bool);

    function isTimestampValid(uint256 _receivedTimestamp) external view returns (bool);
}
