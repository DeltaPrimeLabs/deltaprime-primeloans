// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

interface IYieldYakRouter {
    function stakeAVAXYak(uint256 amount) external;

    function stakeSAVAXYak(uint256 amount) external;

    function unstakeAVAXYak(uint256 amount) external;

    function unstakeSAVAXYak(uint256 amount) external;
}
