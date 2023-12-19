// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4da64a8a04844045e51b88c6202064e16ea118aa;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./SmartLoanLiquidationFacet.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../lib/SolvencyMethods.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IDustConverter.sol";
import "../interfaces/facets/IYieldYakRouter.sol";

//this path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract AssetsOperationsFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;
    using SafeERC20 for IERC20Metadata;

    /* ========== CONSTANTS ========== */

    uint256 public constant DUST_THRESHOLD = 20e18; // $20

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    /**
    * Funds the loan with a specified amount of a defined token
    * @dev Requires approval for ERC20 token on frontend side
    * @param _fundedAsset asset to be funded
    * @param _amount to be funded
    **/
    function fund(bytes32 _fundedAsset, uint256 _amount) public virtual {
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset, false);
        _amount = Math.min(_amount, token.balanceOf(msg.sender));

        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        if (token.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_fundedAsset, address(token));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.increaseProtocolExposure(_fundedAsset, _amount * 1e18 / 10 ** token.decimals());

        emit Funded(msg.sender, _fundedAsset, _amount, block.timestamp);
    }

    function addOwnedAsset(bytes32 _asset, address _address) external onlyWhitelistedLiquidators {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(_address), "Asset not supported");

        DiamondStorageLib.addOwnedAsset(_asset, _address);
    }

    /**
    * Funds the loan with a specified amount of a GLP
    * @dev Requires approval for stakedGLP token on frontend side
    * @param _amount to be funded
    **/
    function fundGLP(uint256 _amount) public virtual {
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
        _amount = Math.min(_amount, stakedGlpToken.balanceOf(msg.sender));
        address(stakedGlpToken).safeTransferFrom(msg.sender, address(this), _amount);
        if (stakedGlpToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("GLP", address(stakedGlpToken));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.increaseProtocolExposure("GLP", _amount);

        emit Funded(msg.sender, "GLP", _amount, block.timestamp);
    }

    /**
    * Withdraws an amount of a defined asset from the loan
    * This method could be used to cash out profits from investments
    * The loan needs to remain solvent after the withdrawal
    * @dev This function uses the redstone-evm-connector
    * @param _withdrawnAsset asset to be withdrawn
    * @param _amount to be withdrawn
    **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual onlyOwner nonReentrant canRepayDebtFully remainsSolvent {
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset, true);
        _amount = Math.min(_amount, token.balanceOf(address(this)));

        address(token).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_withdrawnAsset);
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure(_withdrawnAsset, _amount * 1e18 / 10 ** token.decimals());

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
        * Withdraws specified amount of a GLP
        * @param _amount to be withdrawn
    **/
    function withdrawGLP(uint256 _amount) public virtual onlyOwner nonReentrant canRepayDebtFully remainsSolvent{
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
        _amount = Math.min(token.balanceOf(address(this)), _amount);

        address(stakedGlpToken).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("GLP");
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure("GLP", _amount);

        emit Withdrawn(msg.sender, "GLP", _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @dev This function uses the redstone-evm-connector
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        ds._lastBorrowTimestamp = block.timestamp;

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool pool = Pool(tokenManager.getPoolAddress(_asset));
        pool.borrow(_amount);

        IERC20Metadata token = getERC20TokenInstance(_asset, false);
        if (token.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_asset, address(token));
        }

        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }


    /**
     * Repays funds to the pool
     * @dev This function uses the redstone-evm-connector
     * @param _asset to be repaid
     * @param _amount of funds to repay
     **/
    function repay(bytes32 _asset, uint256 _amount) public payable {
        IERC20Metadata token = getERC20TokenInstance(_asset, true);

        if (_isSolvent()) {
            DiamondStorageLib.enforceIsContractOwner();
        }

        Pool pool = Pool(DeploymentConstants.getTokenManager().getPoolAddress(_asset));

        _amount = Math.min(_amount, token.balanceOf(address(this)));
        _amount = Math.min(_amount, pool.getBorrowed(address(this)));
        require(token.balanceOf(address(this)) >= _amount, "There is not enough funds to repay");

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_asset);
        }

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);
    }

    // TODO: Separate manager for unfreezing - not liquidators
    function unfreezeAccount() external onlyWhitelistedLiquidators {
        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }

    /**
     * Swap existing debt to another debt
    * @dev This function uses the redstone-evm-connector
    * @dev _repayAmount and __borrowAmount can be used to control the slippage.
     * @param _fromAsset existing debt asset
     * @param _toAsset new debt asset
     * @param _repayAmount debt repay amount
     * @param _borrowAmount debt borrow amount
     * @param _path yield yak swap path
     * @param _adapters yield yak swap adapters
     */
    function swapDebt(bytes32 _fromAsset, bytes32 _toAsset, uint256 _repayAmount, uint256 _borrowAmount, address[] calldata _path, address[] calldata _adapters) external onlyOwner remainsSolvent nonReentrant {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        Pool fromAssetPool = Pool(tokenManager.getPoolAddress(_fromAsset));
        _repayAmount = Math.min(_repayAmount, fromAssetPool.getBorrowed(address(this)));

        IERC20Metadata toToken = getERC20TokenInstance(_toAsset, false);
        IERC20Metadata fromToken = getERC20TokenInstance(_fromAsset, false);

        Pool toAssetPool = Pool(tokenManager.getPoolAddress(_toAsset));
        toAssetPool.borrow(_borrowAmount);

        {
            // swap toAsset to fromAsset
            address(toToken).safeApprove(YY_ROUTER(), 0);
            address(toToken).safeApprove(YY_ROUTER(), _borrowAmount);

            IYieldYakRouter router = IYieldYakRouter(YY_ROUTER());

            IYieldYakRouter.Trade memory trade = IYieldYakRouter.Trade({
                amountIn: _borrowAmount,
                amountOut: _repayAmount,
                path: _path,
                adapters: _adapters
            });

            router.swapNoSplit(trade, address(this), 0);
        }
        
        address(fromToken).safeApprove(address(fromAssetPool), 0);
        address(fromToken).safeApprove(address(fromAssetPool), _repayAmount);
        fromAssetPool.repay(_repayAmount);

        if (fromToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(_fromAsset, address(fromToken));
        } else {
            DiamondStorageLib.removeOwnedAsset(_fromAsset);
        }

        emit DebtSwap(msg.sender, address(fromToken), address(toToken), _repayAmount, _borrowAmount, block.timestamp);
    }

    /// @notice Convert dust assets
    function convertDustAssets() external onlyOwner remainsSolvent nonReentrant {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        IDustConverter dustConverter = IDustConverter(DeploymentConstants.getDustConverter());

        SolvencyFacetProdAvalanche.AssetPrice[] memory ownedAssetsPrices = _getOwnedAssetsWithNativePrices();

        uint256 length = ownedAssetsPrices.length;
        uint256 dustAssetCount;
        bool[] memory isDust = new bool[](length);
        address[] memory tokens = new address[](length);
        for (uint256 i; i != length; ++i) {
            SolvencyFacetProdAvalanche.AssetPrice memory assetPrice = ownedAssetsPrices[i];
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assetPrice.asset, true));
            uint256 assetBalance = token.balanceOf(address(this));
            uint256 value = (assetPrice.price * 10 ** 10 * assetBalance / (10 ** token.decimals()));
            if (value <= DUST_THRESHOLD) {
                ++dustAssetCount;
                isDust[i] = true;
                tokens[i] = address(token);

                token.safeApprove(address(dustConverter), assetBalance);
            }
        }

        IDustConverter.AssetInfo[] memory dustAssets = new IDustConverter.AssetInfo[](dustAssetCount);
        uint256 idx;
        for (uint256 i; i != length; ++i) {
            if (isDust[i]) {
                bytes32 asset = ownedAssetsPrices[i].asset;
                dustAssets[idx++] = IDustConverter.AssetInfo({
                    symbol: asset,
                    asset: tokens[i]
                });
                DiamondStorageLib.removeOwnedAsset(asset);
            }
        }

        IDustConverter.AssetInfo memory returnAsset = abi.decode(
            proxyCalldata(
                address(dustConverter),
                abi.encodeWithSelector(IDustConverter.convert.selector, dustAssets),
                false
            ),
            (IDustConverter.AssetInfo)
        );
        DiamondStorageLib.addOwnedAsset(returnAsset.symbol, returnAsset.asset);
    }

    /* ======= VIEW FUNCTIONS ======*/

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) internal view returns (uint256) {
        IERC20 token = IERC20(DeploymentConstants.getTokenManager().getAssetAddress(_asset, true));
        return token.balanceOf(address(this));
    }

    function YY_ROUTER() internal virtual pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after a debt swap
     * @param user the address which performed the debt swap
     * @param fromToken token that was repaid
     * @param toToken token that was borrowed
     * @param repayAmount the amount of fromToken that was repaid
     * @param borrowAmount the amount of toToken that was borrowed
     * @param timestamp time of debt swap
     **/
    event DebtSwap(address indexed user, address indexed fromToken, address indexed toToken, uint256 repayAmount, uint256 borrowAmount, uint256 timestamp);

    /**
     * @dev emitted after a loan is funded
     * @param user the address which funded the loan
     * @param asset funded by a user
     * @param amount the amount of funds
     * @param timestamp time of funding
     **/
    event Funded(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted after the funds are withdrawn from the loan
     * @param user the address which withdraws funds from the loan
     * @param asset withdrawn by a user
     * @param amount of funds withdrawn
     * @param timestamp of the withdrawal
     **/
    event Withdrawn(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are borrowed from the pool
     * @param user the address of borrower
     * @param asset borrowed by an= user
     * @param amount of the borrowed funds
     * @param timestamp time of the borrowing
     **/
    event Borrowed(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool
     * @param user the address initiating repayment
     * @param asset asset repaid by a user
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event Repaid(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}