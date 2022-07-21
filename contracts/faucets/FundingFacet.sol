pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../lib/SmartLoanLib.sol";
import { LibDiamond } from "../lib/LibDiamond.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "../PoolManager.sol";

contract FundingFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
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
        IERC20Metadata token = getERC20TokenInstance(_fundedAsset);
        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        if(token.balanceOf(address(this)) > 0) {
            LibDiamond.addOwnedAsset(_fundedAsset, address(token));
        }

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
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset);
        require(getBalance(_withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

        address(token).safeTransfer(msg.sender, _amount);
        if(token.balanceOf(address(this)) == 0) {
            LibDiamond.removeOwnedAsset(_withdrawnAsset);
        }

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }

    /**
    * Borrows funds from the pool
    * @param _asset to be borrowed
    * @param _amount of funds to borrow
    * @dev This function uses the redstone-evm-connector
    **/
    function borrow(bytes32 _asset, uint256 _amount) external onlyOwner remainsSolvent {
        PoolManager poolManager = SmartLoanLib.getPoolManager();
        ERC20Pool pool = ERC20Pool(poolManager.getPoolAddress(_asset));
        pool.borrow(_amount);

        if(pool.getBorrowed(address(this)) > 0) {
            LibDiamond.addOwnedAsset(_asset, poolManager.getAssetAddress(_asset));
        }

        emit Borrowed(msg.sender, _asset, _amount, block.timestamp);
    }


    /**
     * Repays funds to the pool
     * @param _asset to be repaid
     * @param _amount of funds to repay
     * @dev This function uses the redstone-evm-connector
     **/
    function repay(bytes32 _asset, uint256 _amount) public payable {
        IERC20Metadata token = getERC20TokenInstance(_asset);
        SmartLoanLib.getNativeTokenWrapped().deposit{value: msg.value}();

        if (_isSolvent() && SmartLoanLib.getLiquidationInProgress() == false) {
            LibDiamond.enforceIsContractOwner();
        }

        uint256 price = getPriceFromMsg(_asset);

        ERC20Pool pool =  ERC20Pool(SmartLoanLib.getPoolManager().getPoolAddress(_asset));
        uint256 poolDebt = pool.getBorrowed(address(this)) * price * 10**10 / 10 ** token.decimals();

        _amount = Math.min(_amount, poolDebt);
        require(token.balanceOf(address(this)) >= _amount, "There is not enough funds to repay the loan");

        address(token).safeApprove(address(pool), 0);
        address(token).safeApprove(address(pool), _amount);

        pool.repay(_amount);

        if(pool.getBorrowed(address(this)) == 0) {
            LibDiamond.removeOwnedAsset(_asset);
        }

        emit Repaid(msg.sender, _asset, _amount, block.timestamp);
    }

    /* ======= VIEW FUNCTIONS ======*/

    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset) internal view returns (IERC20Metadata) {
        return IERC20Metadata(SmartLoanLib.getPoolManager().getAssetAddress(_asset));
    }

    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) internal view returns (uint256) {
        IERC20 token = IERC20(SmartLoanLib.getPoolManager().getAssetAddress(_asset));
        return token.balanceOf(address(this));
    }

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
}