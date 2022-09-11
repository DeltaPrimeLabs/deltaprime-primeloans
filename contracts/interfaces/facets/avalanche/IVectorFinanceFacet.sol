interface IYieldYakFacet {
    function vectorStakeUSDC1(uint256 amount) external;

    function vectorStakeUSDC2(uint256 amount) external;

    function vectorStakeWAVAX1(uint256 amount) external;

    function vectorStakeSAVAX1(uint256 amount) external;

    function vectorUnstakeUSDC1(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeUSDC2(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeWAVAX1(uint256 amount, uint256 minAmount) external;

    function vectorUnstakeSAVAX1(uint256 amount, uint256 minAmount) external;
}
