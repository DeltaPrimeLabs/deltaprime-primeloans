pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "../interfaces/IYieldYakRouter.sol";
import "../interfaces/IYakStakingAVAXAAVEV1.sol";
import "../lib/SmartLoanLib.sol";
import {LibDiamond} from "../lib/LibDiamond.sol";

contract YieldYakFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib, IYieldYakRouter {
    using TransferHelper for address payable;
    using TransferHelper for address;

    address private constant YAKStakingAVAXAAVEV1Address = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;

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
 * @param amount amount of AVAX to be staked
 * @dev This function uses the redstone-evm-connector
 **/
    function stakeAVAXYak(uint256 amount) public override onlyOwner nonReentrant remainsSolvent {
        require(SmartLoanLib.getNativeTokenWrapped().balanceOf(address(this)) >= amount, "Not enough AVAX available");

        SmartLoanLib.getNativeTokenWrapped().withdraw(amount);
        IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address).deposit{value: amount}();

        // TODO: Add owned assets! -> LibDiamond.addOwnedAsset(_boughtAsset, boughtAssetAddress);

        emit Staked(msg.sender, "AVAX", amount, block.timestamp);
    }


    // TODO: Change name to a more unique one for this exact investment strategy
    /**
    * Unstakes AVAX from Yield Yak protocol
    * @param amount amount of AVAX to be unstaked
    * @dev This function uses the redstone-evm-connector
    **/
    function unstakeAVAXYak(uint256 amount) public override onlyOwner nonReentrant remainsSolvent {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(address(this));
        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        // TODO: Maybe perform a standard function call?
        (bool success, ) = address(yakStakingContract).call(abi.encodeWithSignature("withdraw(uint256)", amount));
        if (!success) {
            revert("Unstaking failed");
        }
        emit Unstaked(msg.sender, "AVAX", amount, block.timestamp);

        SmartLoanLib.getNativeTokenWrapped().deposit{value: amount}();
        // TOOD: Add na unstake event
    }

    function getTotalStakedValue() public view override returns (uint256 totalValue) {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 stakedBalance = yakStakingContract.balanceOf(address(this));
        if (stakedBalance == 0) {
            totalValue = 0;
        } else {
            uint256 totalSupply = yakStakingContract.totalSupply();
            uint256 totalDeposits = yakStakingContract.totalDeposits();
            totalValue = stakedBalance * totalDeposits / totalSupply;
        }
    }

    // TODO: To be removed in favor of returning YRT token to a liquidator
    function unstakeAVAXForASpecifiedAmount(uint256 amount) public override {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 stakedBalance = yakStakingContract.balanceOf(address(this));

        if (stakedBalance != 0) {
            uint256 totalSupply = yakStakingContract.totalSupply();
            uint256 totalDeposits = yakStakingContract.totalDeposits();
            uint256 totalStakedValue = stakedBalance * totalDeposits / totalSupply;
            if (totalStakedValue < amount) {
                unstakeAVAXYak(stakedBalance);
            } else {
                uint256 unstakeAmount = amount * stakedBalance / totalStakedValue;
                unstakeAVAXYak(unstakeAmount);
            }
        }
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

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

   /**
       * @dev emitted when user unstakes an asset
       * @param user the address executing unstaking
       * @param asset the asset that was unstaked
       * @param amount of the asset that was unstaked
       * @param timestamp of unstaking
   **/
    event Unstaked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}