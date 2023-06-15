pragma solidity ^0.8.17;

interface ICurveFacet {
    function curveStakeTokens(uint256[5] memory amounts) external;

    function curveStakeDAI(uint256 amount) external;

    function curveStakeUSDC(uint256 amount) external;

    function curveStakeUSDT(uint256 amount) external;

    function curveStakeBTC(uint256 amount) external;

    function curveStakeETH(uint256 amount) external;

    function curveUnstakeTokens(uint256 amount, uint256[5] memory min_amounts) external;

    function unstakeOneTokenCurve(uint256 i, uint256 amount) external;

    function curveUnstakeDAI(uint256 amount, uint256 minAmount) external;

    function curveUnstakeUSDC(uint256 amount, uint256 minAmount) external;

    function curveUnstakeUSDT(uint256 amount, uint256 minAmount) external;

    function curveUnstakeBTC(uint256 amount, uint256 minAmount) external;

    function curveUnstakeETH(uint256 amount, uint256 minAmount) external;
}
