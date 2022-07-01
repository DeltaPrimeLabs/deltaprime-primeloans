pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "../lib/SmartLoanLib.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import { LibDiamond } from "../lib/LibDiamond.sol";
import "../mock/WAVAX.sol";
import "../ERC20Pool.sol";


contract SmartLoanLogicFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return SmartLoanLib.getMaxBlockTimestampDelay();
    }

    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return (_receivedSigner == SmartLoanLib.getPriceProvider1()) || (_receivedSigner == SmartLoanLib.getPriceProvider2());
    }

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */


    //TODO: write a test for it
    function wrapNativeToken(uint256 amount) onlyOwner public {
        require(amount <= address(this).balance, "Not enough AVAX to wrap");
        SmartLoanLib.getNativeTokenWrapped().deposit{value: amount}();
    }

    function depositNativeToken() public payable virtual {
        SmartLoanLib.getNativeTokenWrapped().deposit{value: msg.value}();

        emit DepositNative(msg.sender, msg.value, block.timestamp);
    }

    receive() external payable {}

    /* ========== VIEW FUNCTIONS ========== */

    function getMaxLiquidationBonus() public view virtual returns (uint256) {
        return SmartLoanLib.getMaxLiquidationBonus();
    }

    function getMaxLtv() public view virtual returns (uint256) {
        return SmartLoanLib.getMaxLtv();
    }

    function getPercentagePrecision() public view virtual returns (uint256) {
        return SmartLoanLib.getPercentagePrecision();
    }



    /**
     * Returns the balances of all assets owned by the Prime Account
     * It could be used as a helper method for UI
     **/
    function getOwnedAssetsBalances() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getAllOwnedAssets();
        uint256[] memory balances = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            balances[i] = getBalance(assets[i]);
        }

        return balances;
    }

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) internal view returns (uint256) {
        IERC20 token = IERC20(SmartLoanLib.getPoolManager().getAssetAddress(_asset));
        return token.balanceOf(address(this));
    }


    /**
     * Returns the prices of all assets owned by the Prime Account
     * It could be used as a helper method for UI
     * @dev This function uses the redstone-evm-connector
     **/
    function getOwnedAssetsPrices() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getAllOwnedAssets();

        return getPricesFromMsg(assets);
    }


    /* ========== INTERNAL AND PRIVATE FUNCTIONS ========== */


    /* ========== MODIFIERS ========== */

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

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after a loan is funded
     * @param funder the address which funded the loan
     * @param asset funded by an investor
     * @param amount the amount of funds
     * @param timestamp time of funding
     **/
    event Funded(address indexed funder, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after the funds are withdrawn from the loan
     * @param owner the address which withdraws funds from the loan
     * @param asset withdrawn by an investor
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawn(address indexed owner, bytes32 indexed asset, uint256 amount, uint256 timestamp);



    /**
     * @dev emitted when funds are borrowed from the pool
     * @param borrower the address of borrower
     * @param asset borrowed by an investor
     * @param amount of the borrowed funds
     * @param timestamp time of the borrowing
     **/
    event Borrowed(address indexed borrower, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool
     * @param borrower the address initiating repayment
     * @param _asset asset repaid by an investor
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event Repaid(address indexed borrower, bytes32 indexed _asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after a successful liquidation operation
     * @param liquidator the address that initiated the liquidation operation
     * @param repayAmount requested amount (AVAX) of liquidation
     * @param bonus an amount of bonus (AVAX) received by the liquidator
     * @param ltv a new LTV after the liquidation operation
     * @param timestamp a time of the liquidation
     **/
    event Liquidated(address indexed liquidator, uint256 repayAmount, uint256 bonus, uint256 ltv, uint256 timestamp);

    /**
     * @dev emitted after closing a loan by the owner
     * @param debtRepaid the amount of a borrowed AVAX that was repaid back to the pool
     * @param withdrawalAmount the amount of AVAX that was withdrawn by the owner after closing the loan
     * @param timestamp a time of the loan's closure
     **/
    event LoanClosed(uint256 debtRepaid, uint256 withdrawalAmount, uint256 timestamp);


    /**
    * @dev emitted when funds are repaid to the pool
    * @param owner the address initiating repayment
    * @param amount of repaid funds
    * @param timestamp of the repayment
    **/
    event DepositNative(address indexed owner,  uint256 amount, uint256 timestamp);
}