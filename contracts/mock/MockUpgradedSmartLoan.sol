// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAwareUpgradeable.sol";
import "../interfaces/IAssetsExchange.sol";
import "../Pool.sol";
import "../SmartLoan.sol";

/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract MockUpgradedSmartLoan is SmartLoan {
  function get_max_ltv() override public pure returns(uint256) {
    return 200;
  }

  function get_min_sellout_ltv() override public pure returns(uint256) {
    return 400;
  }

  function getTotalValue() override public pure returns (uint256) {
    return 777;
  }
}
