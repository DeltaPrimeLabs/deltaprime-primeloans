pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "../interfaces/IYieldYakRouter.sol";
import "../lib/SmartLoanLib.sol";
import {LibDiamond} from "../lib/LibDiamond.sol";

contract YieldYakFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
  * Override PriceAware method, addresses below belong to authorized signers of data feeds
  **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return (_receivedSigner == SmartLoanLib.getPriceProvider1()) || (_receivedSigner == SmartLoanLib.getPriceProvider2());
    }

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return SmartLoanLib.getMaxBlockTimestampDelay();
    }

    // TODO: Change name to a more unique one for this exact investment strategy
    /**
 * Stakes AVAX in Yield Yak protocol
 * @param _amount amount of AVAX to be staked
 * @dev This function uses the redstone-evm-connector
 **/
    function stakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
        require(SmartLoanLib.getNativeTokenWrapped().balanceOf(address(this)) >= _amount, "Not enough AVAX available");

        SmartLoanLib.getNativeTokenWrapped().withdraw(_amount);
        SmartLoanLib.getYieldYakRouter().stakeAVAX{value: _amount}(_amount);
        // TOOD: Add a stake event
    }


    // TODO: Change name to a more unique one for this exact investment strategy
    /**
    * Unstakes AVAX from Yield Yak protocol
    * @param _amount amount of AVAX to be unstaked
    * @dev This function uses the redstone-evm-connector
    **/
    function unstakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
        IYieldYakRouter yakRouter = SmartLoanLib.getYieldYakRouter();
        address(SmartLoanLib.getYakAvaxStakingContract()).safeApprove(address(yakRouter), _amount);

        require(yakRouter.unstakeAVAX(_amount), "Unstaking failed");
        SmartLoanLib.getNativeTokenWrapped().deposit{value: _amount}();
        // TOOD: Add na unstake event
    }

    /**
    * Checks whether account is solvent (LTV lower than SmartLoanLib.getMaxLtv())
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;

        require(_isSolvent(), "The action may cause an account to become insolvent");
    }

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }
}