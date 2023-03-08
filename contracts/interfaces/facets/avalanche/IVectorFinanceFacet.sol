pragma solidity ^0.8.17;

interface IVectorFinanceFacet {
    function vectorStakeUSDC1Auto(uint256 amount) external;

    function vectorStakeWAVAX1Auto(uint256 amount) external;

    function vectorStakeSAVAX1Auto(uint256 amount) external;

    function vectorUnstakeUSDC1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeWAVAX1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeSAVAX1Auto(uint256 amount, uint256 minAmount) external;

    function vectorUSDC1BalanceAuto() external view returns(uint256);

    function vectorWAVAX1BalanceAuto() external view returns(uint256);

    function vectorSAVAX1BalanceAuto() external view returns(uint256);

    function vectorMigrateAvax() external;

    function vectorMigrateSAvax() external;
}
