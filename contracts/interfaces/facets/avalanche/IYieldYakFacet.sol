pragma solidity ^0.8.17;

interface IYieldYakFacet {
    function stakeAVAXYak(uint256 amount) external;

    function stakeSAVAXYak(uint256 amount) external;

    function stakeGLPYak(uint256 amount) external;

    function stakePNGAVAXUSDCYak(uint256 amount) external;

    function stakePNGAVAXETHYak(uint256 amount) external;

    function stakeTJAVAXUSDCYak(uint256 amount) external;

    function stakeTJAVAXETHYak(uint256 amount) external;

    function stakeTJAVAXSAVAXYak(uint256 amount) external;

    function unstakeAVAXYak(uint256 amount) external;

    function unstakeSAVAXYak(uint256 amount) external;

    function unstakeGLPYak(uint256 amount) external;

    function unstakePNGAVAXUSDCYak(uint256 amount) external;

    function unstakePNGAVAXETHYak(uint256 amount) external;

    function unstakeTJAVAXUSDCYak(uint256 amount) external;

    function unstakeTJAVAXETHYak(uint256 amount) external;

    function unstakeTJAVAXSAVAXYak(uint256 amount) external;
}
