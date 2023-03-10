pragma solidity ^0.8.17;

interface ICurveFacet {
    function stakeDAICurve(uint256 amount) external;

    function stakeUSDCCurve(uint256 amount) external;

    function stakeUSDTCurve(uint256 amount) external;

    function stakeWBTCCurve(uint256 amount) external;

    function stakeETHCurve(uint256 amount) external;

    function unstakeDAICurve(uint256 amount) external;

    function unstakeUSDCCurve(uint256 amount) external;

    function unstakeUSDTCurve(uint256 amount) external;

    function unstakeWBTCCurve(uint256 amount) external;

    function unstakeETHCurve(uint256 amount) external;
}
