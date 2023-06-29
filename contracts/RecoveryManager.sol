// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/SmartLoanGigaChadInterface.sol";

/// @title DeltaPrime Recovery Manager
contract RecoveryManager is Ownable {
    mapping(address => mapping(bytes32 => uint256)) public recovered;

    function withdrawAssets(address[] memory _accounts, bytes32[][] memory _assets) external onlyOwner {
        uint256 length = _accounts.length;
        require(length == _assets.length, "input array length mismatch");

        for (uint256 i; i != length; ++i) {
            SmartLoanGigaChadInterface account = SmartLoanGigaChadInterface(_accounts[i]);
            uint256[] memory amounts = account.emergencyWithdraw(_assets[i]);
            uint256 assetsLength = _assets[i].length;
            for (uint256 j; j != assetsLength; ++j) {
                recovered[address(account)][_assets[i][j]] = amounts[j];
            }
        }
    }
}
