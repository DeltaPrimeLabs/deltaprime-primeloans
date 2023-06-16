pragma solidity ^0.8.17;

interface ICurveFacet {
    function curveStakeTokens(uint256[5] memory amounts) external;

    function curveStakeDAI(uint256 amount) external;

    function curveStakeUSDC(uint256 amount) external;

    function curveStakeUSDT(uint256 amount) external;

    function curveStakeBTC(uint256 amount) external;

    function curveStakeETH(uint256 amount) external;

    function curveUnstakeTokens(uint256 amount, uint256[5] memory min_amounts) external;

    function curveUnstakeDAI(uint256 amount, uint256 minAmount) external returns (uint256);

    function curveUnstakeUSDC(uint256 amount, uint256 minAmount) external returns (uint256);

    function curveUnstakeUSDT(uint256 amount, uint256 minAmount) external returns (uint256);

    function curveUnstakeBTC(uint256 amount, uint256 minAmount) external returns (uint256);

    function curveUnstakeETH(uint256 amount, uint256 minAmount) external returns (uint256);
}
