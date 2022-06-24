pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "../lib/SmartLoanLib.sol";
import "../lib/LTVLib.sol";
import { LibDiamond } from "../lib/LibDiamond.sol";
import "../mock/WAVAX.sol";
import "../ERC20Pool.sol";


contract SmartLoanLogicFacet is PriceAware, ReentrancyGuard {
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

    /**
    * Funds the loan with a specified amount of a defined token
    * @param _fundedAsset asset to be funded
    * @param _amount to be funded
    * @dev Requires approval for ERC20 token on frontend side
    **/
    function fund(bytes32 _fundedAsset, uint256 _amount) public virtual {
        IERC20Metadata token = LTVLib.getERC20TokenInstance(_fundedAsset);
        address(token).safeTransferFrom(msg.sender, address(this), _amount);

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

    /**
    * Withdraws an amount of a defined asset from the loan
    * This method could be used to cash out profits from investments
    * The loan needs to remain solvent after the withdrawal
    * @param _withdrawnAsset asset to be withdrawn
    * @param _amount to be withdrawn
    * @dev This function uses the redstone-evm-connector
    **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual onlyOwner nonReentrant remainsSolvent {
        IERC20Metadata token = LTVLib.getERC20TokenInstance(_withdrawnAsset);
        require(LTVLib.getBalance(_withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

        address(token).safeTransfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    * @dev This function uses the redstone-evm-connector
    **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(_asset));
        pool.borrow(_amount);

        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }


    /**
     * Repays funds to the pool
     * @param _asset to be repaid
     * @param _amount of funds to repay
     * @dev This function uses the redstone-evm-connector
     **/
    function repay(bytes32 _asset, uint256 _amount) public payable {
        IERC20Metadata token = LTVLib.getERC20TokenInstance(_asset);

        if (isSolvent() && SmartLoanLib.getLiquidationInProgress() == false) {
            LibDiamond.enforceIsContractOwner();
        }

        uint256 price = getPriceFromMsg(_asset);

        ERC20Pool pool = ERC20Pool(SmartLoanLib.getPoolAddress(_asset));

        _amount = Math.min(_amount, pool.getBorrowed(address(this)));
        require(token.balanceOf(address(this)) >= _amount, "There is not enough funds to repay the loan");

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);
    }


    /**
    * Swaps one asset to another
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    * @dev This function uses the redstone-evm-connector
    **/
    function swap(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) public virtual onlyOwner remainsSolvent returns (uint256[] memory) {
        return swapAssets(_soldAsset, _boughtAsset, _exactSold, _minimumBought);
    }


   /**
   * Stakes AVAX in Yield Yak protocol
   * @param _amount amount of AVAX to be staked
   * @dev This function uses the redstone-evm-connector
   **/
    function stakeAVAXYak(uint256 _amount) public onlyOwner nonReentrant remainsSolvent {
        require(SmartLoanLib.getNativeTokenWrapped().balanceOf(address(this)) >= _amount, "Not enough AVAX available");

        SmartLoanLib.getNativeTokenWrapped().withdraw(_amount);
        SmartLoanLib.getYieldYakRouter().stakeAVAX{value: _amount}(_amount);
    }


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
    }

    //TODO: write a test for it
    function wrapNativeToken(uint256 amount) onlyOwner public {
        require(amount <= address(this).balance, "Not enough AVAX to wrap");
        SmartLoanLib.getNativeTokenWrapped().deposit{value: amount}();
    }

    function depositNativeToken() public payable virtual {
        SmartLoanLib.getNativeTokenWrapped().deposit{value: msg.value}();

        emit DepositNative(msg.sender, msg.value, block.timestamp);
    }

    function unwrapAndWithdraw(uint256 _amount) public payable virtual {
        WAVAX native = SmartLoanLib.getNativeTokenWrapped();
        require(native.balanceOf(address(this)) >= _amount, "Not enough WAVAX to unwrap and withdraw");

        native.withdraw(_amount);

        payable(msg.sender).safeTransferETH(_amount);

        emit UnwrapAndWithdraw(msg.sender, msg.value, block.timestamp);
    }

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

    function getPoolsAssetsIndices() public view virtual returns (uint8[1] memory) {
        return SmartLoanLib.getPoolsAssetsIndices();
    }

    function getPoolTokens() public view returns (IERC20Metadata[1] memory) {
        return SmartLoanLib.getPoolTokens();
    }

    function getBalance(bytes32 _asset) public view returns (uint256) {
        return LTVLib.getBalance(_asset);
    }

    /**
     * Returns the current debt from all lending pools
     * @dev This function uses the redstone-evm-connector
     **/
    function getDebt() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        return LTVLib.calculateDebt(prices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getTotalValue() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        return calculateAssetsValue(prices);
    }

    function getFullLoanStatus() public view returns (uint256[4] memory) {
        return [getTotalValue(), getDebt(), getLTV(), isSolvent() ? uint256(1) : uint256(0)];
    }

    /**
    * Checks if the loan is solvent.
    * It means that the ratio between debt and current collateral (defined as total value minus debt) is below safe level,
    * which is parametrized by the getMaxLtv()
    * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view virtual returns (bool) {
        return getLTV() < SmartLoanLib.getMaxLtv();
    }

    /**
     * Returns the balances of all assets served by the price provider
     * It could be used as a helper method for UI
     **/
    function getAllAssetsBalances() public view returns (uint256[] memory) {
        return LTVLib.getAllAssetsBalances();
    }

    /**
     * Returns the prices of all assets served by the price provider
     * It could be used as a helper method for UI
     * @dev This function uses the redstone-evm-connector
     **/
    function getAllAssetsPrices() public view returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();

        return getPricesFromMsg(assets);
    }


    /**
 * Returns the current debts associated with the loan as well as total debt
 **/
    function getDebts() public view virtual returns (uint256[] memory) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();

        uint length = SmartLoanLib.getPools().length;
        uint256[] memory debts = new uint256[](length);

        uint256 i;

        for (i = 0; i < length; i++) {
            debts[i] = SmartLoanLib.getPools()[i].getBorrowed(address(this));
        }

        return debts;
    }

    /**
     * LoanToValue ratio is calculated as the ratio between debt and collateral (defined as total value minus debt).
     * The collateral is equal to total loan value takeaway debt.
     * @dev This function uses the redstone-evm-connector
     **/
    function getLTV() public view virtual returns (uint256) {
        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        return calculateLTV(prices);
    }

    /* ========== INTERNAL AND PRIVATE FUNCTIONS ========== */

    /**
    * Swaps one asset with another
    * @param _soldAsset asset to be sold
    * @param _boughtAsset asset to be bought
    * @param _exactSold exact amount of asset to be sold
    * @param _minimumBought minimum amount of asset to be bought
    **/
    function swapAssets(bytes32 _soldAsset, bytes32 _boughtAsset, uint256 _exactSold, uint256 _minimumBought) internal returns(uint256[] memory) {
        IERC20Metadata soldToken = LTVLib.getERC20TokenInstance(_soldAsset);

        require(soldToken.balanceOf(address(this)) >= _exactSold, "Not enough token to sell");
        address(soldToken).safeTransfer(address(SmartLoanLib.getExchange()), _exactSold);

        uint256[] memory amounts = SmartLoanLib.getExchange().swap(_soldAsset, _boughtAsset, _exactSold, _minimumBought);

        emit Swap(msg.sender, _soldAsset, _boughtAsset, amounts[0],  amounts[amounts.length - 1], block.timestamp);

        return amounts;
    }

    /**
     * Calculates the current value of Prime Account in USD including all tokens as well as staking and LP positions
     **/
    function calculateAssetsValue(uint256[] memory prices) internal view virtual returns (uint256) {
        return LTVLib.calculateAssetsValue(prices) + SmartLoanLib.getYieldYakRouter().getTotalStakedValue() * prices[0] / 10**8;
    }

    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
        address assetAddress = SmartLoanLib.getExchange().getAssetAddress(_asset);
        IERC20Metadata token = IERC20Metadata(assetAddress);
        return token;
    }

    /**
     * Calculates the current debt as a sum of debts from all lending pools
     * @param _prices current prices
     **/
    function calculateDebt(uint256[] memory _prices) internal view virtual returns (uint256) {
        return LTVLib.calculateDebt(_prices);
    }

    /**
    * Returns current Loan To Value (solvency ratio) associated with the loan, defined as debt / (total value - debt)
    * @param _prices current prices
    **/
    function calculateLTV(uint256[] memory _prices) internal virtual view returns (uint256) {
        return LTVLib.calculateLTV(_prices);
    }

    /**
     * This function role is to repay a defined amount of debt during liquidation or closing account.
     * @param _repayConfig configuration for repayment
     **/
    function repayAmount(RepayConfig memory _repayConfig) private returns (uint256) {
        return LTVLib.repayAmount(
            LTVLib.RepayConfig(
                _repayConfig.allowSwaps,
                _repayConfig.leftToRepay,
                _repayConfig.poolAssetIndex,
                _repayConfig.tokensForLiquidator,
                _repayConfig.prices,
                _repayConfig.assets
            )
        );
    }

    /* ========== MODIFIERS ========== */

    /**
    * Checks whether account is solvent (LTV lower than SmartLoanLib.getMaxLtv())
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;
        require(isSolvent(), "The action may cause an account to become insolvent");
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
     * @dev emitted after a swap of assets
     * @param investor the address of investor making the purchase
     * @param soldAsset sold by the investor
     * @param boughtAsset bought by the investor
     * @param _maximumSold maximum to be sold
     * @param _minimumBought minimum to be bought
     * @param timestamp time of the swap
     **/
    event Swap(address indexed investor, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 _maximumSold, uint256 _minimumBought, uint256 timestamp);

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
    * @dev emitted when native tokens are deposited to the SmartLoan
    * @param owner the address initiating deposit
    * @param amount of repaid funds
    * @param timestamp of the repayment
    **/
    event DepositNative(address indexed owner,  uint256 amount, uint256 timestamp);

    /**
    * @dev emitted when native tokens are withdrawn by the owner
    * @param owner the address initiating withdraw
    * @param amount of repaid funds
    * @param timestamp of the repayment
    **/
    event UnwrapAndWithdraw(address indexed owner,  uint256 amount, uint256 timestamp);

    struct RepayConfig {
        bool allowSwaps;
        uint256 leftToRepay;
        uint256 poolAssetIndex;
        uint256 tokensForLiquidator;
        uint256[] prices;
        bytes32[] assets;
    }

    struct SwapConfig {
        uint256 assetIndex;
        uint256 poolAssetIndex;
        uint256 neededSwapInPoolToken;
        uint256[] prices;
        bytes32[] assets;
    }
}